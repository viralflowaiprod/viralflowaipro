import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Webhook, Sparkles, Image as ImageIcon, Music2, Video, Share2, Lock, ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações da plataforma — ViralFlow" }] }),
  component: IntegrationsPage,
});

const integrations = [
  { icon: Sparkles, name: "OpenAI", desc: "GPT — geração de roteiros e textos.", status: "Aguardando chave" },
  { icon: Sparkles, name: "Anthropic Claude", desc: "Roteiros longos e raciocínio avançado.", status: "Aguardando chave" },
  { icon: Sparkles, name: "Google Gemini", desc: "Roteiros, hooks e títulos virais.", status: "Aguardando chave" },
  { icon: ImageIcon, name: "Pexels", desc: "Banco de imagens/vídeos stock para B-roll.", status: "Aguardando chave" },
  { icon: Music2, name: "Edge TTS", desc: "Síntese de voz nativa (Microsoft Edge).", status: "Pronto" },
  { icon: Music2, name: "ElevenLabs", desc: "Voz IA realista premium.", status: "Aguardando chave" },
  { icon: Video, name: "FFmpeg", desc: "Renderização/edição de vídeo server-side.", status: "Pronto" },
  { icon: Webhook, name: "n8n", desc: "Orquestração de todos os workflows.", status: "Conectado" },
  { icon: Share2, name: "Supabase", desc: "Banco, auth e storage da plataforma.", status: "Conectado" },
];

function IntegrationsPage() {
  const checkAdmin = useServerFn(checkIsAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkAdmin() });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }


  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="Integrações da plataforma"
        subtitle="Painel admin — credenciais técnicas centralizadas. Usuários finais nunca veem isso."
      />

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex items-start gap-3">
        <ShieldAlert className="size-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Área restrita — apenas administradores</p>
          <p className="text-muted-foreground">Essas chaves alimentam toda a plataforma. Usuários não precisam configurar nada.</p>
        </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => (
          <div key={i.name} className="rounded-xl border border-border/60 bg-gradient-surface p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 grid place-items-center">
                  <i.icon className="size-5 text-primary-glow" />
                </div>
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.desc}</div>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                <Lock className="size-3 mr-1" /> {i.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm">
        <p className="font-medium mb-1">Como ativar</p>
        <p className="text-muted-foreground">
          Quando você obtiver as credenciais de cada serviço, me envie por aqui. Eu plugo as chaves de forma segura (como secret server-side) e ativo a integração — sem expor nada no frontend.
        </p>
      </div>
    </div>
  );
}
