import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/generator")({
  head: () => ({ meta: [{ title: "Gerador — ViralFlow" }] }),
  component: Generator,
});

function Generator() {
  const navigate = useNavigate();
  const [niche, setNiche] = useState("");
  const [theme, setTheme] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [quantity, setQuantity] = useState(5);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: job, error } = await supabase
      .from("video_jobs")
      .insert({ user_id: u.user.id, niche, theme, cta, platform, quantity, status: "queued" })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Create placeholder video records
    const rows = Array.from({ length: quantity }).map((_, i) => ({
      user_id: u.user!.id,
      title: `${theme || niche} #${i + 1}`,
      niche,
      theme,
      platform,
      cta,
      status: "pending" as const,
    }));
    await supabase.from("videos").insert(rows);
    await supabase.from("automation_logs").insert({
      user_id: u.user.id,
      job_id: job.id,
      level: "info",
      message: `Job criado: ${quantity} vídeo(s) na fila`,
    });

    toast.success(`${quantity} vídeo(s) enfileirado(s)!`);
    setLoading(false);
    navigate({ to: "/history" });
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <PageHeader title="Gerador" subtitle="Crie um lote de vídeos virais com IA" />
      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input id="niche" required placeholder="Fitness, finanças..." value={niche} onChange={(e) => setNiche(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Plataforma destino</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube Shorts</SelectItem>
                  <SelectItem value="instagram">Instagram Reels</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">Tema</Label>
            <Textarea id="theme" required placeholder="Sobre o que serão os vídeos?" value={theme} onChange={(e) => setTheme(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cta">CTA final</Label>
            <Input id="cta" placeholder="Segue para mais!" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Quantidade ({quantity})</Label>
            <Input id="qty" type="range" min={1} max={30} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
            <Wand2 className="size-4 mr-2" />
            {loading ? "Enfileirando..." : "Gerar conteúdo"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
