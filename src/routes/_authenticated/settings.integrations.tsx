import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Youtube,
  Instagram,
  Music2,
  Image as ImageIcon,
  Video,
  Pin,
  Flame,
  Save,
  Loader2,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  head: () => ({ meta: [{ title: "Minhas APIs — ViralFlow" }] }),
  component: UserApiKeysPage,
});

type PlatformDef = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  help: string;
  placeholder: string;
};

const PLATFORMS: PlatformDef[] = [
  {
    id: "youtube",
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    help: "Crie credenciais OAuth ou uma API Key em console.cloud.google.com.",
    placeholder: "AIza... ou token OAuth",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-500",
    help: "Gere um Access Token de longa duração na Meta for Developers.",
    placeholder: "EAA... (Access Token)",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: Music2,
    color: "text-foreground",
    help: "TikTok for Developers → seu app → token de publicação.",
    placeholder: "Access Token do TikTok",
  },
  {
    id: "kwai",
    name: "Kwai",
    icon: Video,
    color: "text-orange-500",
    help: "Painel de criador Kwai → API de publicação.",
    placeholder: "API Key do Kwai",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    icon: Pin,
    color: "text-rose-500",
    help: "developers.pinterest.com → crie um app → Access Token.",
    placeholder: "Access Token do Pinterest",
  },
  {
    id: "rumble",
    name: "Rumble",
    icon: Flame,
    color: "text-emerald-500",
    help: "Painel Rumble → API Key para upload automatizado.",
    placeholder: "API Key do Rumble",
  },
  {
    id: "pexels",
    name: "Pexels",
    icon: ImageIcon,
    color: "text-teal-400",
    help: "pexels.com/api → gere sua chave gratuita.",
    placeholder: "API Key do Pexels",
  },
];

function UserApiKeysPage() {
  const qc = useQueryClient();
  const { data: keys } = useQuery({
    queryKey: ["my-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id, provider, api_key, status");
      if (error) throw error;
      return data;
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!keys) return;
    const next: Record<string, string> = {};
    keys.forEach((k) => {
      next[k.provider] = k.api_key ?? "";
    });
    setValues((prev) => ({ ...next, ...prev }));
  }, [keys]);

  const saveKey = async (provider: string) => {
    const value = (values[provider] ?? "").trim();
    if (!value) {
      toast.error("Cole a chave antes de salvar.");
      return;
    }
    setSaving(provider);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sessão expirada.");
        return;
      }
      const existing = keys?.find((k) => k.provider === provider);
      if (existing) {
        const { error } = await supabase
          .from("api_keys")
          .update({ api_key: value, status: "active" })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("api_keys").insert({
          user_id: u.user.id,
          provider,
          api_key: value,
          status: "active",
        });
        if (error) throw error;
      }
      toast.success(`${provider} salvo.`);
      qc.invalidateQueries({ queryKey: ["my-api-keys"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(null);
    }
  };

  const removeKey = async (provider: string) => {
    const existing = keys?.find((k) => k.provider === provider);
    if (!existing) return;
    const { error } = await supabase.from("api_keys").delete().eq("id", existing.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Chave removida.");
      setValues((prev) => ({ ...prev, [provider]: "" }));
      qc.invalidateQueries({ queryKey: ["my-api-keys"] });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Minhas APIs"
        subtitle="Cole as chaves das SUAS contas — usaremos para publicar no seu nome."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => {
          const existing = keys?.find((k) => k.provider === p.id);
          const connected = !!existing?.api_key;
          return (
            <Card key={p.id} className="p-5 bg-gradient-surface border-border/60 shadow-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-lg bg-background/60 grid place-items-center shrink-0">
                    <p.icon className={`size-5 ${p.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.help}</div>
                  </div>
                </div>
                {connected && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="size-3 mr-1" /> Ativa
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`k-${p.id}`} className="text-xs">
                  API Key / Access Token
                </Label>
                <PasswordInput
                  id={`k-${p.id}`}
                  placeholder={p.placeholder}
                  value={values[p.id] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveKey(p.id)}
                    disabled={saving === p.id}
                    className="bg-gradient-primary shadow-glow flex-1"
                  >
                    {saving === p.id ? (
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5 mr-1.5" />
                    )}
                    Salvar
                  </Button>
                  {connected && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeKey(p.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 border-primary/20 bg-primary/5 text-sm">
        <strong>Segurança:</strong> suas chaves são privadas (RLS no banco) — só
        você e o pipeline de publicação têm acesso.
      </Card>
    </div>
  );
}
