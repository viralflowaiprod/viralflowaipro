import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLATFORM_IDS = ["youtube", "instagram", "tiktok", "kwai", "pinterest", "rumble"] as const;

const PayloadSchema = z.object({
  niche: z.string().min(1).max(120),
  topic: z.string().min(1).max(500),
  prompt: z.string().max(4000).optional().default(""),
  reference_images: z.array(z.string().url()).max(6).optional().default([]),
  cta: z.string().max(200).optional().default(""),
  platform: z.enum(PLATFORM_IDS).default("youtube"),
  platforms: z.array(z.enum(PLATFORM_IDS)).max(6).optional().default([]),
  lang: z.string().max(10).optional().default("pt-f"),
  quantity: z.number().int().min(1).max(10).default(1),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        // Auth: require Bearer token from the signed-in user
        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const userId = userData.user.id;

        // Validate input
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const parsed = PayloadSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Validation failed", issues: parsed.error.issues }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        const { niche, topic, prompt, reference_images, cta, platform, platforms, lang, quantity } = parsed.data;

        // 1) Create job (pending)
        const { data: job, error: jobErr } = await supabaseAdmin
          .from("video_jobs")
          .insert({
            user_id: userId,
            niche,
            topic,
            theme: topic, // keep legacy column in sync
            prompt,
            reference_images,
            cta,
            platform,
            quantity,
            status: "pending",
            progress: 0,
          })
          .select()
          .single();
        if (jobErr || !job) {
          return new Response(
            JSON.stringify({ error: jobErr?.message ?? "Failed to create job" }),
            { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }

        // 2) Create placeholder video rows
        const rows = Array.from({ length: quantity }).map((_, i) => ({
          user_id: userId,
          title: `${topic} #${i + 1}`,
          niche,
          theme: topic,
          platform,
          cta,
          status: "pending" as const,
        }));
        await supabaseAdmin.from("videos").insert(rows);

        await supabaseAdmin.from("automation_logs").insert({
          user_id: userId,
          job_id: job.id,
          level: "info",
          message: `Job criado via /api/generate-video (${quantity} vídeo(s))`,
          metadata: { platform, niche, images: reference_images.length },
        });

        // 3) Fire webhook to n8n (best-effort, non-blocking failure)
        const n8nUrl = process.env.N8N_WEBHOOK_URL;
        let webhookStatus: "sent" | "skipped" | "failed" = "skipped";
        if (n8nUrl) {
          try {
            const res = await fetch(n8nUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "generate_video",
                job_id: job.id,
                user_id: userId,
                niche,
                topic,
                prompt,
                reference_images,
                cta,
                platform,
                quantity,
                callback_url: `${new URL(request.url).origin}/api/public/hooks/video-progress`,
              }),
            });
            webhookStatus = res.ok ? "sent" : "failed";
            await supabaseAdmin
              .from("video_jobs")
              .update({ status: res.ok ? "processing" : "failed", progress: res.ok ? 5 : 0, error_message: res.ok ? null : `n8n returned ${res.status}` })
              .eq("id", job.id);
            await supabaseAdmin.from("automation_logs").insert({
              user_id: userId,
              job_id: job.id,
              level: res.ok ? "info" : "error",
              message: `Webhook n8n: ${webhookStatus} (${res.status})`,
            });
          } catch (e) {
            webhookStatus = "failed";
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin
              .from("video_jobs")
              .update({ status: "failed", error_message: `Webhook error: ${msg}` })
              .eq("id", job.id);
            await supabaseAdmin.from("automation_logs").insert({
              user_id: userId,
              job_id: job.id,
              level: "error",
              message: `Webhook n8n falhou: ${msg}`,
            });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, job_id: job.id, webhook: webhookStatus }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      },
    },
  },
});
