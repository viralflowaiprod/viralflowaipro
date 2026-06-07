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
        mode: "auto",
        daily_quantity: 36,
        platforms: ["youtube", "instagram", "tiktok", "pinterest"],
        time_slots: DEFAULT_SLOTS,
        niche: null as string | null,
      }
    );
  });

const SaveSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(["auto", "manual"]),
  daily_quantity: z.number().int().min(1).max(100),
  platforms: z.array(z.string().min(1).max(40)).min(1).max(10),
  time_slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(36),
  niche: z.string().max(120).nullable().optional(),
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
