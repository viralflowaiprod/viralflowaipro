import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_SLOTS = [
  "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
];

export const getAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("automation_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        user_id: userId,
        enabled: false,
        paused: false,
        continuous_monthly: false,
        mode: "auto",
        daily_quantity: 8,
        platforms: ["youtube", "instagram", "tiktok", "pinterest"],
        time_slots: DEFAULT_SLOTS,
        niche: null as string | null,
        seed_idea: null as string | null,
      }
    );
  });

const SaveSchema = z.object({
  enabled: z.boolean(),
  paused: z.boolean().optional(),
  continuous_monthly: z.boolean().optional(),
  mode: z.enum(["auto", "manual"]),
  daily_quantity: z.number().int().min(1).max(80),
  platforms: z.array(z.string().min(1).max(40)).min(1).max(10),
  time_slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(36),
  niche: z.string().max(120).nullable().optional(),
  seed_idea: z.string().max(2000).nullable().optional(),
});

export const saveAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("automation_settings")
      .upsert({ ...data, user_id: userId }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAutomationPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ paused: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { paused: boolean; last_resume_at?: string } = { paused: data.paused };
    if (!data.paused) patch.last_resume_at = new Date().toISOString();

    const { error } = await supabase
      .from("automation_settings")
      .update(patch)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, paused: data.paused };
  });

const MAX_DAILY_LIMIT = 80;

/**
 * Computes the next-batch plan for the user, enforcing:
 *  - daily limit (max 80, configurable, per user)
 *  - dedup (never schedule the same day+slot twice)
 *  - pause (returns empty plan if paused)
 *  - continuous_monthly (fills future days until the month closes)
 *
 * Returned by both the authenticated UI fn and the public hook so n8n can
 * read it without touching the existing pipeline.
 */
async function computePlan(
  client: { from: typeof import("@supabase/supabase-js").SupabaseClient.prototype.from },
  userId: string,
) {
  // settings
  const { data: s } = await (client as any)
    .from("automation_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const settings = s ?? null;
  const dailyLimit = Math.min(
    MAX_DAILY_LIMIT,
    Math.max(1, (settings?.daily_quantity as number) ?? 8),
  );
  const slots: string[] = Array.isArray(settings?.time_slots)
    ? (settings!.time_slots as string[])
    : ["08:00", "12:00", "18:00"];
  const continuous = !!settings?.continuous_monthly;
  const paused = !!settings?.paused;

  // already-scheduled posts: today + next 31 days
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const horizon = new Date(start);
  horizon.setDate(horizon.getDate() + (continuous ? 31 : 1));

  const { data: existing } = await (client as any)
    .from("scheduled_posts")
    .select("scheduled_for")
    .eq("user_id", userId)
    .gte("scheduled_for", start.toISOString())
    .lt("scheduled_for", horizon.toISOString());

  // bucket existing by day → set of "HH:MM"
  const used: Record<string, Set<string>> = {};
  for (const row of (existing ?? []) as Array<{ scheduled_for: string }>) {
    const d = new Date(row.scheduled_for);
    const day = d.toISOString().slice(0, 10);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    (used[day] ??= new Set()).add(`${hh}:${mm}`);
  }

  const todayKey = start.toISOString().slice(0, 10);
  const todayUsed = used[todayKey]?.size ?? 0;
  const remainingToday = Math.max(0, dailyLimit - todayUsed);

  const plan: Array<{ date: string; time: string; iso: string }> = [];

  if (!paused) {
    const days = continuous ? 31 : 1;
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      const dayKey = day.toISOString().slice(0, 10);
      const usedSet = used[dayKey] ?? new Set<string>();
      const remaining = dailyLimit - usedSet.size;
      if (remaining <= 0) continue;
      let added = 0;
      for (const t of slots) {
        if (added >= remaining) break;
        if (usedSet.has(t)) continue; // dedup: never repeat day+slot
        const [hh, mm] = t.split(":").map(Number);
        const iso = new Date(day);
        iso.setHours(hh, mm, 0, 0);
        // skip past slots for today
        if (i === 0 && iso.getTime() <= Date.now()) continue;
        plan.push({ date: dayKey, time: t, iso: iso.toISOString() });
        added++;
      }
    }
  }

  return {
    paused,
    enabled: !!settings?.enabled,
    mode: (settings?.mode as string) ?? "auto",
    continuous_monthly: continuous,
    daily_limit: dailyLimit,
    today_used: todayUsed,
    today_remaining: remainingToday,
    current_job_id: (settings?.current_job_id as string | null) ?? null,
    seed_idea: (settings?.seed_idea as string | null) ?? null,
    niche: (settings?.niche as string | null) ?? null,
    platforms: settings?.platforms ?? [],
    plan,
  };
}

export const getProductionPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return computePlan(context.supabase as any, context.userId);
  });

export { computePlan };



export const updatePrivacyMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ privacy_mode: z.enum(["save_all", "ephemeral"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ privacy_mode: data.privacy_mode })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
