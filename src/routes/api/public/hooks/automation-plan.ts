import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computePlan } from "@/lib/automation.functions";

/**
 * Public hook consumed by n8n (or any orchestrator) to know, per user:
 *  - whether production is paused
 *  - how many videos can still be produced today
 *  - exactly which day+time slots are free to fill next
 *
 * Does NOT modify any existing pipeline, route, or table. Read-only.
 */
const Q = z.object({ user_id: z.string().uuid() });

export const Route = createFileRoute("/api/public/hooks/automation-plan")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = Q.safeParse({ user_id: url.searchParams.get("user_id") });
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "user_id required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const plan = await computePlan(
          supabaseAdmin as unknown as { from: typeof supabaseAdmin.from },
          parsed.data.user_id,
        );
        return new Response(JSON.stringify({ ok: true, ...plan }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
