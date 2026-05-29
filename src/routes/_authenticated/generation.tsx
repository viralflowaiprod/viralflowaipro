import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, PlayCircle, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/generation")({
  head: () => ({ meta: [{ title: "Processamento — ViralFlow" }] }),
  component: GenerationPage,
});

type Job = {
  id: string;
  niche: string | null;
  topic: string | null;
  theme: string | null;
  platform: string | null;
  status: string;
  progress: number;
  quantity: number;
  error_message: string | null;
  created_at: string;
};

type Video = {
  id: string;
  title: string;
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  platform: string | null;
  created_at: string;
};

const statusColor: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  queued: "bg-muted text-muted-foreground",
  processing: "bg-primary/20 text-primary-glow",
  completed: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-destructive/20 text-destructive",
};

function GenerationPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      setUserId(u.user.id);
      const [{ data: js }, { data: vs }] = await Promise.all([
        supabase
          .from("video_jobs")
          .select("id,niche,topic,theme,platform,status,progress,quantity,error_message,created_at")
          .eq("user_id", u.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("videos")
          .select("id,title,status,video_url,thumbnail_url,platform,created_at")
          .eq("user_id", u.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (!cancelled) {
        setJobs((js ?? []) as Job[]);
        setVideos((vs ?? []) as Video[]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`generation:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_jobs", filter: `user_id=eq.${userId}` },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as Job, ...prev].slice(0, 20);
            if (payload.eventType === "DELETE")
              return prev.filter((j) => j.id !== (payload.old as Job).id);
            return prev.map((j) => (j.id === (payload.new as Job).id ? (payload.new as Job) : j));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos", filter: `user_id=eq.${userId}` },
        (payload) => {
          setVideos((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as Video, ...prev].slice(0, 20);
            if (payload.eventType === "DELETE")
              return prev.filter((v) => v.id !== (payload.old as Video).id);
            return prev.map((v) => (v.id === (payload.new as Video).id ? (payload.new as Video) : v));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const triggerTest = async () => {
    setSending(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada.");
        return;
      }
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          niche: "Curiosidades",
          topic: "3 fatos surpreendentes sobre o oceano",
          cta: "Segue para mais!",
          platform: "youtube",
          quantity: 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Falha ao disparar pipeline");
        return;
      }
      if (json.webhook === "skipped") {
        toast.success("Job criado. (n8n ainda não configurado — defina N8N_WEBHOOK_URL)");
      } else if (json.webhook === "sent") {
        toast.success("Pipeline disparado para o n8n!");
      } else {
        toast.warning("Job criado, mas o webhook n8n falhou. Veja os logs.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSending(false);
    }
  };

  const active = jobs.filter((j) => j.status === "pending" || j.status === "queued" || j.status === "processing");
  const completedVideos = videos.filter((v) => v.status === "completed" || v.video_url);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <PageHeader
        title="Processamento"
        subtitle="Acompanhe seus jobs em tempo real"
        action={
          <Button onClick={triggerTest} disabled={sending} className="bg-gradient-primary shadow-glow">
            {sending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Zap className="size-4 mr-2" />}
            Gerar Vídeo Teste
          </Button>
        }
      />

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2">
          <Activity className="size-4 text-primary-glow" /> Jobs ativos
          <span className="text-xs text-muted-foreground">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground bg-gradient-surface border-border/60">
            Nenhum job em andamento. Use o botão acima para disparar um teste.
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((j) => (
              <Card key={j.id} className="p-4 bg-gradient-surface border-border/60">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{j.topic ?? j.theme ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.niche} · {j.platform} · {j.quantity}x
                    </div>
                  </div>
                  <Badge className={statusColor[j.status] ?? statusColor.pending}>{j.status}</Badge>
                </div>
                <Progress value={j.progress} className="h-1.5" />
                {j.error_message && (
                  <div className="mt-2 text-xs text-destructive flex items-center gap-1">
                    <XCircle className="size-3" /> {j.error_message}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-400" /> Vídeos concluídos
          <span className="text-xs text-muted-foreground">({completedVideos.length})</span>
        </h2>
        {completedVideos.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground bg-gradient-surface border-border/60">
            Os vídeos aparecerão aqui assim que o n8n retornar a URL final.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedVideos.map((v) => (
              <Card key={v.id} className="overflow-hidden bg-gradient-surface border-border/60">
                <div className="aspect-[9/16] bg-muted relative">
                  {v.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="grid place-items-center h-full text-muted-foreground">
                      <PlayCircle className="size-10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground">{v.platform}</div>
                  {v.video_url && (
                    <a
                      href={v.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary-glow mt-1 inline-block"
                    >
                      Abrir vídeo →
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
