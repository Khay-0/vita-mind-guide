import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";
import { Activity, Brain, Heart, Flame } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vita — Ton coach santé gamifié" },
      {
        name: "description",
        content:
          "Score santé, IA symptômes, tracking course GPS. Le suivi santé qui devient un jeu.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/home" });
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-12 safe-top">
        <div className="flex-1 text-center">
          <div className="animate-float mx-auto mb-6 inline-flex h-28 w-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Heart size={64} strokeWidth={2.5} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Vita<span className="text-primary">.</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Ton coach santé personnel, gamifié & alimenté par l'IA.
          </p>

          <div className="mt-10 space-y-3 text-left">
            <Feature
              icon={<Brain className="text-primary" />}
              title="IA santé"
              text="Analyse de symptômes, photos et bilans complets."
            />
            <Feature
              icon={<Activity className="text-info" />}
              title="Tracking course & vélo"
              text="GPS, distance, vitesse moyenne, calories."
            />
            <Feature
              icon={<Flame className="text-streak" />}
              title="Streaks & XP"
              text="Garde ta série et monte de niveau chaque jour."
            />
          </div>
        </div>

        <div className="space-y-3 pb-8 pt-8">
          <Link to="/auth" className="btn-chunky w-full">
            Commencer
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="btn-chunky btn-chunky-secondary w-full"
          >
            J'ai déjà un compte
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="card-chunky flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
        {icon}
      </div>
      <div>
        <div className="font-extrabold">{title}</div>
        <div className="text-sm text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}
