import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Agendamento — ViralFlow" }] }),
  component: Schedule,
});

function Schedule() {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [platform, setPlatform] = useState("youtube");
  const [caption, setCaption] = useState("");

  const { data: scheduled } = useQuery({
    queryKey: ["scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const scheduledFor = new Date(`${date}T${time}`).toISOString();
    const { error } = await supabase.from("scheduled_posts").insert({
      user_id: u.user.id,
      scheduled_for: scheduledFor,
      platform,
      caption,
      status: "scheduled",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Agendamento criado!");
      setDate(""); setTime(""); setCaption("");
      qc.invalidateQueries({ queryKey: ["scheduled"] });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <PageHeader title="Agendamento" subtitle="Programe postagens automáticas" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
          <h3 className="font-display font-semibold mb-4">Novo agendamento</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d">Data</Label>
                <Input id="d" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t">Hora</Label>
                <Input id="t" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c">Legenda</Label>
              <Input id="c" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary shadow-glow">
              <Calendar className="size-4 mr-2" /> Agendar
            </Button>
          </form>
        </Card>

        <Card className="p-6 bg-gradient-surface border-border/60 shadow-card">
          <h3 className="font-display font-semibold mb-4">Próximos posts</h3>
          {!scheduled?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
          ) : (
            <ul className="space-y-3">
              {scheduled.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{new Date(s.scheduled_for).toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-muted-foreground">{s.caption || "Sem legenda"}</div>
                  </div>
                  <Badge>{s.platform}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
