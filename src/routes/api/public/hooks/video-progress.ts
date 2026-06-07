import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  job_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  stage: z.enum(["script", "tts", "images", "assembly", "publish"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: z.enum(["processing", "completed", "failed"]).optional(),
  message: z.string().max(2000).optional(),
  video_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  title: z.string().max(200).optional(),
  error: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/hooks/video-progress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Validation failed", issues: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const p = parsed.data;

        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (p.progress !== undefined) update.progress = p.progress;
        if (p.status) update.status = p.status;
        if (p.error) update.error_message = p.error;

        await supabaseAdmin.from("video_jobs").update(update).eq("id", p.job_id);

        await supabaseAdmin.from("automation_logs").insert({
          job_id: p.job_id,
          user_id: p.user_id ?? null,
          level: p.status === "failed" || p.error ? "error" : "info",
          message: p.message ?? `Stage: ${p.stage ?? "unknown"}`,
          metadata: { stage: p.stage, progress: p.progress, status: p.status },
        });

        if (p.video_url || p.thumbnail_url || p.status === "completed") {
          // Update the most recent pending/processing video for this job's user
          if (p.user_id) {
            const { data: video } = await supabaseAdmin
              .from("videos")
              .select("id")
              .eq("user_id", p.user_id)
              .in("status", ["pending", "processing"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (video) {
              await supabaseAdmin
                .from("videos")
                .update({
                  status: p.status === "completed" ? "completed" : "processing",
                  video_url: p.video_url ?? null,
                  thumbnail_url: p.thumbnail_url ?? null,
                  title: p.title ?? undefined,
                })
                .eq("id", video.id);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
