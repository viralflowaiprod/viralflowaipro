import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Repeat, Save, Shield, Sparkles, CalendarRange } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAutomationSettings,
  getProductionPlan,
  saveAutomationSettings,
  setAutomationPaused,
  updatePrivacyMode,
} from "@/lib/automation.functions";

import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automação — ViralFlow" }] }),
  component: AutomationPage,
});

const ALL_PLATFORMS = ["youtube", "instagram", "tiktok", "pinterest"] as const;

function AutomationPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getAutomationSettings);
  const saveFn = useServerFn(saveAutomationSettings);
  const pauseFn = useServerFn(setAutomationPaused);
  const privFn = useServerFn(updatePrivacyMode);

  const { data, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => getFn(),
  });

  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [continuousMonthly, setContinuousMonthly] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [seedIdea, setSeedIdea] = useState("");
  const [dailyQuantity, setDailyQuantity] = useState(8);
  const [niche, setNiche] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([...ALL_PLATFORMS]);
  const [slotsText, setSlotsText] = useState("08:00,10:00,12:00,14:00,16:00,18:00,20:00,22:00");
  const [privacy, setPrivacy] = useState<"save_all" | "ephemeral">("save_all");
  const [saving, setSaving] = useState(false);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    if (!data) return;
    const d = data as Record<string, unknown>;
    setEnabled(!!d.enabled);
    setPaused(!!d.paused);
    setContinuousMonthly(!!d.continuous_monthly);
    setMode((d.mode as "auto" | "manual") ?? "auto");
    setSeedIdea((d.seed_idea as string | null) ?? "");
    setDailyQuantity((d.daily_quantity as number) ?? 8);
    setNiche((d.niche as string | null) ?? "");
    setPlatforms(Array.isArray(d.platforms) ? (d.platforms as string[]) : [...ALL_PLATFORMS]);
    setSlotsText(
      Array.isArray(d.time_slots) ? (d.time_slots as string[]).join(",") : slotsText,
    );
  }, [data]);


  useEffect(() => {
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("privacy_mode")
        .eq("id", u.user.id)
        .maybeSingle();
      if (prof?.privacy_mode === "ephemeral" || prof?.privacy_mode === "save_all") {
        setPrivacy(prof.privacy_mode);
      }
    };
    load();
  }, []);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const slots = slotsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!slots.every((s) => /^\d{2}:\d{2}$/.test(s))) {
        toast.error("Horários inválidos. Use formato HH:MM separado por vírgula.");
        return;
      }
      if (platforms.length === 0) {
        toast.error("Selecione ao menos uma plataforma.");
        return;
      }
      await saveFn({
        data: {
          enabled,
          paused,
          continuous_monthly: continuousMonthly,
          mode,
          daily_quantity: dailyQuantity,
          platforms,
          time_slots: slots,
          niche: niche.trim() || null,
          seed_idea: seedIdea.trim() || null,
        },
      });
      await privFn({ data: { privacy_mode: privacy } });
      await qc.invalidateQueries({ queryKey: ["automation-settings"] });
      toast.success("Configurações salvas!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    setPausing(true);
    try {
      const next = !paused;
      await pauseFn({ data: { paused: next } });
      setPaused(next);
      await qc.invalidateQueries({ queryKey: ["automation-settings"] });
      toast.success(
        next
          ? "Produção pausada. Os vídeos em andamento serão finalizados; novos não iniciarão."
          : "Produção retomada.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar pausa.");
    } finally {
      setPausing(false);
    }
  };


  if (isLoading) {
    return (
      <div className="p-10 grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Automação"
        subtitle="Configure publicação automática diária em todas as suas redes"
      />

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-semibold flex items-center gap-2">
              <Repeat className="size-4 text-primary-glow" /> Automação diária
              {paused && <Badge variant="secondary">Pausada</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativada, o ViralFlow gera e publica vídeos automaticamente.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <Button
          type="button"
          variant={paused ? "default" : "outline"}
          onClick={togglePause}
          disabled={pausing}
          className={paused ? "w-full bg-gradient-primary shadow-glow" : "w-full"}
        >
          {pausing ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : paused ? (
            <Play className="size-4 mr-2" />
          ) : (
            <Pause className="size-4 mr-2" />
          )}
          {paused ? "Retomar produção" : "Pausar produção"}
        </Button>
        <p className="text-xs text-muted-foreground -mt-2">
          Ao pausar: finaliza o vídeo atual, conclui o upload em andamento e mantém a fila salva para retomar depois.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Modo de produção</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual — preencho cada vídeo</SelectItem>
                <SelectItem value="auto">Produção Automática — IA continua a partir da minha ideia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Vídeos por dia (até 80)</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={80}
              value={dailyQuantity}
              onChange={(e) =>
                setDailyQuantity(Math.max(1, Math.min(80, Number(e.target.value) || 1)))
              }
            />
          </div>
        </div>

        {mode === "auto" && (
          <div className="space-y-2">
            <Label htmlFor="seed" className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary-glow" />
              Primeira ideia (semente)
            </Label>
            <Textarea
              id="seed"
              rows={3}
              placeholder="Ex: vídeos de curiosidades históricas com tom misterioso e narração curta"
              value={seedIdea}
              onChange={(e) => setSeedIdea(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A IA usa essa ideia como contexto e gera automaticamente os próximos vídeos mantendo o mesmo nicho e estratégia.
            </p>
          </div>
        )}

        <div className="flex items-start justify-between rounded-lg border border-border/60 p-3">
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              <CalendarRange className="size-4 text-primary-glow" /> Produção contínua mensal
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Após agendar os vídeos do dia, continua produzindo e agendando para os próximos dias até completar o mês.
            </p>
          </div>
          <Switch checked={continuousMonthly} onCheckedChange={setContinuousMonthly} />
        </div>


        <div className="space-y-2">
          <Label htmlFor="niche">Nicho padrão</Label>
          <Input
            id="niche"
            placeholder="Ex: curiosidades, produtividade, finanças"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Plataformas</Label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const active = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-glow"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slots">Horários (HH:MM separados por vírgula)</Label>
          <Input
            id="slots"
            placeholder="08:00,12:00,18:00"
            value={slotsText}
            onChange={(e) => setSlotsText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            O sistema distribui os vídeos diários nesses horários.
          </p>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card space-y-4">
        <div className="font-display font-semibold flex items-center gap-2">
          <Shield className="size-4 text-primary-glow" /> Privacidade dos dados
        </div>
        <div className="space-y-2">
          <Label>Modo</Label>
          <Select value={privacy} onValueChange={(v) => setPrivacy(v as "save_all" | "ephemeral")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="save_all">Salvar tudo (padrão)</SelectItem>
              <SelectItem value="ephemeral">Efêmero (apaga após 24h)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            No modo efêmero, vídeos e mídias são apagados automaticamente após a publicação.
          </p>
          {privacy === "ephemeral" && (
            <Badge variant="secondary" className="mt-1">Limpeza automática em 24h</Badge>
          )}
        </div>
      </Card>

      <Button
        onClick={save}
        disabled={saving}
        className="w-full bg-gradient-primary shadow-glow"
      >
        {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
        Salvar configurações
      </Button>
    </div>
  );
}
