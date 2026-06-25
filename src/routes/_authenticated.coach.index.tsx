import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/AppShell";
import { COACH_LIST } from "@/lib/coaches";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

// Phase 1 lineup: only Coach Max (musculation) is shipped alongside Vita IA.
// The other coaches are gated behind a "Premium — bientôt" lock.
const AVAILABLE_COACHES = new Set<string>(["muscu"]);

export const Route = createFileRoute("/_authenticated/coach/")({
  head: () => ({ meta: [{ title: "Coachs spécialistes — Vita" }] }),
  component: CoachGallery,
});

function CoachGallery() {
  const session = useSession();
  const userId = session?.user.id;

  const { data: profiles } = useQuery({
    queryKey: ["coach-profiles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("coach_profiles")
        .select("coach_id")
        .eq("user_id", userId!);
      return ((data ?? []) as { coach_id: string }[]).map((p) => p.coach_id);
    },
  });

  const activeIds = new Set(profiles ?? []);

  return (
    <Page>
      <div className="mb-5 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Compléments à Vita IA
        </div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Coachs spécialistes</h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          Vita IA reste ton médecin principal. Active un coach pour aller plus loin sur un objectif précis.
        </p>
      </div>

      <Link
        to="/ai"
        className="mb-5 flex items-center gap-3 rounded-[22px] border border-primary/30 bg-gradient-to-br from-primary/10 to-emerald-50 p-4 transition active:scale-[0.99]"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold">Tu cherches un conseil santé ?</div>
          <div className="text-[11.5px] text-muted-foreground">
            Parle d'abord à Vita IA — elle t'orientera vers le bon coach.
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 stagger-fade">
        {COACH_LIST.map((c) => {
          const available = AVAILABLE_COACHES.has(c.id);
          const active = activeIds.has(c.id);
          const cardClasses = available
            ? "group relative overflow-hidden rounded-[24px] border border-border bg-surface-1 p-4 shadow-[var(--elev-1)] transition active:scale-[0.98] hover:shadow-[var(--elev-2)]"
            : "group relative overflow-hidden rounded-[24px] border border-dashed border-border bg-surface-2 p-4 text-left transition opacity-90";
          const content = (
            <>
              {available && active && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-0.5 rounded-full bg-success/12 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-success">
                  <CheckCircle2 size={10} /> Actif
                </div>
              )}
              {!available && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/85 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-background">
                  <Lock size={10} /> Bientôt
                </div>
              )}
              <div
                className={`mb-3 grid h-28 place-items-center rounded-2xl bg-gradient-to-br ${c.gradient} ${!available ? "saturate-50" : ""}`}
              >
                <img
                  src={c.mascot}
                  alt={c.name}
                  width={112}
                  height={112}
                  loading="lazy"
                  className={`h-24 w-24 object-contain drop-shadow-lg ${!available ? "opacity-60" : ""}`}
                />
              </div>
              <div className="text-[14px] font-bold leading-tight">{c.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">
                {c.tagline}
              </div>
              <div
                className="mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                style={{ backgroundColor: available ? c.accent : "var(--color-muted-foreground)" }}
              >
                {available ? (active ? "Ouvrir" : "Démarrer") : "Premium"}
              </div>
            </>
          );
          if (!available) {
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  toast.info(`${c.name} arrive bientôt`, {
                    description:
                      "Ce coach sera disponible en Premium. Pour l'instant, Coach Max et Vita IA t'accompagnent.",
                  })
                }
                className={cardClasses}
              >
                {content}
              </button>
            );
          }
          return (
            <Link
              key={c.id}
              to="/coach/$id"
              params={{ id: c.id }}
              className={cardClasses}
            >
              {content}
            </Link>
          );
        })}
      </div>

      <p className="mt-5 px-1 text-[11px] text-muted-foreground">
        Nutrition, Sommeil, Hydratation, Running et Poids rejoignent l'app en Premium dans les prochaines semaines.
      </p>

      <div className="h-6" />
    </Page>
  );
}
