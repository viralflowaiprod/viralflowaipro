import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Verifica se o usuário atual tem assinatura ativa (ou é admin). */
export const getMySubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sub }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("status, plan_tier, current_period_end, source")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId),
    ]);

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const active =
      isAdmin ||
      (!!sub &&
        sub.status === "active" &&
        (!sub.current_period_end || new Date(sub.current_period_end) > new Date()));

    return { active, isAdmin, subscription: sub ?? null };
  });

/** Resgata um código de ativação para o usuário logado. */
export const redeemActivationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ code: z.string().trim().min(4).max(64) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const code = data.code.toUpperCase();

    const { data: codeRow, error: codeErr } = await supabaseAdmin
      .from("activation_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (codeErr) throw new Error(codeErr.message);
    if (!codeRow) throw new Error("Código não encontrado.");
    if (codeRow.status === "revoked")
      throw new Error("Este código foi revogado.");
    if (
      codeRow.status === "used" &&
      codeRow.used_by &&
      codeRow.used_by !== context.userId
    )
      throw new Error("Este código já foi utilizado por outro usuário.");
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date())
      throw new Error("Este código expirou.");

    // marca código como usado
    if (codeRow.status !== "used") {
      const { error: updErr } = await supabaseAdmin
        .from("activation_codes")
        .update({
          status: "used",
          used_by: context.userId,
          used_at: new Date().toISOString(),
        })
        .eq("id", codeRow.id);
      if (updErr) throw new Error(updErr.message);
    }

    // cria/atualiza assinatura
    const { error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: context.userId,
          code_id: codeRow.id,
          source: codeRow.source,
          plan_tier: codeRow.plan_tier,
          status: "active",
          current_period_end: null,
          cancelled_at: null,
        },
        { onConflict: "user_id" },
      );
    if (subErr) throw new Error(subErr.message);

    return { ok: true };
  });

function randomCode(prefix = "VF") {
  const part = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `${prefix}-${part()}-${part()}-${part()}`;
}

/** Admin: gera N códigos manuais. */
export const adminGenerateCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        quantity: z.number().int().min(1).max(100),
        plan_tier: z.string().min(1).max(40).default("standard"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const rows = Array.from({ length: data.quantity }).map(() => ({
      code: randomCode(),
      source: "manual" as const,
      plan_tier: data.plan_tier,
      status: "active" as const,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("activation_codes")
      .insert(rows)
      .select("code, plan_tier, created_at");
    if (error) throw new Error(error.message);
    return { codes: inserted ?? [] };
  });

/** Admin: lista códigos. */
export const adminListCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("activation_codes")
      .select("id, code, source, status, plan_tier, used_by, used_at, buyer_email, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin: revoga um código (e cancela assinatura associada, se houver). */
export const adminRevokeCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("activation_codes")
      .update({ status: "revoked" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("code_id", data.id);

    return { ok: true };
  });
