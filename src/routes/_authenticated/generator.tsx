import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Wand2, Loader2, ImagePlus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/generator")({
  head: () => ({ meta: [{ title: "Gerador — ViralFlow" }] }),
  component: Generator,
});

const MAX_IMAGES = 6;

function Generator() {
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [quantity, setQuantity] = useState(1);
  const [images, setImages] = useState<{ path: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onPickImages = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens.`);
      return;
    }
    const picked = files.slice(0, room);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sessão expirada.");
      return;
    }
    setUploading(true);
    const uploaded: { path: string; url: string }[] = [];
    try {
      for (const file of picked) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} excede 8MB.`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${u.user.id}/refs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("user-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: signed } = await supabase.storage
          .from("user-media")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) uploaded.push({ path, url: signed.signedUrl });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (idx: number) => {
    const target = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (target?.path) {
      await supabase.storage.from("user-media").remove([target.path]);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !niche.trim()) {
      toast.error("Preencha nicho e tópico.");
      return;
    }
    setSubmitting(true);
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
          niche,
          topic,
          prompt,
          cta,
          platform,
          quantity,
          reference_images: images.map((i) => i.url),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Falha ao disparar geração.");
        return;
      }
      toast.success(
        json.webhook === "sent"
          ? "Pipeline disparado! Acompanhe em Processamento."
          : "Job criado. (n8n indisponível — verifique o webhook.)",
      );
      setPrompt("");
      setImages([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Gerador"
        subtitle="Descreva o vídeo, envie referências e dispare o pipeline automatizado"
      />

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input
                id="niche"
                required
                placeholder="Ex: produtividade, curiosidades"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic">Tópico / título</Label>
              <Input
                id="topic"
                required
                placeholder="Ex: 3 hábitos de quem acorda às 5h"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt" className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary-glow" />
              Prompt do vídeo
            </Label>
            <Textarea
              id="prompt"
              rows={5}
              placeholder="Descreva como deve ser o vídeo: roteiro, estilo visual, narração, ritmo, mood…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Quanto mais detalhado, melhor o resultado da IA.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ImagePlus className="size-4 text-primary-glow" />
                Imagens de referência
              </span>
              <span className="text-xs text-muted-foreground">
                {images.length}/{MAX_IMAGES}
              </span>
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {images.map((img, idx) => (
                <div
                  key={img.path}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border/60 group"
                >
                  <img src={img.url} alt={`ref ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 size-6 rounded-full bg-background/80 grid place-items-center opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remover"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="aspect-square rounded-lg border border-dashed border-border/60 grid place-items-center cursor-pointer hover:bg-muted/30 transition">
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" />
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={onPickImages}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Até {MAX_IMAGES} imagens (máx 8MB cada). Armazenadas de forma privada.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube Shorts</SelectItem>
                  <SelectItem value="instagram">Instagram Reels</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="pinterest">Pinterest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Quantidade</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cta">CTA (opcional)</Label>
              <Input
                id="cta"
                placeholder="Segue para mais!"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || uploading}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {submitting ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Disparando pipeline...</>
            ) : (
              <><Wand2 className="size-4 mr-2" /> Gerar vídeo</>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
