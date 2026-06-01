import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Youtube, Instagram, Music2, CheckCircle2, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  head: () => ({ meta: [{ title: "Conectar redes — ViralFlow" }] }),
  component: UserIntegrationsPage,
});

const platforms = [
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    desc: "Publique Shorts e vídeos longos automaticamente.",
    color: "text-red-500",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    desc: "Poste Reels, carrosséis e imagens via OAuth oficial.",
    color: "text-pink-500",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Music2,
    desc: "Envie vídeos verticais direto para sua conta TikTok.",
    color: "text-foreground",
  },
] as const;

function UserIntegrationsPage() {
  const qc = useQueryClient();

  const { data: accounts } = useQuery({
    queryKey: ["my-connected-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connected_accounts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const connect = (platformId: string) => {
    // OAuth oficial será disparado aqui assim que as credenciais estiverem configuradas
    // no painel admin (Client ID/Secret de YouTube, Instagram e TikTok).
    toast.info(
      `Conexão com ${platformId} via OAuth oficial será habilitada em breve. ` +
        `Nenhuma chave técnica será solicitada — basta autorizar sua conta.`,
    );
  };

  const disconnect = async (id: string) => {
    const { error } = await supabase.from("connected_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Conta desconectada");
      qc.invalidateQueries({ queryKey: ["my-connected-accounts"] });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Conectar redes sociais"
        subtitle="Autorize suas contas via OAuth oficial. Nada de API keys."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((p) => {
          const connected = accounts?.find((a) => a.platform === p.id);
          return (
            <Card key={p.id} className="p-5 bg-gradient-surface border-border/60 shadow-card">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-background/60 grid place-items-center">
                    <p.icon className={`size-5 ${p.color}`} />
                  </div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                  </div>
                </div>
                {connected && (
                  <Badge className="bg-success/20 text-success border-success/30">
                    <CheckCircle2 className="size-3 mr-1" /> Conectado
                  </Badge>
                )}
              </div>

              {connected ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {connected.account_name ?? "Conta autorizada"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => disconnect(connected.id)}>
                    <Trash2 className="size-4 mr-2" /> Desconectar
                  </Button>
                </div>
              ) : (
                <Button onClick={() => connect(p.id)} className="w-full bg-gradient-primary shadow-glow">
                  <Link2 className="size-4 mr-2" /> Conectar {p.name}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-5 border-primary/20 bg-primary/5">
        <p className="text-sm">
          <strong>100% SaaS.</strong> Toda configuração técnica (Gemini, OpenAI, ElevenLabs, Pexels,
          FFmpeg, n8n) é gerenciada pela ViralFlow. Você só conecta suas redes e publica.
        </p>
      </Card>
    </div>
  );
}
