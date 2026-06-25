import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useEffect, useMemo } from "react";
import { Page } from "@/components/AppShell";
import { levelFromXp, COACH_LIST } from "@/lib/coaches";
import { RingProgress, AreaChart } from "@/components/ui-premium";
import {
  Sparkles,
  ArrowRight,
  User,
  Flame,
  Activity,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  Droplet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Accueil — Vita" }] }),
  component: HomePage,
});

function HomePage() {
  const session = useSession();
  const navigate = useNavigate();
  const userId = session?.user.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: weeklyXp } = useQuery({
    queryKey: ["weekly-xp", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const { data } = await (supabase as any)
        .from("xp_events").select("amount, created_at")
        .eq("user_id", userId!).gte("created_at", since.toISOString());
      return (data ?? []) as { amount: number; created_at: string }[];
    },
  });

  const { data: trackers } = useQuery({
    queryKey: ["trackers-home", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("health_trackers").select("id, status").eq("user_id", userId!);
      return data ?? [];
    },
  });

  const { data: todayCheckins } = useQuery({
    queryKey: ["today-checkins", userId],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from("tracker_entries").select("id", { count: "exact", head: true })
        .eq("user_id", userId!).gte("created_at", start.toISOString());
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
      return d;
    });
    const buckets = days.map(() => 0);
    for (const e of weeklyXp ?? []) {
      const d = new Date(e.created_at); d.setHours(0, 0, 0, 0);
      const idx = days.findIndex((x) => x.getTime() === d.getTime());
      if (idx >= 0) buckets[idx] += e.amount;
    }
    const labels = ["L", "M", "M", "J", "V", "S", "D"];
    const today = new Date().getDay();
    const order = Array.from({ length: 7 }).map((_, i) => labels[(today - 6 + i + 7) % 7]);
    return { buckets, labels: order, total: buckets.reduce((a, b) => a + b, 0) };
  }, [weeklyXp]);

  if (!profile) return null;
  const prof = profile as any;
  const firstName = (prof.display_name ?? "").split(" ")[0] || "toi";
  const xp = prof.xp ?? 0;
  const { level, currentLevelXp, nextLevelXp, progress } = levelFromXp(xp);
  const xpInLevel = xp - currentLevelXp;
  const xpForNext = nextLevelXp - currentLevelXp;

  const activeCount = (trackers ?? []).filter((t: any) => t.status !== "done").length;
  const doneCount = (trackers ?? []).filter((t: any) => t.status === "done").length;
  const score = prof.health_score ?? 78;
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const max = COACH_LIST.find((x) => x.id === "muscu")!;

  return (
    <Page>
      {/* Header */}
      <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-2">
        <div className="min-w-0">
          <div className="eyebrow capitalize">{dateLabel}</div>
          <h1 className="mt-1 truncate text-[32px] font-bold leading-none">
            Bonjour, <span className="text-primary">{firstName}</span>
          </h1>
        </div>
        <Link
          to="/profile"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface-1 text-foreground/80 shadow-[var(--elev-1)] ring-1 ring-border transition active:scale-95"
          aria-label="Mon profil"
        >
          <User size={18} />
        </Link>
      </header>

      {/* BENTO */}
      <div className="bento stagger-fade">
        {/* HERO — Vita IA */}
        <Link to="/ai" className="hero-card size-lg block transition active:scale-[0.99]" style={{ gridColumn: "span 6" }}>
          <div className="relative flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/22 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
                <Sparkles size={11} /> Cabinet médical
              </div>
              <h2 className="mt-3 text-[22px] font-bold leading-tight">
                Comment tu te sens<br />aujourd'hui ?
              </h2>
              <p className="mt-1.5 max-w-[16rem] text-[12.5px] opacity-90">
                Vita t'écoute, t'oriente et t'explique — réponse structurée et tappable.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-primary-dark shadow-[0_10px_24px_-12px_rgba(0,0,0,0.30)]">
                Parler à Vita <ArrowRight size={14} />
              </div>
            </div>
            <div className="relative hidden h-28 w-28 shrink-0 sm:block">
              <div className="absolute inset-0 rounded-full bg-white/15 blur-xl" />
            </div>
          </div>
        </Link>

        {/* Score ring */}
        <div className="bento-tile tint-lavender size-md" style={{ gridColumn: "span 3" }}>
          <div className="eyebrow">Score santé</div>
          <div className="mt-3 flex items-center gap-3">
            <RingProgress value={score / 100} size={72} stroke={9}>
              <div className="text-[18px] font-bold leading-none">{score}</div>
            </RingProgress>
            <div>
              <div className="text-[12px] font-bold">Belle dynamique</div>
              <div className="text-[10.5px] text-muted-foreground">cette semaine</div>
            </div>
          </div>
        </div>

        {/* Level */}
        <div className="bento-tile tint-cream size-md" style={{ gridColumn: "span 3" }}>
          <div className="eyebrow">Niveau {level}</div>
          <div className="mt-3 text-[24px] font-bold leading-none">{xp} <span className="text-[12px] font-semibold text-muted-foreground">XP</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/60">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-[10.5px] text-muted-foreground">{xpInLevel}/{xpForNext} jusqu'au niveau {level + 1}</div>
        </div>

        {/* Quick stats — 3 small */}
        <StatBento icon={<CheckCircle2 size={14} />} label="Aujourd'hui" value={todayCheckins ?? 0} sub="check-ins" tint="tint-mint" />
        <StatBento icon={<Activity size={14} />} label="Actifs" value={activeCount} sub={`${doneCount} faits`} tint="tint-peach" />
        <StatBento icon={<Flame size={14} />} label="Semaine" value={weekly.total} sub="XP" tint="tint-sky" />

        {/* Weekly chart — wide */}
        <div className="bento-tile size-lg" style={{ gridColumn: "span 6" }}>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="eyebrow">7 derniers jours</div>
              <div className="mt-1 text-[18px] font-bold leading-none">Activité</div>
            </div>
            <div className="text-right">
              <div className="text-[20px] font-bold leading-none">{weekly.total}</div>
              <div className="text-[10.5px] text-muted-foreground">XP gagnés</div>
            </div>
          </div>
          <div className="mt-3">
            <AreaChart data={weekly.buckets} labels={weekly.labels} />
          </div>
        </div>

        {/* Coach Max — wide */}
        <Link to="/coach/$id" params={{ id: "muscu" }} className="bento-tile size-wide tint-peach block" style={{ gridColumn: "span 4" }}>
          <div className="flex items-center gap-3">
            <img src={max.mascot} alt="" width={64} height={64} className="h-16 w-16 shrink-0 object-contain drop-shadow-md" />
            <div className="min-w-0">
              <div className="eyebrow text-accent-foreground/70">Coach</div>
              <div className="text-[15px] font-bold leading-tight">Max</div>
              <div className="text-[11px] text-muted-foreground">Musculation · Pompes live</div>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-foreground">
            S'entraîner <ArrowRight size={13} />
          </div>
        </Link>

        {/* Santé tile */}
        <Link to="/sante" className="bento-tile size-narrow tint-mint flex flex-col justify-between" style={{ gridColumn: "span 2" }}>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-primary-dark">
            <HeartPulse size={16} />
          </div>
          <div>
            <div className="text-[13px] font-bold leading-tight">Bilan</div>
            <div className="text-[10.5px] text-muted-foreground">santé</div>
          </div>
        </Link>

        {/* Hydration */}
        <Link to="/hydration" className="bento-tile size-narrow tint-sky flex flex-col justify-between" style={{ gridColumn: "span 2" }}>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-primary-dark">
            <Droplet size={16} />
          </div>
          <div>
            <div className="text-[13px] font-bold leading-tight">Hydratation</div>
            <div className="text-[10.5px] text-muted-foreground">aujourd'hui</div>
          </div>
        </Link>

        {/* Suivis */}
        <Link to="/suivi" className="bento-tile size-wide flex items-center justify-between" style={{ gridColumn: "span 4" }}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
              <Dumbbell size={16} />
            </div>
            <div>
              <div className="text-[13.5px] font-bold leading-tight">Mes suivis</div>
              <div className="text-[11px] text-muted-foreground">{activeCount} en cours</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground" />
        </Link>
      </div>

      <p className="mt-6 px-1 text-center text-[11px] text-muted-foreground">
        Vita IA fournit des informations générales — pas un substitut médical.
      </p>
      <div className="h-6" />
    </Page>
  );
}

function StatBento({ icon, label, value, sub, tint }: { icon: React.ReactNode; label: string; value: number | string; sub: string; tint: string }) {
  return (
    <div className={`bento-tile size-sm ${tint} flex flex-col justify-between`} style={{ gridColumn: "span 2" }}>
      <div className="flex items-center gap-1.5 text-primary-dark/80">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <div>
        <div className="text-[22px] font-bold leading-none">{value}</div>
        <div className="text-[10.5px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
