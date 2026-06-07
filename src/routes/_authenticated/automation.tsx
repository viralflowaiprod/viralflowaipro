import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Repeat, Save, Shield } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  saveAutomationSettings,
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
  const privFn = useServerFn(updatePrivacyMode);

  const { data, isLoading } = useQuery({
    queryKey: ["automation-settings"],
    queryFn: () => getFn(),
  });

  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [dailyQuantity, setDailyQuantity] = useState(36);
  const [niche, setNiche] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([...ALL_PLATFORMS]);
  const [slotsText, setSlotsText] = useState("08:00,10:00,12:00,14:00,16:00,18:00,20:00,22:00");
  const [privacy, setPrivacy] = useState<"save_all" | "ephemeral">("save_all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(!!data.enabled);
    setMode((data.mode as "auto" | "manual") ?? "auto");
    setDailyQuantity(data.daily_quantity ?? 36);
    setNiche(data.niche ?? "");
    setPlatforms(Array.isArray(data.platforms) ? (data.platforms as string[]) : [...ALL_PLATFORMS]);
    setSlotsText(
      Array.isArray(data.time_slots) ? (data.time_slots as string[]).join(",") : slotsText,
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
          mode,
          daily_quantity: dailyQuantity,
          platforms,
          time_slots: slots,
          niche: niche.trim() || null,
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
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativada, o ViralFlow gera e publica vídeos automaticamente.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (gera e publica)</SelectItem>
                <SelectItem value="manual">Manual (gera, você aprova)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Vídeos por dia</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={100}
              value={dailyQuantity}
              onChange={(e) =>
                setDailyQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
            />
          </div>
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
