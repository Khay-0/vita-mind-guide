import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { PremiumCard, SectionHeader, RingProgress } from "@/components/ui-premium";
import {
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  Upload,
  HeartPulse,
  Activity as ActivityIcon,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sante")({
  head: () => ({ meta: [{ title: "Santé — Vita" }] }),
  component: SantePage,
});

function SantePage() {
  const navigate = useNavigate();
  const session = useSession();
  const userId = session?.user.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle();
      return data;
    },
  });

  const { data: assessments } = useQuery({
    queryKey: ["assessments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("health_assessments")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: trackerCount } = useQuery({
    queryKey: ["sante-trackers", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("health_trackers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      return count ?? 0;
    },
  });

  const prof = profile as any;
  const score = prof?.health_score ?? 78;

  return (
    <Page>
      <div className="mb-5 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Données & analyses</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Santé</h1>
      </div>

      <div className="space-y-4 stagger-fade">
        {/* Hero score */}
        <PremiumCard className="!p-5">
          <div className="flex items-center gap-5">
            <RingProgress value={score / 100} size={100} stroke={10}>
              <div>
                <div className="text-[26px] font-bold leading-none tracking-tight">{score}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">/ 100</div>
              </div>
            </RingProgress>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score santé</div>
              <div className="text-[18px] font-bold leading-tight">
                {score >= 80 ? "Excellent" : score >= 60 ? "Bonne forme" : "À surveiller"}
              </div>
              <Link to="/bilan" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
                Voir le bilan détaillé <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </PremiumCard>

        {/* Upload */}
        <button
          onClick={() => navigate({ to: "/ai" })}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-left transition active:scale-[0.99]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Upload size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold leading-tight">Importer une analyse</div>
            <div className="text-[12px] text-muted-foreground">PDF, photo, prise de sang — Vita IA résume et explique</div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground" />
        </button>

        {/* Dossier */}
        <div>
          <SectionHeader eyebrow="Mon dossier" title="Espace santé" />
          <div className="grid grid-cols-2 gap-3">
            <SanteCard to="/bilan" icon={<ClipboardCheck size={20} />} title="Bilan santé" hint="Scores & analyses" />
            <SanteCard to="/history" icon={<ActivityIcon size={20} />} title="Historique" hint={`${assessments?.length ?? 0} analyses récentes`} />
            <SanteCard to="/suivi" icon={<HeartPulse size={20} />} title="Mes suivis" hint={`${trackerCount ?? 0} suivi(s)`} />
            <SanteCard to="/ai" icon={<Calendar size={20} />} title="Préparer un RDV" hint="Brief médical IA" />
          </div>
        </div>

        {/* Recent analyses */}
        {(assessments?.length ?? 0) > 0 && (
          <div>
            <SectionHeader eyebrow="Récents" title="Analyses IA" />
            <div className="space-y-2">
              {(assessments ?? []).slice(0, 3).map((a: any) => (
                <Link key={a.id} to="/history" className="flex items-center gap-3 rounded-2xl border border-border bg-surface-1 p-3 transition active:scale-[0.99]">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{a.title ?? a.summary?.slice(0, 50) ?? "Analyse"}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("fr-FR")}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AI suggestions */}
        <div>
          <SectionHeader eyebrow="Vita IA" title="Suggestions" />
          <div className="space-y-2">
            <AISuggestion text="Résumer ma dernière prise de sang" />
            <AISuggestion text="Expliquer mes résultats" />
            <AISuggestion text="Préparer mon prochain rendez-vous" />
          </div>
        </div>
      </div>

      <div className="h-6" />
    </Page>
  );
}

function SanteCard({ to, icon, title, hint }: { to: string; icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <Link to={to as any} className="card-premium card-premium-hover relative h-full p-4">
      <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground/80">
        {icon}
      </div>
      <div className="text-[14px] font-semibold leading-tight">{title}</div>
      {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function AISuggestion({ text }: { text: string }) {
  return (
    <Link to="/ai" className="flex items-center justify-between rounded-2xl border border-border bg-surface-1 px-4 py-3 transition active:scale-[0.99]">
      <span className="flex items-center gap-2 text-[13px] font-medium">
        <Sparkles size={13} className="text-primary" />
        {text}
      </span>
      <ArrowRight size={14} className="text-muted-foreground" />
    </Link>
  );
}
