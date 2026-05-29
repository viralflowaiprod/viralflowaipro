import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Contas & APIs — ViralFlow" }] }),
  component: Accounts,
});

function Accounts() {
  const qc = useQueryClient();
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [limit, setLimit] = useState(60);

  const { data: keys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connected_accounts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const addKey = async (e: FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("api_keys").insert({
      user_id: u.user.id, provider, api_key: apiKey, daily_limit: limit,
    });
    if (error) toast.error(error.message);
    else { toast.success("API key adicionada"); setApiKey(""); qc.invalidateQueries({ queryKey: ["api-keys"] }); }
  };

  const removeKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["api-keys"] });
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <PageHeader title="Contas & APIs" subtitle="Gerencie API keys e contas conectadas" />

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <h3 className="font-display font-semibold mb-4">Adicionar API Key</h3>
        <form onSubmit={addKey} className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="pexels">Pexels</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="k">API Key</Label>
            <Input id="k" required value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="l">Limite diário</Label>
            <Input id="l" type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <Button type="submit" className="bg-gradient-primary shadow-glow sm:col-span-4">
            <Plus className="size-4 mr-2" /> Adicionar
          </Button>
        </form>

        <div className="mt-6 space-y-2">
          {keys?.map((k) => (
            <div key={k.id} className="flex items-center justify-between border border-border/40 rounded-lg px-4 py-3">
              <div>
                <div className="font-medium text-sm capitalize">{k.provider}</div>
                <div className="text-xs text-muted-foreground">
                  Uso: {k.current_usage}/{k.daily_limit ?? "∞"} · <span className="font-mono">…{k.api_key.slice(-6)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={k.status === "active" ? "bg-success/20 text-success" : "bg-muted"}>{k.status}</Badge>
                <Button size="icon" variant="ghost" onClick={() => removeKey(k.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
        <h3 className="font-display font-semibold mb-2">Plataformas conectadas</h3>
        <p className="text-sm text-muted-foreground mb-4">
          OAuth para YouTube, Instagram e TikTok será habilitado quando você conectar o n8n.
        </p>
        {!accounts?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta conectada ainda.</p>
        ) : (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="flex justify-between border border-border/40 rounded-lg px-4 py-3">
                <span className="capitalize">{a.platform} — {a.account_name}</span>
                <Badge>{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
