import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { ChevronRight, Plus, TrendingUp, TrendingDown, Minus, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { COACHES, type CoachId, COACH_LIST } from "@/lib/coaches";

export const Route = createFileRoute("/_authenticated/suivi/")({
  head: () => ({ meta: [{ title: "Mes suivis — Vita" }] }),
  component: SuiviList,
  errorComponent: ({ error, reset }) => (
    <Page>
      <div className="clay p-6 text-center">
        <div className="font-extrabold">Suivis indisponibles</div>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="clay-btn mt-4">Réessayer</button>
      </div>
    </Page>
  ),
});

const SUGGESTIONS = [
  { emoji: "🌿", label: "Acné" },
  { emoji: "💪", label: "Douleur dos" },
  { emoji: "😴", label: "Sommeil" },
  { emoji: "🤕", label: "Migraine" },
  { emoji: "🍽️", label: "Digestion" },
  { emoji: "🧘", label: "Stress" },
  { emoji: "🩸", label: "Cycle" },
  { emoji: "🦷", label: "Dent / gencive" },
];

// Heuristic coach suggestion from problem text
function suggestCoach(text: string): CoachId | null {
  const t = text.toLowerCase();
  if (/dos|muscu|muscle|sport|force|salle/.test(t)) return "muscu";
  if (/poids|kilo|maigrir|grossir|gras/.test(t)) return "poids";
  if (/manger|alim|nutri|repas|calor|sucre/.test(t)) return "nutrition";
  if (/sommeil|dormir|fatigue|insomn|nuit/.test(t)) return "sommeil";
  if (/courir|course|cardio|marath|10k|5k/.test(t)) return "running";
  if (/boire|eau|hydrat|soif/.test(t)) return "hydratation";
  return null;
}

type Tab = "active" | "done";

function SuiviList() {
  const session = useSession();
  const userId = session?.user.id;
  const [tab, setTab] = useState<Tab>("active");
  const [wizard, setWizard] = useState(false);

  const { data: trackers } = useQuery({
    queryKey: ["trackers", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("health_trackers")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: entriesByTracker } = useQuery({
    queryKey: ["tracker-entries-all", userId],
    enabled: !!userId && (trackers?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (trackers ?? []).map((t: any) => t.id);
      if (ids.length === 0) return {} as Record<string, number[]>;
      const { data } = await (supabase as any)
        .from("tracker_entries")
        .select("tracker_id, feeling, created_at")
        .in("tracker_id", ids)
        .not("feeling", "is", null)
        .order("created_at", { ascending: true });
      const byId: Record<string, number[]> = {};
      for (const e of (data ?? []) as any[]) {
        if (!byId[e.tracker_id]) byId[e.tracker_id] = [];
        byId[e.tracker_id].push(e.feeling as number);
      }
      return byId;
    },
  });

  const filtered = useMemo(
    () => (trackers ?? []).filter((t: any) => (tab === "active" ? t.status !== "done" : t.status === "done")),
    [trackers, tab],
  );
  const activeCount = (trackers ?? []).filter((t: any) => t.status !== "done").length;
  const doneCount = (trackers ?? []).filter((t: any) => t.status === "done").length;

  return (
    <Page title="Mes suivis" subtitle="Tes problèmes santé, suivis dans le temps">
      <button onClick={() => setWizard(true)} className="clay-btn mb-5 flex w-full items-center justify-center gap-2" style={{ ["--clay-accent" as any]: "var(--primary)" }}>
        <Plus size={18} /> Nouveau suivi guidé
      </button>

      <div className="mb-4 inline-flex rounded-full bg-muted p-1 text-sm">
        <TabBtn active={tab === "active"} onClick={() => setTab("active")}>
          Actifs {activeCount > 0 && <span className="ml-1 opacity-60">{activeCount}</span>}
        </TabBtn>
        <TabBtn active={tab === "done"} onClick={() => setTab("done")}>
          Terminés {doneCount > 0 && <span className="ml-1 opacity-60">{doneCount}</span>}
        </TabBtn>
      </div>

      {filtered.length === 0 && (
        <div className="clay p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles size={22} />
          </div>
          <div className="text-[14px] font-bold">
            {tab === "active" ? "Aucun suivi actif" : "Aucun suivi terminé"}
          </div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            {tab === "active" ? "Lance ton premier suivi guidé en 30s." : "Tes suivis terminés apparaîtront ici."}
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((t: any) => {
          const feelings = entriesByTracker?.[t.id] ?? [];
          const improvement = computeImprovement(feelings);
          const coach = t.linked_coach_id ? COACHES[t.linked_coach_id as CoachId] : null;
          return (
            <li key={t.id}>
              <Link
                to="/suivi/$id"
                params={{ id: t.id }}
                className="clay clay-tap flex items-center gap-3 p-4"
                style={coach ? { ["--clay-accent" as any]: coach.accent } : undefined}
              >
                <div className="clay-mascot-frame grid h-14 w-14 shrink-0 place-items-center text-2xl">
                  {t.emoji ?? "🩺"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold leading-tight">{t.title}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">
                    {feelings.length === 0
                      ? "Aucun check-in"
                      : `${feelings.length} check-in${feelings.length > 1 ? "s" : ""} · ${formatRelative(t.updated_at)}`}
                  </div>
                  {coach && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold" style={{ color: coach.accent }}>
                      <Sparkles size={10} /> Avec {coach.name}
                    </div>
                  )}
                </div>
                <ImprovementBadge value={improvement} />
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      {wizard && <NewTrackerWizard onClose={() => setWizard(false)} />}
    </Page>
  );
}

function NewTrackerWizard({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const userId = session?.user.id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState("");
  const [coachId, setCoachId] = useState<CoachId | null>(null);
  const [plan, setPlan] = useState<{ title: string; emoji: string; summary: string; plan: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function generate() {
    if (!problem.trim()) return toast.error("Décris ton problème");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const r = await fetch("/api/tracker-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: problem }] }),
      });
      if (!r.ok) throw new Error(await r.text());
      const p = await r.json();
      setPlan(p);
      setCoachId(suggestCoach(problem));
      setStep(1);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!userId || !plan) return;
    setCreating(true);
    try {
      const photoG = /acn|peau|tache|rougeur|bouton|grain|cicatr/i.test(problem)
        ? "Prends la photo dans une lumière naturelle, visage centré, sans filtre, à 30 cm. Refais la même pose à chaque check-in pour bien comparer."
        : /douleur|inflam|gonfle/i.test(problem)
          ? "Photographie la zone concernée dans la même lumière à chaque fois, avec une règle ou un objet de référence pour mesurer."
          : "Garde la même lumière et le même angle d'une photo à l'autre pour pouvoir comparer dans le temps.";
      const freq = /sommeil|hydra|migraine|stress|cycle/i.test(problem) ? 1 : 3;
      const { data, error } = await (supabase as any)
        .from("health_trackers")
        .insert({
          user_id: userId,
          title: plan.title,
          emoji: plan.emoji,
          summary: plan.summary,
          plan: plan.plan,
          status: "active",
          linked_coach_id: coachId,
          photo_guidance: photoG,
          voice_enabled: true,
          frequency_days: freq,
        })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["trackers", userId] });
      toast.success("Suivi créé ✨");
      onClose();
      navigate({ to: "/suivi/$id", params: { id: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setCreating(false);
    }
  }

  const linkedCoach = coachId ? COACHES[coachId] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="clay w-full max-w-xl rounded-t-[32px] p-5 sm:rounded-[32px]" style={linkedCoach ? { ["--clay-accent" as any]: linkedCoach.accent } : undefined}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            Étape {step + 1} / 2
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted"><X size={18} /></button>
        </div>

        {step === 0 && (
          <>
            <h2 className="text-[20px] font-bold leading-tight">Que veux-tu suivre ?</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Décris ton problème en quelques mots. Vita IA va proposer un plan adapté.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} onClick={() => setProblem(s.label)} className="choice-chip">
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={3}
              placeholder="ex: j'ai de l'acné sur les joues depuis 2 mois…"
              className="input-chunky mt-3 w-full resize-none"
            />
            <button onClick={generate} disabled={loading || !problem.trim()} className="clay-btn mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50" style={{ ["--clay-accent" as any]: "var(--primary)" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? "Vita prépare ton plan…" : "Générer mon plan"}
            </button>
          </>
        )}

        {step === 1 && plan && (
          <>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-3xl">{plan.emoji}</div>
              <div className="min-w-0">
                <h2 className="truncate text-[20px] font-bold leading-tight">{plan.title}</h2>
                <p className="truncate text-[12px] text-muted-foreground">{plan.summary}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-surface-2 p-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Ton plan</div>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {plan.plan.map((p, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span> {p}</li>)}
              </ul>
            </div>

            <div className="mt-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Coach lié (optionnel)</div>
              <p className="mt-1 text-[12px] text-muted-foreground">Un coach peut créer un programme directement à partir de ce suivi.</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setCoachId(null)} className={`shrink-0 rounded-2xl border-2 px-3 py-2 text-xs font-bold ${coachId === null ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  Aucun
                </button>
                {COACH_LIST.map((c) => (
                  <button key={c.id} onClick={() => setCoachId(c.id)} className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-3 py-2 text-xs font-bold ${coachId === c.id ? "border-[--coach] bg-[--coach]/10" : "border-border bg-card"}`} style={{ ["--coach" as any]: c.accent } as any}>
                    <img src={c.mascot} alt="" className="h-6 w-6 rounded-lg object-cover" />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setStep(0)} className="flex-1 rounded-2xl border-2 border-border bg-card py-3 text-sm font-bold">Retour</button>
              <button onClick={create} disabled={creating} className="clay-btn flex-[2] disabled:opacity-50" style={linkedCoach ? { ["--clay-accent" as any]: linkedCoach.accent } : { ["--clay-accent" as any]: "var(--primary)" }}>
                {creating ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Activer ce suivi"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-4 py-1.5 font-semibold transition ${active ? "bg-surface-1 text-foreground shadow-sm" : "text-muted-foreground"}`}>
      {children}
    </button>
  );
}

function ImprovementBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value > 5;
  const negative = value < -5;
  const cls = positive ? "bg-success/15 text-success" : negative ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground";
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${cls}`}>
      <Icon size={12} />{value > 0 ? "+" : ""}{value}%
    </span>
  );
}

export function computeImprovement(feelings: number[]): number | null {
  if (feelings.length < 3) return null;
  const n = feelings.length;
  const cut = Math.max(1, Math.floor(n / 3));
  const early = feelings.slice(0, cut);
  const late = feelings.slice(n - cut);
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return Math.round(((avg(late) - avg(early)) / 4) * 100);
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / 36e5);
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
