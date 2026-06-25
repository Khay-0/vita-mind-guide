import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { ArrowLeft, Droplet, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/hydration")({
  head: () => ({ meta: [{ title: "Hydratation — Vita" }] }),
  component: HydrationPage,
});

const GOALS = [2000, 2500, 3000];
const STEPS = [150, 250, 500];

function HydrationPage() {
  const session = useSession();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(250);

  const { data: today_log } = useQuery({
    queryKey: ["hydration-today", userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hydration_logs")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today)
        .maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["hydration-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hydration_logs")
        .select("log_date, amount_ml, goal_ml")
        .eq("user_id", userId!)
        .order("log_date", { ascending: false })
        .limit(14);
      return data ?? [];
    },
  });

  const amount = (today_log as any)?.amount_ml ?? 0;
  const goal = (today_log as any)?.goal_ml ?? 2500;
  const pct = Math.min(100, (amount / goal) * 100);

  async function adjust(delta: number) {
    if (!userId) return;
    const next = Math.max(0, amount + delta);
    const { error } = await (supabase as any)
      .from("hydration_logs")
      .upsert(
        { user_id: userId, log_date: today, amount_ml: next, goal_ml: goal },
        { onConflict: "user_id,log_date" },
      );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["hydration-today", userId, today] });
    qc.invalidateQueries({ queryKey: ["hydration-history", userId] });
  }

  async function setGoal(newGoal: number) {
    if (!userId) return;
    const { error } = await (supabase as any)
      .from("hydration_logs")
      .upsert(
        { user_id: userId, log_date: today, amount_ml: amount, goal_ml: newGoal },
        { onConflict: "user_id,log_date" },
      );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["hydration-today", userId, today] });
  }

  const streak = useMemo(() => {
    if (!history) return 0;
    let n = 0;
    for (const h of history as any[]) {
      if (h.amount_ml >= h.goal_ml) n++;
      else break;
    }
    return n;
  }, [history]);

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/home" })} className="rounded-xl p-2 hover:bg-muted">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Droplet className="text-info" /> Hydratation
          </h1>
          <p className="text-xs text-muted-foreground">Bois assez chaque jour pour ton corps</p>
        </div>
      </div>

      <div className="card-chunky mb-4 text-center">
        <div className="relative mx-auto h-40 w-40">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="hsl(var(--info))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-extrabold tabular-nums">{(amount / 1000).toFixed(1)}L</div>
            <div className="text-xs text-muted-foreground">/ {(goal / 1000).toFixed(1)}L</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => adjust(-step)} className="btn-chunky btn-chunky-secondary !px-4">
            <Minus size={18} />
          </button>
          <div className="rounded-2xl border-2 border-border bg-card px-4 py-2 text-sm font-extrabold tabular-nums">
            +{step}ml
          </div>
          <button onClick={() => adjust(step)} className="btn-chunky !px-4">
            <Plus size={18} />
          </button>
        </div>
        <div className="mt-2 flex justify-center gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${step === s ? "bg-info text-white" : "bg-muted text-muted-foreground"}`}
            >
              {s}ml
            </button>
          ))}
        </div>
      </div>

      <div className="card-chunky mb-4">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Objectif quotidien
        </div>
        <div className="flex gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-extrabold ${goal === g ? "border-info bg-info/10 text-info" : "border-border bg-card text-muted-foreground"}`}
            >
              {(g / 1000).toFixed(1)}L
            </button>
          ))}
        </div>
      </div>

      <div className="card-chunky mb-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            14 derniers jours
          </div>
          {streak > 0 && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-extrabold text-success">
              🔥 {streak}j d'affilée
            </span>
          )}
        </div>
        <div className="flex h-24 items-end gap-1">
          {(history ?? []).slice().reverse().map((h: any, i: number) => {
            const p = Math.min(100, ((h.amount_ml ?? 0) / (h.goal_ml || 2500)) * 100);
            return (
              <div key={i} className="flex-1 rounded-t-md bg-info/20 relative" style={{ height: "100%" }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-info"
                  style={{ height: `${p}%` }}
                />
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 14 - (history?.length ?? 0)) }).map((_, i) => (
            <div key={`e${i}`} className="flex-1 rounded-t-md bg-muted" style={{ height: "100%" }} />
          ))}
        </div>
      </div>
    </Page>
  );
}