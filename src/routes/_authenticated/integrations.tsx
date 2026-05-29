import { createFileRoute } from "@tanstack/react-router";
import { Webhook, Sparkles, Image as ImageIcon, Music2, Video, Share2, Lock } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações — ViralFlow" }] }),
  component: IntegrationsPage,
});

const integrations = [
  { icon: Webhook, name: "n8n Webhook", desc: "Orquestração de geração de vídeo via workflows.", status: "Aguardando URL" },
  { icon: Sparkles, name: "Google Gemini", desc: "Geração de roteiros, hooks e títulos virais.", status: "Aguardando chave" },
  { icon: ImageIcon, name: "Pexels", desc: "Banco de imagens/vídeos stock para B-roll.", status: "Aguardando chave" },
  { icon: Music2, name: "ElevenLabs", desc: "Voz IA realista para narração.", status: "Aguardando chave" },
  { icon: Video, name: "Creatomate / Shotstack", desc: "Renderização programática de vídeo.", status: "Aguardando chave" },
  { icon: Share2, name: "TikTok / Instagram / YouTube", desc: "Postagem automática nas plataformas.", status: "Aguardando OAuth" },
];

function IntegrationsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader
        title="Integrações"
        subtitle="Conecte ferramentas externas para ativar geração e distribuição automática"
      />

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
