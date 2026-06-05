/**
 * Webhook unificado para plataformas de pagamento (Kiwify, Hotmart, Kirvano, Monetizze).
 *
 * Cada plataforma chama: POST /api/public/webhooks/payments/{provider}
 *
 * Eventos esperados:
 *  - compra aprovada  → cria activation_code e envia por email (futuro)
 *  - cancelamento/reembolso → revoga código + cancela assinatura
 *
 * NOTA: cada provedor tem seu próprio formato de payload e método de
 * verificação de assinatura. Aqui implementamos o esqueleto + verificação
 * por token compartilhado (header) para destravar a integração.
 * Verificação HMAC específica por provedor virá quando as chaves forem
 * configuradas pelo admin.
 */
import { createFileRoute } from "@tanstack/react-router";

type Provider = "kiwify" | "hotmart" | "kirvano" | "monetizze";

function isProvider(v: string): v is Provider {
  return ["kiwify", "hotmart", "kirvano", "monetizze"].includes(v);
}

function randomCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VF-${part()}-${part()}-${part()}`;
}

function extractEventType(provider: Provider, payload: Record<string, unknown>): "purchase" | "cancel" | "unknown" {
  // Heurística simples por provedor — refinar quando tivermos payloads reais.
  const status = String(
    payload.status ?? payload.event ?? payload.order_status ?? payload.transaction_status ?? "",
  ).toLowerCase();
  if (/(approved|paid|complet|purchase|success|aprovad)/.test(status)) return "purchase";
  if (/(refund|cancel|chargeback|reembols)/.test(status)) return "cancel";
  // fallback por provedor
  if (provider === "hotmart") {
    const ev = String((payload as Record<string, unknown>).event ?? "").toUpperCase();
    if (ev.includes("PURCHASE_APPROVED") || ev.includes("PURCHASE_COMPLETE")) return "purchase";
    if (ev.includes("CANCEL") || ev.includes("REFUND")) return "cancel";
  }
  return "unknown";
}

function extractEmail(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.buyer_email,
    payload.email,
    (payload.customer as Record<string, unknown> | undefined)?.email,
    (payload.buyer as Record<string, unknown> | undefined)?.email,
    (payload.data as Record<string, unknown> | undefined)?.buyer_email,
  ];
  for (const c of candidates) if (typeof c === "string" && c.includes("@")) return c;
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
        if (!isProvider(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }

        // Verificação de assinatura via token compartilhado
        // (configurar PAYMENTS_WEBHOOK_SECRET nos secrets do projeto)
        const expectedSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got =
            request.headers.get("x-webhook-secret") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            new URL(request.url).searchParams.get("secret");
          if (got !== expectedSecret) {
            return new Response("Unauthorized", { status: 401 });
          }
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
        const orderId = extractOrderId(payload);

        if (eventType === "purchase") {
          const code = randomCode();
          const { error } = await supabaseAdmin.from("activation_codes").insert({
            code,
            source: provider,
            buyer_email: buyerEmail,
            external_order_id: orderId,
            plan_tier: "standard",
            status: "active",
          });
          if (error) {
            console.error("[webhook] insert code failed", error);
            return new Response(error.message, { status: 500 });
          }
          // TODO: enviar email com o código (próximo iteração)
          return Response.json({ ok: true, code, buyer_email: buyerEmail });
        }

        if (eventType === "cancel") {
          if (orderId) {
            const { data: codes } = await supabaseAdmin
              .from("activation_codes")
              .select("id")
              .eq("source", provider)
              .eq("external_order_id", orderId);
            const ids = (codes ?? []).map((c) => c.id);
            if (ids.length) {
              await supabaseAdmin
                .from("activation_codes")
                .update({ status: "revoked" })
                .in("id", ids);
              await supabaseAdmin
                .from("subscriptions")
                .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
                .in("code_id", ids);
            }
          }
          return Response.json({ ok: true, cancelled: true });
        }

        // evento desconhecido — registra e retorna 200 para o provedor não re-tentar
        console.warn("[webhook] unknown event", { provider, payload });
        return Response.json({ ok: true, ignored: true });
      },

      GET: async ({ params }) =>
        Response.json({ provider: params.provider, ready: true }),
    },
  },
});
