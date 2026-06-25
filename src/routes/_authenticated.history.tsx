import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import {
  Activity,
  Brain,
  Footprints,
  Bike,
  MessageSquare,
  Stethoscope,
} from "lucide-react";
import { formatDuration } from "@/lib/score";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Historique — Vita" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const session = useSession();
  const userId = session?.user.id;

  const { data: activities } = useQuery({
    queryKey: ["activities", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: threads } = useQuery({
    queryKey: ["threads-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  return (
    <Page title="Historique">
      <h2 className="mb-2 mt-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
        Sessions sport
      </h2>
      {activities && activities.length === 0 && (
        <Empty icon={<Activity />} text="Aucune session pour l'instant" />
      )}
      <div className="space-y-2">
        {activities?.map((a) => {
          const Icon =
            a.kind === "bike" ? Bike : a.kind === "walk" ? Activity : Footprints;
          return (
            <div key={a.id} className="card-chunky flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info/15 text-info">
                <Icon size={22} />
              </div>
              <div className="flex-1">
                <div className="font-extrabold capitalize">
                  {a.kind === "run"
                    ? "Course"
                    : a.kind === "bike"
                      ? "Vélo"
                      : "Marche"}{" "}
                  • {((a.distance_m ?? 0) / 1000).toFixed(2)} km
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(a.duration_s ?? 0)} •{" "}
                  {(a.avg_speed_kmh ?? 0).toFixed(1)} km/h • {a.calories ?? 0}{" "}
                  kcal
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
        Conversations IA
      </h2>
      {threads && threads.length === 0 && (
        <Empty icon={<Brain />} text="Pas encore de conversation" />
      )}
      <div className="space-y-2">
        {threads?.map((t) => {
          const Icon =
            t.kind === "symptom"
              ? Stethoscope
              : t.kind === "question"
                ? MessageSquare
                : Brain;
          return (
            <div key={t.id} className="card-chunky flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold">{t.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">
                  {t.last_message_preview ?? "—"}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(t.updated_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="card-chunky flex flex-col items-center gap-2 py-6 text-muted-foreground">
      <div className="text-3xl">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
