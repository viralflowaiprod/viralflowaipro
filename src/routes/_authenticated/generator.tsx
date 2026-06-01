import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Wand2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { n8nService } from "@/lib/n8n-service";

export const Route = createFileRoute("/_authenticated/generator")({
  head: () => ({ meta: [{ title: "Gerador — ViralFlow" }] }),
  component: Generator,
});

type ResultState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: unknown }
  | { kind: "error"; message: string };

function Generator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [contentType, setContentType] = useState("short_video");
  const [tone, setTone] = useState("inspirador");
  const [language, setLanguage] = useState("pt-BR");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult({ kind: "loading" });

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setResult({ kind: "error", message: "Sessão expirada. Faça login novamente." });
      return;
    }

    const res = await n8nService.generateContent({
      topic,
      platform,
      contentType,
      tone,
      language,
      userId: u.user.id,
    });

    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível gerar o conteúdo.");
      setResult({ kind: "error", message: res.error ?? "Erro desconhecido." });
      return;
    }

    toast.success("Conteúdo recebido do n8n!");
    setResult({ kind: "success", data: res.data });
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <PageHeader title="Gerador" subtitle="Crie conteúdo viral com IA — totalmente automatizado" />

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="topic">Tópico</Label>
            <Input
              id="topic"
              required
              placeholder="Ex: rotina matinal de pessoas produtivas"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="pinterest">Pinterest</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_video">Vídeo curto</SelectItem>
                  <SelectItem value="reel_script">Roteiro de Reels</SelectItem>
                  <SelectItem value="tiktok_script">Roteiro TikTok</SelectItem>
                  <SelectItem value="carousel">Carrossel</SelectItem>
                  <SelectItem value="post_image">Post (imagem)</SelectItem>
                  <SelectItem value="caption">Legenda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tom de voz</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inspirador">Inspirador</SelectItem>
                  <SelectItem value="divertido">Divertido</SelectItem>
                  <SelectItem value="educativo">Educativo</SelectItem>
                  <SelectItem value="provocativo">Provocativo</SelectItem>
                  <SelectItem value="profissional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es-ES">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={result.kind === "loading"}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {result.kind === "loading" ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Gerando conteúdo...</>
            ) : (
              <><Wand2 className="size-4 mr-2" /> Gerar conteúdo</>
            )}
          </Button>
        </form>
      </Card>

      {result.kind === "success" && (
        <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
          <div className="flex items-center gap-2 mb-3 text-success">
            <CheckCircle2 className="size-5" />
            <h3 className="font-display font-semibold">Conteúdo gerado</h3>
          </div>
          <pre className="text-xs bg-background/60 border border-border/40 rounded-lg p-4 overflow-auto whitespace-pre-wrap max-h-[480px]">
{typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
          </pre>
        </Card>
      )}

      {result.kind === "error" && (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Não foi possível gerar agora</h3>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Verifique se o workflow no n8n está ativo. Tente novamente em instantes.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
