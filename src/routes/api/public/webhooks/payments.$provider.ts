/**
 * Webhook unificado de pagamentos (Kiwify, Hotmart, Kirvano, Monetizze).
 *
 * Fluxo (compra aprovada):
 *  1. Cria automaticamente a conta no Supabase Auth com o email do comprador
 *  2. Envia email de convite/confirmação com link para definir senha
 *  3. Cria assinatura ativa vinculada ao usuário e ao pedido externo
 *
 * Fluxo (cancelamento/reembolso):
 *  - Localiza a assinatura pelo order_id (ou email) e revoga o acesso
 *
 * Endpoint público: POST /api/public/webhooks/payments/{provider}
 * Proteção opcional por header `x-webhook-secret` (env PAYMENTS_WEBHOOK_SECRET).
 */
import { createFileRoute } from "@tanstack/react-router";

type Provider = "kiwify" | "hotmart" | "kirvano" | "monetizze";

function isProvider(v: string): v is Provider {
  return ["kiwify", "hotmart", "kirvano", "monetizze"].includes(v);
}

function extractEventType(
  provider: Provider,
  payload: Record<string, unknown>,
): "purchase" | "cancel" | "unknown" {
  const status = String(
    payload.status ??
      payload.event ??
      payload.order_status ??
      payload.transaction_status ??
      "",
  ).toLowerCase();
  if (/(approved|paid|complet|purchase|success|aprovad)/.test(status)) return "purchase";
  if (/(refund|cancel|chargeback|reembols|expired|expirad)/.test(status)) return "cancel";
  if (provider === "hotmart") {
    const ev = String(payload.event ?? "").toUpperCase();
    if (ev.includes("PURCHASE_APPROVED") || ev.includes("PURCHASE_COMPLETE")) return "purchase";
    if (ev.includes("CANCEL") || ev.includes("REFUND") || ev.includes("CHARGEBACK")) return "cancel";
  }
  return "unknown";
}

function extractEmail(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.buyer_email,
    payload.email,
    (payload.customer as Record<string, unknown> | undefined)?.email,
    (payload.buyer as Record<string, unknown> | undefined)?.email,
    (payload.Customer as Record<string, unknown> | undefined)?.email,
    (payload.data as Record<string, unknown> | undefined)?.buyer_email,
    ((payload.data as Record<string, unknown> | undefined)?.buyer as Record<string, unknown> | undefined)?.email,
  ];
  for (const c of candidates) if (typeof c === "string" && c.includes("@")) return c.toLowerCase().trim();
  return null;
}

function extractName(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.buyer_name,
    payload.name,
    (payload.customer as Record<string, unknown> | undefined)?.name,
    (payload.buyer as Record<string, unknown> | undefined)?.name,
  ];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim();
  return null;
}

function extractOrderId(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.order_id,
    payload.transaction_id,
    payload.id,
    (payload.data as Record<string, unknown> | undefined)?.id,
  ];
  for (const c of candidates) if (c) return String(c);
  return null;
}

export const Route = createFileRoute("/api/public/webhooks/payments/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const provider = params.provider;
        if (!isProvider(provider)) return new Response("Unknown provider", { status: 404 });

        const expectedSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got =
            request.headers.get("x-webhook-secret") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            new URL(request.url).searchParams.get("secret");
          if (got !== expectedSecret) return new Response("Unauthorized", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const eventType = extractEventType(provider, payload);
        const buyerEmail = extractEmail(payload);
        const buyerName = extractName(payload);
        const orderId = extractOrderId(payload);
        const origin = new URL(request.url).origin;

        if (eventType === "purchase") {
          if (!buyerEmail) return new Response("Missing buyer email", { status: 400 });

          // 1) Cria (ou recupera) o usuário no Auth e dispara o email de convite
          let userId: string | null = null;
          const { data: invited, error: inviteErr } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(buyerEmail, {
              redirectTo: `${origin}/reset-password`,
              data: { full_name: buyerName ?? buyerEmail.split("@")[0], source: provider },
            });

          if (invited?.user) {
            userId = invited.user.id;
          } else if (inviteErr) {
            // Usuário já existe — busca pelo email
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 200,
            });
            const found = list?.users.find(
              (u) => (u.email ?? "").toLowerCase() === buyerEmail,
            );
            if (found) {
              userId = found.id;
              // Reenvia link para definir/recuperar senha
              await supabaseAdmin.auth.admin.generateLink({
                type: "recovery",
                email: buyerEmail,
                options: { redirectTo: `${origin}/reset-password` },
              });
            } else {
              console.error("[webhook] invite failed", inviteErr);
              return new Response(inviteErr.message, { status: 500 });
            }
          }

          if (!userId) return new Response("Could not create user", { status: 500 });

          // 2) Cria/atualiza a assinatura ativa
          const { error: subErr } = await supabaseAdmin
            .from("subscriptions")
            .upsert(
              {
                user_id: userId,
                source: provider,
                plan_tier: "standard",
                status: "active",
                buyer_email: buyerEmail,
                external_order_id: orderId,
                cancelled_at: null,
                current_period_end: null,
              },
              { onConflict: "user_id" },
            );
          if (subErr) {
            console.error("[webhook] subscription upsert failed", subErr);
            return new Response(subErr.message, { status: 500 });
          }

          return Response.json({ ok: true, user_id: userId, email: buyerEmail });
        }

        if (eventType === "cancel") {
          // Tenta localizar a assinatura por order_id, fallback por email
          let query = supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() });

          if (orderId) {
            query = query.eq("source", provider).eq("external_order_id", orderId);
          } else if (buyerEmail) {
            query = query.eq("buyer_email", buyerEmail);
          } else {
            return Response.json({ ok: true, ignored: "no identifier" });
          }

          const { error } = await query;
          if (error) {
            console.error("[webhook] cancel failed", error);
            return new Response(error.message, { status: 500 });
          }
          return Response.json({ ok: true, cancelled: true });
        }

        console.warn("[webhook] unknown event", { provider, payload });
        return Response.json({ ok: true, ignored: true });
      },

      GET: async ({ params }) => Response.json({ provider: params.provider, ready: true }),
    },
  },
});
