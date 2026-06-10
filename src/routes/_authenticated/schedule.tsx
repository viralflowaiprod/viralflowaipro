import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Agendamento — ViralFlow" }] }),
  component: Schedule,
});

const MAX_PER_DAY = 80;
const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00",
  "20:00", "21:00",
];

function toLocalISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Schedule() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: scheduled } = useQuery({
    queryKey: ["scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("id, scheduled_for, platform, caption, status, video_id")
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: readyVideos } = useQuery({
    queryKey: ["ready-videos-for-schedule"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, platform, video_url, created_at, status")
        .eq("status", "completed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const countsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    scheduled?.forEach((s) => {
      const d = toLocalISODate(new Date(s.scheduled_for));
      map[d] = (map[d] ?? 0) + 1;
    });
    return map;
  }, [scheduled]);

  // Calendar grid for current cursor month
  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date | null; iso: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      cells.push({ date: d, iso: toLocalISODate(d) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = toLocalISODate(new Date());

  const findNextSlot = (existing: Set<string>) => {
    // Start at tomorrow morning, find first day with < MAX_PER_DAY and first free slot
    const start = new Date();
    start.setDate(start.getDate() + 1);
    for (let i = 0; i < 60; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toLocalISODate(d);
      if ((countsByDay[iso] ?? 0) >= MAX_PER_DAY) continue;
      for (const t of TIME_SLOTS) {
        const slot = `${iso}T${t}:00`;
        if (!existing.has(slot)) return new Date(slot);
      }
    }
    return null;
  };

  const autoSchedule = async () => {
    if (!readyVideos?.length) {
      toast.info("Nenhum vídeo pronto para agendar.");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const existing = new Set(
      (scheduled ?? []).map((s) => {
        const d = new Date(s.scheduled_for);
        const iso = toLocalISODate(d);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${iso}T${hh}:${mm}:00`;
      }),
    );
    const localCounts = { ...countsByDay };
    const alreadyScheduledVideoIds = new Set(
      (scheduled ?? []).map((s) => s.video_id).filter(Boolean) as string[],
    );

    const toInsert: Array<{
      user_id: string;
      video_id: string;
      scheduled_for: string;
      platform: string;
      caption: string | null;
      status: string;
    }> = [];

    for (const v of readyVideos) {
      if (alreadyScheduledVideoIds.has(v.id)) continue;
      // find slot
      const slotDate = (() => {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        for (let i = 0; i < 60; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const iso = toLocalISODate(d);
          if ((localCounts[iso] ?? 0) >= MAX_PER_DAY) continue;
          for (const t of TIME_SLOTS) {
            const slotKey = `${iso}T${t}:00`;
            if (!existing.has(slotKey)) {
              existing.add(slotKey);
              localCounts[iso] = (localCounts[iso] ?? 0) + 1;
              return new Date(slotKey);
            }
          }
        }
        return null;
      })();
      if (!slotDate) break;
      toInsert.push({
        user_id: u.user.id,
        video_id: v.id,
        scheduled_for: slotDate.toISOString(),
        platform: v.platform ?? "youtube",
        caption: v.title,
        status: "scheduled",
      });
    }

    if (!toInsert.length) {
      toast.info("Nada para agendar (já programado ou limite diário atingido).");
      return;
    }

    const { error } = await supabase.from("scheduled_posts").insert(toInsert);
    if (error) toast.error(error.message);
    else {
      toast.success(`${toInsert.length} vídeo(s) agendado(s) para os próximos dias.`);
      qc.invalidateQueries({ queryKey: ["scheduled"] });
    }
    void findNextSlot;
  };

  const removeOne = async (id: string) => {
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removido.");
      qc.invalidateQueries({ queryKey: ["scheduled"] });
    }
  };

  const dayPosts = selectedDay
    ? (scheduled ?? []).filter((s) => toLocalISODate(new Date(s.scheduled_for)) === selectedDay)
    : [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <PageHeader
        title="Agendamento"
        subtitle={`Máximo ${MAX_PER_DAY} vídeos por dia. Publicação a partir do dia seguinte.`}
        action={
          <Button onClick={autoSchedule} className="bg-gradient-primary shadow-glow">
            <Sparkles className="size-4 mr-2" /> Auto-agendar prontos
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="p-5 bg-gradient-surface border-border/60 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              className="p-2 rounded-md hover:bg-muted/40"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="font-display capitalize">{monthLabel}</div>
            <button
              type="button"
              className="p-2 rounded-md hover:bg-muted/40"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell, i) => {
              if (!cell.date) return <div key={i} className="aspect-square" />;
              const count = countsByDay[cell.iso!] ?? 0;
              const isToday = cell.iso === today;
              const isSelected = cell.iso === selectedDay;
              const full = count >= MAX_PER_DAY;
              return (
                <button
                  key={cell.iso!}
                  type="button"
                  onClick={() => setSelectedDay(cell.iso)}
                  className={cn(
                    "aspect-square rounded-md border text-xs flex flex-col items-center justify-center gap-0.5 transition",
                    isSelected
                      ? "border-primary bg-primary/15"
                      : "border-border/40 hover:bg-muted/30",
                    isToday && "ring-1 ring-primary-glow/60",
                  )}
                >
                  <span className={cn("font-medium", count > 0 && "text-primary-glow")}>
                    {cell.date.getDate()}
                  </span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] px-1 rounded",
                        full
                          ? "bg-destructive/30 text-destructive"
                          : "bg-primary/20 text-primary-glow",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 bg-gradient-surface border-border/60 shadow-card">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Calendar className="size-4 text-primary-glow" />
            {selectedDay
              ? new Date(`${selectedDay}T00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })
              : "Selecione um dia"}
          </h3>
          {!selectedDay ? (
            <p className="text-sm text-muted-foreground">
              Clique em um dia no calendário para ver os vídeos agendados.
            </p>
          ) : dayPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada agendado neste dia.</p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {dayPosts.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 border border-border/40 rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {new Date(s.scheduled_for).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.caption || "Sem legenda"}
                    </div>
                  </div>
                  <Badge className="shrink-0">{s.platform}</Badge>
                  <button
                    type="button"
                    onClick={() => removeOne(s.id)}
                    className="p-1 rounded hover:bg-muted/40 text-muted-foreground"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
