import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { ArrowLeft, Smile } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/mood")({
  head: () => ({ meta: [{ title: "Humeur — Vita" }] }),
  component: MoodPage,
});

const CHOICES = [
  { v: 1, e: "😫", label: "Très mal" },
  { v: 2, e: "😔", label: "Pas top" },
  { v: 3, e: "😐", label: "Stable" },
  { v: 4, e: "😀", label: "Super" },
];

function MoodPage() {
  const session = useSession();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [note, setNote] = useState("");

  const { data: todayMood } = useQuery({
    queryKey: ["mood-today", userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mood_logs")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["mood-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mood_logs")
        .select("log_date, mood, note")
        .eq("user_id", userId!)
        .order("log_date", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  async function log(mood: number) {
    if (!userId) return;
    const { error } = await (supabase as any)
      .from("mood_logs")
      .upsert(
        { user_id: userId, log_date: today, mood, note: note || null },
        { onConflict: "user_id,log_date" },
      );
    if (error) return toast.error(error.message);
    setNote("");
    qc.invalidateQueries({ queryKey: ["mood-today", userId, today] });
    qc.invalidateQueries({ queryKey: ["mood-history", userId] });
    toast.success("Humeur enregistrée ✨");
  }

  const avg =
    (history?.length ?? 0) > 0
      ? ((history as any[]).reduce((s, h) => s + h.mood, 0) / history!.length).toFixed(1)
      : "—";

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/home" })} className="rounded-xl p-2 hover:bg-muted">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Smile className="text-accent" /> Humeur
          </h1>
          <p className="text-xs text-muted-foreground">Comment tu te sens aujourd'hui ?</p>
        </div>
      </div>

      <div className="card-chunky mb-4">
        <div className="mb-3 grid grid-cols-4 gap-2">
          {CHOICES.map((c) => {
            const active = (todayMood as any)?.mood === c.v;
            return (
              <button
                key={c.v}
                onClick={() => log(c.v)}
                className={`flex flex-col items-center rounded-2xl border-2 py-3 transition active:scale-95 ${
                  active ? "border-accent bg-accent/10" : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <span className="text-3xl">{c.e}</span>
                <span className="mt-1 text-[10px] font-bold text-muted-foreground">{c.label}</span>
              </button>
            );
          })}
        </div>
        <textarea
          rows={2}
          placeholder="Une pensée du jour (facultatif)…"
          className="input-chunky resize-none text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="card-chunky mb-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <div className="text-2xl font-extrabold">{history?.length ?? 0}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Jours notés</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold">{avg}/4</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Moyenne 30j</div>
        </div>
      </div>

      <div className="card-chunky">
        <div className="mb-3 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          30 derniers jours
        </div>
        <div className="flex h-24 items-end gap-1">
          {(history ?? []).slice().reverse().map((h: any, i: number) => {
            const height = (h.mood / 4) * 100;
            const color =
              h.mood >= 4 ? "bg-success" : h.mood === 3 ? "bg-info" : h.mood === 2 ? "bg-streak" : "bg-destructive";
            return (
              <div key={i} className="flex-1" style={{ height: "100%" }}>
                <div className="flex h-full items-end">
                  <div className={`w-full rounded-t-md ${color}`} style={{ height: `${height}%` }} />
                </div>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 30 - (history?.length ?? 0)) }).map((_, i) => (
            <div key={`e${i}`} className="flex-1 rounded-t-md bg-muted" style={{ height: "10%" }} />
          ))}
        </div>
      </div>
    </Page>
  );
}