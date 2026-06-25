import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateAssessment } from "@/lib/ai.functions";
import { Page } from "@/components/AppShell";
import {
  ClipboardCheck,
  Apple,
  Brain,
  Footprints,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bilan")({
  head: () => ({ meta: [{ title: "Bilan santé — Vita" }] }),
  component: BilanPage,
});

type Assessment = {
  id?: string;
  overall_score: number;
  cardio_score: number | null;
  nutrition_score: number | null;
  sleep_score: number | null;
  mental_score: number | null;
  activity_score: number | null;
  bmi: number | null;
  strengths: string[];
  risks: string[];
  priority_actions: string[];
  ai_summary: string | null;
  created_at?: string;
};

function BilanPage() {
  const session = useSession();
  const userId = session?.user.id;
  const genFn = useServerFn(generateAssessment);
  const [generating, setGenerating] = useState(false);

  const { data: latest, refetch } = useQuery({
    queryKey: ["assessment-latest", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("health_assessments")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Assessment | null;
    },
  });

  async function runAssessment() {
    if (!userId) return;
    setGenerating(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select("mood, water_glasses")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo);
      const { data: acts } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo);

      const moods = (checkins ?? [])
        .map((c) => c.mood as number | null)
        .filter((m): m is number => !!m);
      const water = (checkins ?? []).map((c) => c.water_glasses ?? 0);
      const avgWater = water.length ? water.reduce((a, b) => a + b, 0) / water.length : 0;

      const r = await genFn({
        data: {
          profile: profile as any,
          recentMoods: moods,
          activityCount30d: acts?.length ?? 0,
          avgWaterGlasses: avgWater,
        },
      });

      await supabase.from("health_assessments").insert({
        user_id: userId,
        overall_score: r.overall_score,
        cardio_score: r.cardio_score,
        nutrition_score: r.nutrition_score,
        sleep_score: r.sleep_score,
        mental_score: r.mental_score,
        activity_score: r.activity_score,
        bmi: r.bmi,
        strengths: r.strengths ?? [],
        risks: r.risks ?? [],
        priority_actions: r.priority_actions ?? [],
        ai_summary: r.summary,
        raw_json: r as any,
      });

      // update health_score on profile
      await supabase
        .from("profiles")
        .update({ health_score: r.overall_score, xp: ((profile?.xp ?? 0) as number) + 25 })
        .eq("user_id", userId);

      toast.success("Bilan généré ! +25 XP");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur bilan");
    } finally {
      setGenerating(false);
    }
  }

  if (!latest) {
    return (
      <Page title="Bilan santé" subtitle="Analyse complète et personnalisée">
        <div className="card-chunky bg-gradient-to-b from-accent/20 to-card text-center">
          <ClipboardCheck className="mx-auto mb-3 text-accent" size={48} />
          <h2 className="mb-1 text-lg font-extrabold">Premier bilan</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Vita analyse ton profil, ton humeur, ton activité et ton hydratation
            pour te donner un état complet de ta santé avec des actions
            concrètes.
          </p>
          <button
            disabled={generating}
            onClick={runAssessment}
            className="btn-chunky w-full"
          >
            {generating ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Analyse en cours…
              </>
            ) : (
              <>
                <Sparkles size={18} /> Lancer mon bilan
              </>
            )}
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Bilan santé"
      subtitle={
        latest.created_at
          ? `Mis à jour le ${new Date(latest.created_at).toLocaleDateString("fr-FR")}`
          : undefined
      }
      right={
        <button
          disabled={generating}
          onClick={runAssessment}
          className="rounded-xl border-2 border-border bg-card p-2"
          title="Refaire le bilan"
        >
          <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
        </button>
      }
    >
      <div className="card-chunky animate-pop mb-4 bg-gradient-to-b from-secondary to-card text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Score global
        </div>
        <ScoreRing value={latest.overall_score} />
        {latest.bmi && (
          <div className="mt-2 text-xs text-muted-foreground">
            IMC&nbsp;: <span className="font-extrabold">{latest.bmi.toFixed(1)}</span>
          </div>
        )}
      </div>

      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
        Domaines
      </h2>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <ScoreBar label="Nutrition" value={latest.nutrition_score} icon={<Apple size={16} />} color="bg-emerald-500" />
        <ScoreBar label="Mental" value={latest.mental_score} icon={<Brain size={16} />} color="bg-purple-500" />
        <ScoreBar label="Activité" value={latest.activity_score} icon={<Footprints size={16} />} color="bg-amber-500" />
      </div>

      {latest.ai_summary && (
        <div className="card-chunky mb-4 bg-card">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="text-primary" size={18} />
            <h3 className="font-extrabold">Résumé</h3>
          </div>
          <p className="text-sm leading-relaxed">{latest.ai_summary}</p>
        </div>
      )}

      <Section
        title="Forces"
        icon={<TrendingUp className="text-emerald-500" size={18} />}
        items={latest.strengths ?? []}
        tone="success"
      />
      <Section
        title="Points d'attention"
        icon={<AlertTriangle className="text-amber-500" size={18} />}
        items={latest.risks ?? []}
        tone="warning"
      />
      <Section
        title="3 actions cette semaine"
        icon={<ClipboardCheck className="text-primary" size={18} />}
        items={latest.priority_actions ?? []}
        tone="action"
      />
    </Page>
  );
}

function ScoreRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const size = 130;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const color =
    pct >= 75 ? "stroke-emerald-500" : pct >= 50 ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className={`fill-none ${color} transition-all`}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-extrabold tabular-nums">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          / 100
        </div>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: string;
}) {
  const v = value ?? 0;
  return (
    <div className="card-chunky !p-3">
      <div className="mb-1 flex items-center justify-between text-xs font-extrabold">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="tabular-nums">{v}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  tone: "success" | "warning" | "action";
}) {
  if (!items.length) return null;
  const bg =
    tone === "success"
      ? "bg-emerald-500/10 border-emerald-500/30"
      : tone === "warning"
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-primary/10 border-primary/30";
  return (
    <div className={`card-chunky mb-3 border-2 ${bg}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="font-extrabold">{title}</h3>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="select-none">•</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
