import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useEffect, useMemo } from "react";
import { Page } from "@/components/AppShell";
import { levelFromXp, COACH_LIST } from "@/lib/coaches";
import {
  PremiumCard,
  SectionHeader,
  StatTile,
  RingProgress,
  AreaChart,
} from "@/components/ui-premium";
import {
  Sparkles,
  ArrowRight,
  Bell,
  User,
  Flame,
  Activity,
  CheckCircle2,
  Target,
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

  const { data: activeCoaches } = useQuery({
    queryKey: ["coach-profiles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("coach_profiles")
        .select("coach_id, updated_at")
        .eq("user_id", userId!);
      return (data ?? []) as { coach_id: string; updated_at: string }[];
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
        .from("xp_events")
        .select("amount, created_at")
        .eq("user_id", userId!)
        .gte("created_at", since.toISOString());
      return (data ?? []) as { amount: number; created_at: string }[];
    },
  });

  const { data: trackers } = useQuery({
    queryKey: ["trackers-home", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("health_trackers")
        .select("id, status")
        .eq("user_id", userId!);
      return data ?? [];
    },
  });

  const { data: todayCheckins } = useQuery({
    queryKey: ["today-checkins", userId],
    enabled: !!userId,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await (supabase as any)
        .from("tracker_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .gte("created_at", start.toISOString());
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [profile, navigate]);

  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const buckets = days.map(() => 0);
    for (const e of weeklyXp ?? []) {
      const d = new Date(e.created_at);
      d.setHours(0, 0, 0, 0);
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

  return (
    <Page>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-2 pt-2">
        <div className="min-w-0">
          <div className="text-[12px] font-medium capitalize text-muted-foreground">{dateLabel}</div>
          <h1 className="mt-0.5 text-[30px] font-bold tracking-tight">Bonjour, {firstName}</h1>
        </div>
        <Link to="/profile" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-1 border border-border text-foreground/80 transition active:scale-95" aria-label="Mon profil">
          <User size={18} />
        </Link>
      </div>

      <div className="space-y-4 stagger-fade">
        {/* HERO — Vita IA consultation (primary CTA, Claude recommendation) */}
        <Link
          to="/ai"
          className="group relative block overflow-hidden rounded-[32px] bg-gradient-to-br from-primary via-emerald-500 to-teal-600 p-6 text-primary-foreground shadow-[var(--elev-3)] transition active:scale-[0.99]"
        >
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
              <Sparkles size={12} /> Cabinet médical
            </div>
            <h2 className="mt-3 text-[24px] font-bold leading-tight">
              Comment tu te sens aujourd'hui, {firstName} ?
            </h2>
            <p className="mt-1.5 text-[13px] opacity-90">
              Vita IA t'écoute — symptômes, photos, questions médicales. Réponse claire et suivi personnalisé.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-bold text-primary shadow-md">
              Parler à Vita <ArrowRight size={16} />
            </div>
          </div>
        </Link>

        {/* Score + XP card */}
        <div className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-emerald-50 via-surface-1 to-violet-50 p-5 shadow-[var(--elev-2)]">
          <div className="flex items-center gap-5">
            <RingProgress value={score / 100} size={92} stroke={10}>
              <div>
                <div className="text-[24px] font-bold leading-none tracking-tight">{score}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Score</div>
              </div>
            </RingProgress>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Niveau {level}</div>
              <div className="mt-0.5 text-[18px] font-bold leading-tight">Belle dynamique</div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                {xpInLevel} / {xpForNext} XP
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border/70">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={<CheckCircle2 size={12} />} label="Aujourd'hui" value={todayCheckins ?? 0} trend="check-ins" accent="text-primary" />
          <StatTile icon={<Activity size={12} />} label="Actifs" value={activeCount} trend={`${doneCount} terminés`} accent="text-accent" />
          <StatTile icon={<Flame size={12} />} label="Semaine" value={weekly.total} trend="XP gagnés" accent="text-[var(--streak)]" />
        </div>

        {/* Weekly activity chart */}
        <PremiumCard>
          <SectionHeader eyebrow="7 derniers jours" title="Activité hebdomadaire" />
          <AreaChart data={weekly.buckets} labels={weekly.labels} />
        </PremiumCard>

        {/* Active coaches — Max only is real, others teased */}
        <div>
          <SectionHeader
            eyebrow="Spécialistes"
            title="Coach Max"
            action={<Link to="/coach" className="text-[12px] font-semibold text-primary">Tout voir</Link>}
          />
          <Link
            to="/coach/$id"
            params={{ id: "muscu" }}
            className="flex items-center gap-4 rounded-[24px] border border-border bg-gradient-to-br from-orange-50 to-rose-50 p-4 transition active:scale-[0.99]"
          >
            {(() => {
              const c = COACH_LIST.find((x) => x.id === "muscu")!;
              return (
                <>
                  <img src={c.mascot} alt="" width={72} height={72} className="h-16 w-16 object-contain drop-shadow-md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Disponible</div>
                    <div className="text-[15px] font-bold">{c.fullName.split("—")[0].trim()} — Musculation</div>
                    <div className="text-[12px] text-muted-foreground">{c.tagline}</div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground" />
                </>
              );
            })()}
          </Link>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            Nutrition, Sommeil, Running… arrivent en Premium prochainement.
          </p>
        </div>

        {/* Reminder */}
        {activeCount > 0 && (
          <Link to="/suivi" className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-4 transition active:scale-[0.99]">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Bell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold leading-tight">Mets à jour tes suivis</div>
              <div className="text-[12px] text-muted-foreground">
                {activeCount} suivi{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""} en attente
              </div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground" />
          </Link>
        )}
      </div>
      <div className="h-6" />
    </Page>
  );
}
// Unused but kept to preserve original imports.
void Target;
