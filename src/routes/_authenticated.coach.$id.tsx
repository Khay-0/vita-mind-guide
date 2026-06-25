import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/AppShell";
import { COACHES, type CoachId } from "@/lib/coaches";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import {
  saveCoachOnboarding,
  generateWorkoutProgram,
  generateNutritionTargets,
  generateRunPlan,
  awardXp,
} from "@/lib/coach.functions";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageCircle,
  Sparkles,
  Dumbbell,
  Apple,
  Footprints,
  Moon,
  Droplet,
  Scale,
  Plus,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { ChoiceCard, NumberStepper, WizardShell } from "@/components/ui-premium";

const PushupCoach = lazy(() =>
  import("@/components/PushupCoach").then((m) => ({ default: m.PushupCoach })),
);

export const Route = createFileRoute("/_authenticated/coach/$id")({
  head: () => ({ meta: [{ title: "Coach — Vita" }] }),
  component: CoachDetail,
});

function CoachDetail() {
  const { id } = Route.useParams();
  const coachId = id as CoachId;
  const coach = COACHES[coachId];
  const navigate = useNavigate();
  const session = useSession();
  const userId = session?.user.id;

  if (!coach) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Coach introuvable.</p>
        <Link to="/coach" className="mt-3 text-sm font-bold text-primary">
          Retour
        </Link>
      </Page>
    );
  }

  const { data: profile, isLoading } = useQuery({
    queryKey: ["coach-profile", userId, coachId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("coach_profiles")
        .select("*")
        .eq("user_id", userId!)
        .eq("coach_id", coachId)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return null;

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/coach" })}
          className="rounded-xl p-2 hover:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 truncate">
          <div className="truncate text-base font-extrabold">{coach.fullName}</div>
          <div className="truncate text-[11px] text-muted-foreground">{coach.tagline}</div>
        </div>
        <Link
          to="/coach/$id/chat"
          params={{ id: coachId }}
          className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-white shadow"
          style={{ backgroundColor: coach.accent }}
        >
          <MessageCircle size={14} /> Parler
        </Link>
      </div>

      {coachId === "muscu" ? (
        <MaxPushupsOnly />
      ) : !profile ? (
        <Onboarding coachId={coachId} />
      ) : (
        <Dashboard coachId={coachId} profile={profile} />
      )}

    </Page>
  );
}

// ============ ONBOARDING ============
function Onboarding({ coachId }: { coachId: CoachId }) {
  const coach = COACHES[coachId];
  const qc = useQueryClient();
  const save = useServerFn(saveCoachOnboarding);
  const award = useServerFn(awardXp);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const data: Record<string, any> = {};
      for (const f of coach.onboarding) {
        const v = values[f.key];
        data[f.key] = f.type === "number" ? Number(v) : v;
      }
      await save({ data: { coachId, data } });
      await award({ data: { eventType: "coach_onboarded", amount: 40, refId: coachId } });
      toast.success(`${coach.name} est prêt à t'accompagner !`);
      qc.invalidateQueries({ queryKey: ["coach-profile"] });
      qc.invalidateQueries({ queryKey: ["coach-profiles"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const steps = coach.onboarding.map((f) => ({
    key: f.key,
    question: f.label + " ?",
    helper: f.unit ? `Unité : ${f.unit}` : undefined,
    validate: (v: any) => v != null && v !== "" && !(Number.isNaN(Number(v)) && f.type === "number"),
    render: ({ value, setValue, goNext }: any) => {
      if (f.type === "select") {
        return (
          <div className="space-y-2.5">
            {f.options!.map((o) => (
              <ChoiceCard
                key={o.value}
                selected={value === o.value}
                onClick={() => { setValue(o.value); setTimeout(goNext, 180); }}
                label={o.label}
              />
            ))}
          </div>
        );
      }
      if (f.type === "number") {
        const init = typeof value === "number" ? value : Number(value) || (f.key.includes("age") ? 28 : f.key.includes("height") ? 175 : f.key.includes("weight") ? 70 : 0);
        return <NumberStepper value={init} onChange={setValue} min={0} max={300} step={1} unit={f.unit} />;
      }
      return (
        <input
          autoFocus
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={f.placeholder}
          className="input-ios"
        />
      );
    },
  }));

  return (
    <>
      <div className={`mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br ${coach.gradient} p-5 text-white shadow-[var(--elev-2)]`}>
        <div className="flex items-center gap-4">
          <img src={coach.mascot} alt={coach.name} width={120} height={120} className="h-24 w-24 shrink-0 object-contain drop-shadow-lg" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest opacity-90">Premier pas</div>
            <div className="text-[20px] font-bold leading-tight">Salut, moi c'est {coach.name}</div>
            <div className="mt-1 text-[12.5px] opacity-95">Réponds à quelques questions, je te construis un programme sur-mesure.</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="card-premium p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Ce que tu vas obtenir</div>
          <ul className="mt-2 space-y-1.5 text-[13.5px]">
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Un programme adapté à ton profil</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Un suivi de progression visuel</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary" /> Un chat avec ton coach 24/7</li>
          </ul>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="btn-ios w-full"
          style={{ background: coach.accent }}
        >
          <Sparkles size={16} /> Commencer avec {coach.name}
        </button>
      </div>

      {open && (
        <WizardShell
          steps={steps}
          values={values}
          setValues={setValues}
          onCancel={() => setOpen(false)}
          onFinish={submit}
          finishLabel={`Générer mon programme`}
          submitting={saving}
          accent={coach.accent}
        />
      )}
    </>
  );
}



// ============ DASHBOARD (dispatch by coach type) ============
function Dashboard({ coachId, profile }: { coachId: CoachId; profile: any }) {
  switch (coachId) {
    case "muscu":
      return <MuscuDashboard profile={profile} />;
    case "nutrition":
      return <NutritionDashboard profile={profile} />;
    case "running":
      return <RunningDashboard profile={profile} />;
    case "sommeil":
      return <SommeilDashboard profile={profile} />;
    case "poids":
      return <PoidsDashboard profile={profile} />;
    case "hydratation":
      return <HydratationDashboard profile={profile} />;
  }
}

function CoachHero({ coachId, kicker, title, subtitle }: { coachId: CoachId; kicker: string; title: string; subtitle?: string }) {
  const c = COACHES[coachId];
  return (
    <div className={`relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br ${c.gradient} p-4 text-white shadow-lg`}>
      <div className="flex items-center gap-3">
        <img src={c.mascot} alt="" width={96} height={96} className="h-20 w-20 shrink-0 object-contain drop-shadow-lg" />
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">{kicker}</div>
          <div className="text-lg font-extrabold leading-tight">{title}</div>
          {subtitle && <div className="text-xs opacity-90">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

// ===== MUSCULATION =====
function MuscuDashboard({ profile }: { profile: any }) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const generate = useServerFn(generateWorkoutProgram);
  const award = useServerFn(awardXp);
  const [gen, setGen] = useState(false);
  const [logging, setLogging] = useState<any | null>(null);

  const { data: program } = useQuery({
    queryKey: ["workout-program", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("workout_programs")
        .select("*")
        .eq("user_id", userId!)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["workout-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: measurements } = useQuery({
    queryKey: ["measurements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("body_measurements")
        .select("*")
        .eq("user_id", userId!)
        .order("log_date", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  async function generateProgram() {
    setGen(true);
    try {
      await generate({ data: { data: profile.onboarding_data } });
      qc.invalidateQueries({ queryKey: ["workout-program"] });
      toast.success("Programme prêt 💪");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setGen(false);
    }
  }

  async function logSession(day: any) {
    if (!userId) return;
    const { error } = await (supabase as any).from("workout_sessions").insert({
      user_id: userId,
      program_id: program?.id,
      completed_at: new Date().toISOString(),
      exercises: day.exercises,
      notes: day.label,
    });
    if (error) return toast.error(error.message);
    await award({ data: { eventType: "workout_logged", amount: 25 } });
    qc.invalidateQueries({ queryKey: ["workout-sessions"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Séance enregistrée ✨ +25 XP");
  }

  const days: any[] = program?.plan?.days ?? [];

  return (
    <div>
      <CoachHero coachId="muscu" kicker="Programme" title={program?.name ?? "Aucun programme actif"} subtitle={`Objectif : ${profile.onboarding_data?.goal ?? "—"}`} />

      {/* Session pompes IA — détection caméra en temps réel */}
      <div className="mb-5 overflow-hidden rounded-3xl border-2 border-border bg-card p-4 shadow-[var(--elev-2)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 text-white">
            <Dumbbell size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600">
              Nouveau · IA Vision
            </div>
            <div className="text-base font-extrabold leading-tight">Session pompes en temps réel</div>
            <div className="text-[11px] text-muted-foreground">Max compte tes reps et corrige ta forme depuis la caméra.</div>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          }
        >
          <PushupCoach />
        </Suspense>
      </div>


      {!program ? (
        <button
          onClick={generateProgram}
          disabled={gen}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 py-3 text-sm font-extrabold text-white shadow"
        >
          {gen ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {gen ? "Génération du programme…" : "Générer mon programme avec Max"}
        </button>
      ) : (
        <>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Tes séances
          </h2>
          <div className="mb-5 space-y-2">
            {days.map((d: any, i: number) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">{d.label}</div>
                    <div className="text-[11px] text-muted-foreground">{d.focus}</div>
                  </div>
                  <button
                    onClick={() => setLogging(logging?.idx === i ? null : { ...d, idx: i })}
                    className="rounded-xl bg-orange-500 px-3 py-1.5 text-[11px] font-extrabold text-white"
                  >
                    {logging?.idx === i ? "Fermer" : "Voir"}
                  </button>
                </div>
                {logging?.idx === i && (
                  <div className="mt-3 space-y-1.5 border-t border-border pt-2">
                    {(d.exercises ?? []).map((e: any, j: number) => (
                      <div key={j} className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{e.name}</div>
                          {e.notes && <div className="truncate text-[10px] text-muted-foreground">{e.notes}</div>}
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11px]">
                          {e.sets}×{e.reps} · {e.rest_sec}s
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => logSession(d)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-orange-500 py-2 text-xs font-extrabold text-white"
                    >
                      <CheckCircle2 size={14} /> J'ai fait cette séance
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <MeasurementSection measurements={measurements ?? []} userId={userId} />

      {sessions && sessions.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Historique séances
          </h2>
          <div className="space-y-1.5">
            {sessions.slice(0, 6).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <div className="font-bold">{s.notes ?? "Séance"}</div>
                <div className="text-muted-foreground">
                  {new Date(s.completed_at ?? s.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementSection({ measurements, userId }: { measurements: any[]; userId?: string }) {
  const qc = useQueryClient();
  const award = useServerFn(awardXp);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});
  const latest = measurements[0];

  async function submit() {
    if (!userId) return;
    const payload: any = { user_id: userId, log_date: new Date().toISOString().slice(0, 10) };
    for (const k of ["weight_kg", "chest_cm", "waist_cm", "arm_cm", "thigh_cm"]) {
      if (form[k]) payload[k] = Number(form[k]);
    }
    const { error } = await (supabase as any).from("body_measurements").insert(payload);
    if (error) return toast.error(error.message);
    await award({ data: { eventType: "measurement_logged", amount: 15 } });
    qc.invalidateQueries({ queryKey: ["measurements"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setForm({});
    setShow(false);
    toast.success("Mesures enregistrées ✨ +15 XP");
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Mensurations
        </h2>
        <button
          onClick={() => setShow(!show)}
          className="text-xs font-bold text-orange-600"
        >
          {show ? "Fermer" : "+ Ajouter"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        {latest ? (
          <div className="grid grid-cols-5 gap-2 text-center">
            <Metric label="Poids" value={latest.weight_kg} unit="kg" />
            <Metric label="Poitr." value={latest.chest_cm} unit="cm" />
            <Metric label="Taille" value={latest.waist_cm} unit="cm" />
            <Metric label="Bras" value={latest.arm_cm} unit="cm" />
            <Metric label="Cuisse" value={latest.thigh_cm} unit="cm" />
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            Aucune mesure encore. Ajoute ta première pour suivre l'évolution.
          </div>
        )}

        {show && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            {[
              ["weight_kg", "Poids (kg)"],
              ["chest_cm", "Poitrine (cm)"],
              ["waist_cm", "Taille (cm)"],
              ["arm_cm", "Bras (cm)"],
              ["thigh_cm", "Cuisse (cm)"],
            ].map(([k, l]) => (
              <input
                key={k}
                type="number"
                step="0.1"
                placeholder={l}
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs"
              />
            ))}
            <button
              onClick={submit}
              className="col-span-2 rounded-xl bg-orange-500 py-2 text-xs font-extrabold text-white"
            >
              Enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div>
      <div className="text-sm font-extrabold">
        {value != null ? value : "—"}
        {value != null && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[9px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

// ===== NUTRITION =====
function NutritionDashboard({ profile }: { profile: any }) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const gen = useServerFn(generateNutritionTargets);
  const award = useServerFn(awardXp);
  const [gening, setGening] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const { data: target } = useQuery({
    queryKey: ["nutrition-target", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("nutrition_targets")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: meals } = useQuery({
    queryKey: ["meals", userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("meal_logs")
        .select("*")
        .eq("user_id", userId!)
        .eq("log_date", today)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  async function generate() {
    setGening(true);
    try {
      await gen({ data: { data: profile.onboarding_data } });
      qc.invalidateQueries({ queryKey: ["nutrition-target"] });
      toast.success("Objectifs calculés 🥗");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setGening(false);
    }
  }

  const totals = (meals ?? []).reduce(
    (a: any, m: any) => ({
      kcal: a.kcal + (m.kcal ?? 0),
      protein_g: a.protein_g + (m.protein_g ?? 0),
      carbs_g: a.carbs_g + (m.carbs_g ?? 0),
      fat_g: a.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <div>
      <CoachHero coachId="nutrition" kicker="Aujourd'hui" title={target ? `${totals.kcal} / ${target.kcal} kcal` : "Calculer mes besoins"} />

      {!target ? (
        <button
          onClick={generate}
          disabled={gening}
          className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-extrabold text-white shadow"
        >
          {gening ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {gening ? "Calcul…" : "Calculer mes calories et macros"}
        </button>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <MacroCard label="Protéines" cur={totals.protein_g} target={target.protein_g} color="bg-rose-500" />
            <MacroCard label="Glucides" cur={totals.carbs_g} target={target.carbs_g} color="bg-amber-500" />
            <MacroCard label="Lipides" cur={totals.fat_g} target={target.fat_g} color="bg-emerald-500" />
          </div>

          <AddMeal userId={userId} onAdded={() => {
            qc.invalidateQueries({ queryKey: ["meals"] });
            award({ data: { eventType: "meal_logged", amount: 10 } });
            qc.invalidateQueries({ queryKey: ["profile"] });
          }} />

          {meals && meals.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Repas du jour</h2>
              <ul className="space-y-1.5">
                {meals.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                    <div>
                      <div className="font-bold">{m.meal_type}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {(m.items ?? []).map((i: any) => i.name).join(", ")}
                      </div>
                    </div>
                    <div className="font-extrabold text-emerald-700">{m.kcal} kcal</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MacroCard({ label, cur, target, color }: { label: string; cur: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((cur / Math.max(1, target)) * 100));
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="my-1 text-sm font-extrabold">{cur}<span className="text-[10px] text-muted-foreground">/{target}g</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AddMeal({ userId, onAdded }: { userId?: string; onAdded: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ meal_type: "Déjeuner", name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "" });

  async function submit() {
    if (!userId || !form.name) return toast.error("Nom du repas requis");
    const { error } = await (supabase as any).from("meal_logs").insert({
      user_id: userId,
      log_date: today,
      meal_type: form.meal_type,
      items: [{ name: form.name }],
      kcal: Number(form.kcal) || 0,
      protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      fat_g: Number(form.fat_g) || 0,
    });
    if (error) return toast.error(error.message);
    setForm({ meal_type: "Déjeuner", name: "", kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
    setShow(false);
    onAdded();
    toast.success("Repas ajouté ✨ +10 XP");
  }

  if (!show)
    return (
      <button
        onClick={() => setShow(true)}
        className="flex w-full items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border bg-card py-3 text-sm font-bold text-emerald-700"
      >
        <Plus size={16} /> Ajouter un repas
      </button>
    );

  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
      <select value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
        {["Petit-déjeuner", "Déjeuner", "Goûter", "Dîner", "Collation"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input placeholder="Nom du repas" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
      <div className="grid grid-cols-4 gap-2">
        {[
          ["kcal", "kcal"],
          ["protein_g", "P (g)"],
          ["carbs_g", "G (g)"],
          ["fat_g", "L (g)"],
        ].map(([k, l]) => (
          <input key={k} type="number" placeholder={l} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs" />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShow(false)} className="flex-1 rounded-xl border border-border py-2 text-xs font-bold">Annuler</button>
        <button onClick={submit} className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-extrabold text-white">Enregistrer</button>
      </div>
    </div>
  );
}

// ===== RUNNING =====
function RunningDashboard({ profile }: { profile: any }) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const gen = useServerFn(generateRunPlan);
  const award = useServerFn(awardXp);
  const [gening, setGening] = useState(false);
  const [form, setForm] = useState({ distance_km: "", duration_min: "", notes: "" });

  const { data: plan } = useQuery({
    queryKey: ["run-plan", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("run_plans").select("*").eq("user_id", userId!).eq("active", true).maybeSingle();
      return data;
    },
  });
  const { data: runs } = useQuery({
    queryKey: ["runs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("run_logs").select("*").eq("user_id", userId!).order("log_date", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  async function generate() {
    setGening(true);
    try {
      await gen({ data: { data: profile.onboarding_data } });
      qc.invalidateQueries({ queryKey: ["run-plan"] });
      toast.success("Plan prêt 🏃");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setGening(false);
    }
  }

  async function logRun() {
    if (!userId || !form.distance_km || !form.duration_min) return toast.error("Distance et durée requises");
    const km = Number(form.distance_km);
    const min = Number(form.duration_min);
    const pace = `${Math.floor(min / km)}'${String(Math.round(((min / km) % 1) * 60)).padStart(2, "0")}/km`;
    const { error } = await (supabase as any).from("run_logs").insert({
      user_id: userId,
      log_date: new Date().toISOString().slice(0, 10),
      distance_km: km,
      duration_min: min,
      pace,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    await award({ data: { eventType: "run_logged", amount: 30 } });
    setForm({ distance_km: "", duration_min: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["runs"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Course enregistrée ✨ +30 XP");
  }

  const week1 = plan?.plan?.weekly_sessions?.[0]?.sessions ?? [];

  return (
    <div>
      <CoachHero coachId="running" kicker="Plan d'entraînement" title={plan ? `Objectif ${profile.onboarding_data?.goal}` : "Aucun plan"} subtitle={plan ? `${plan.weeks} semaines` : undefined} />

      {!plan ? (
        <button onClick={generate} disabled={gening} className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-extrabold text-white shadow">
          {gening ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {gening ? "Génération…" : "Générer mon plan avec Théo"}
        </button>
      ) : (
        <>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Cette semaine</h2>
          <div className="mb-4 space-y-1.5">
            {week1.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold">{s.day}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{s.description}</div>
                </div>
                <div className="shrink-0 text-xs font-bold text-sky-600">{s.duration_min} min</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Logger une course</div>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="0.1" placeholder="Distance (km)" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" placeholder="Durée (min)" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <input placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={logRun} className="mt-2 w-full rounded-xl bg-sky-600 py-2 text-xs font-extrabold text-white">Enregistrer la course</button>
      </div>

      {runs && runs.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Historique</h2>
          <ul className="space-y-1.5">
            {runs.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <div>
                  <div className="font-bold">{r.distance_km} km · {r.duration_min} min</div>
                  <div className="text-[10px] text-muted-foreground">{r.pace} · {new Date(r.log_date).toLocaleDateString("fr-FR")}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== SOMMEIL =====
function SommeilDashboard({ profile }: { profile: any }) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const award = useServerFn(awardXp);
  const [form, setForm] = useState({ bedtime: "", wake_time: "", hours: "", quality_1_5: 3, notes: "" });
  const today = new Date().toISOString().slice(0, 10);

  const { data: logs } = useQuery({
    queryKey: ["sleep-logs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("sleep_logs").select("*").eq("user_id", userId!).order("log_date", { ascending: false }).limit(14);
      return data ?? [];
    },
  });

  async function submit() {
    if (!userId) return;
    const payload: any = {
      user_id: userId,
      log_date: today,
      bedtime: form.bedtime || null,
      wake_time: form.wake_time || null,
      hours: form.hours ? Number(form.hours) : null,
      quality_1_5: form.quality_1_5,
      notes: form.notes || null,
    };
    const { error } = await (supabase as any).from("sleep_logs").upsert(payload, { onConflict: "user_id,log_date" });
    if (error) return toast.error(error.message);
    await award({ data: { eventType: "sleep_logged", amount: 10 } });
    qc.invalidateQueries({ queryKey: ["sleep-logs"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Sommeil enregistré ✨ +10 XP");
  }

  const target = profile.onboarding_data?.target_hours ?? 8;
  const avg = logs && logs.length > 0 ? ((logs as any[]).filter((l) => l.hours).reduce((a, l) => a + Number(l.hours), 0) / Math.max(1, (logs as any[]).filter((l) => l.hours).length)) : 0;

  return (
    <div>
      <CoachHero coachId="sommeil" kicker="Cible" title={`${target}h de sommeil`} subtitle={avg ? `Moyenne 14j : ${avg.toFixed(1)}h` : undefined} />

      <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
        <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Nuit du jour</div>
        <div className="grid grid-cols-3 gap-2">
          <input type="text" placeholder="Coucher" value={form.bedtime} onChange={(e) => setForm({ ...form, bedtime: e.target.value })} className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs" />
          <input type="text" placeholder="Réveil" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs" />
          <input type="number" step="0.5" placeholder="Heures" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="rounded-xl border border-border bg-background px-2 py-1.5 text-xs" />
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Qualité</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setForm({ ...form, quality_1_5: n })} className={`flex-1 rounded-lg py-2 text-lg ${form.quality_1_5 === n ? "bg-purple-600 text-white" : "bg-muted"}`}>
                {["😴", "😐", "🙂", "😊", "🌟"][n - 1]}
              </button>
            ))}
          </div>
        </div>
        <input placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs" />
        <button onClick={submit} className="w-full rounded-xl bg-purple-600 py-2 text-xs font-extrabold text-white">Enregistrer ma nuit</button>
      </div>

      {logs && logs.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">14 dernières nuits</h2>
          <div className="flex h-20 items-end gap-1">
            {(logs as any[]).slice().reverse().map((l, i) => {
              const h = l.hours ? Number(l.hours) : 0;
              const pct = Math.min(100, (h / 10) * 100);
              return (
                <div key={i} className="flex-1 rounded-t-md bg-purple-200 relative" style={{ height: "100%" }}>
                  <div className="absolute bottom-0 left-0 right-0 rounded-t-md bg-purple-600" style={{ height: `${pct}%` }} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PERTE DE POIDS =====
function PoidsDashboard({ profile }: { profile: any }) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const award = useServerFn(awardXp);
  const [weight, setWeight] = useState("");

  const { data: measurements } = useQuery({
    queryKey: ["measurements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("body_measurements").select("*").eq("user_id", userId!).order("log_date", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  async function submit() {
    if (!userId || !weight) return toast.error("Poids requis");
    const { error } = await (supabase as any).from("body_measurements").insert({
      user_id: userId,
      log_date: new Date().toISOString().slice(0, 10),
      weight_kg: Number(weight),
    });
    if (error) return toast.error(error.message);
    await award({ data: { eventType: "measurement_logged", amount: 15 } });
    setWeight("");
    qc.invalidateQueries({ queryKey: ["measurements"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Poids enregistré ✨ +15 XP");
  }

  const start = Number(profile.onboarding_data?.weight_kg ?? 0);
  const target = Number(profile.onboarding_data?.target_kg ?? 0);
  const current = (measurements?.[0] as any)?.weight_kg ?? start;
  const totalToLose = start - target;
  const lost = start - current;
  const pct = totalToLose !== 0 ? Math.max(0, Math.min(100, (lost / totalToLose) * 100)) : 0;

  return (
    <div>
      <CoachHero coachId="poids" kicker="Progression" title={`${current} kg`} subtitle={`Objectif ${target} kg`} />

      <div className="card mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          <span>Démarrage {start} kg</span>
          <span>Objectif {target} kg</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-center text-sm font-extrabold text-pink-600">
          {lost > 0 ? `-${lost.toFixed(1)} kg` : lost < 0 ? `+${Math.abs(lost).toFixed(1)} kg` : "Démarre le suivi"}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Pesée du jour</div>
        <div className="flex gap-2">
          <input type="number" step="0.1" placeholder="Poids (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <button onClick={submit} className="rounded-xl bg-pink-600 px-4 text-xs font-extrabold text-white">Enregistrer</button>
        </div>
      </div>

      {measurements && measurements.length > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Évolution</h2>
          <ul className="space-y-1.5">
            {(measurements as any[]).slice(0, 8).map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                <span className="font-bold">{m.weight_kg} kg</span>
                <span className="text-muted-foreground">{new Date(m.log_date).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== HYDRATATION =====
function HydratationDashboard({ profile }: { profile: any }) {
  return (
    <div>
      <CoachHero coachId="hydratation" kicker="Module dédié" title="Suivi quotidien" subtitle="Bois assez chaque jour." />
      <Link to="/hydration" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-600 py-3 text-sm font-extrabold text-white shadow">
        <Droplet size={16} /> Ouvrir le suivi hydratation
      </Link>
      <div className="mt-4 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
        Objectif quotidien : {Math.round(Number(profile.onboarding_data?.weight_kg ?? 70) * 35)} ml d'eau, à ajuster selon ton activité et le climat.
      </div>
    </div>
  );
}
