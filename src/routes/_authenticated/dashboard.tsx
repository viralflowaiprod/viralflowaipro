import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Loader2, Video } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ViralFlow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [videos, jobs, scheduled, accounts] = await Promise.all([
        supabase.from("videos").select("id, status", { count: "exact" }),
        supabase.from("video_jobs").select("id, status").in("status", ["queued", "processing"]),
        supabase.from("scheduled_posts").select("id").eq("status", "scheduled"),
        supabase.from("connected_accounts").select("id, platform"),
      ]);
      return {
        totalVideos: videos.count ?? 0,
        posted: (videos.data ?? []).filter((v) => v.status === "posted").length,
        queued: jobs.data?.length ?? 0,
        scheduled: scheduled.data?.length ?? 0,
        accounts: accounts.data?.length ?? 0,
      };
    },
  });

  const stats = [
    { icon: Video, label: "Vídeos gerados", value: data?.totalVideos ?? 0, color: "text-primary-glow" },
    { icon: CheckCircle2, label: "Postados", value: data?.posted ?? 0, color: "text-success" },
    { icon: Loader2, label: "Na fila", value: data?.queued ?? 0, color: "text-warning" },
    { icon: Calendar, label: "Agendados", value: data?.scheduled ?? 0, color: "text-primary-glow" },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" subtitle="Visão geral da sua máquina de conteúdo" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-6 bg-gradient-surface border-border/60 shadow-card">
            <div className={`size-10 rounded-lg bg-accent/40 grid place-items-center mb-3 ${s.color}`}>
              <s.icon className="size-5" />
            </div>
            <div className="text-3xl font-display font-semibold">{s.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
          <h3 className="font-display font-semibold mb-1">Plataformas conectadas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {data?.accounts ?? 0} conta(s) ativa(s)
          </p>
          <p className="text-xs text-muted-foreground">
            Conecte YouTube, Instagram e TikTok em <strong>Contas</strong> para publicar automaticamente.
          </p>
        </Card>
        <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
          <h3 className="font-display font-semibold mb-1">Próximo passo</h3>
          <p className="text-sm text-muted-foreground">
            Vá para o <strong>Gerador</strong> e crie seu primeiro lote de vídeos virais com IA.
          </p>
        </Card>
      </div>
    </div>
  );
}
