import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { Heart, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — Vita" }] }),
  component: AuthPage,
});

function AuthPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);

  useEffect(() => {
    if (session) navigate({ to: "/home", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home" },
        });
        if (error) throw error;
        toast.success("Compte créé !");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithProvider(provider: "google" | "apple") {
    if (oauthLoading) return;
    setOauthLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/home", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Connexion impossible");
    } finally {
      setOauthLoading(null);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pt-10 safe-top">
        <Link to="/" className="mb-2 text-sm font-bold text-muted-foreground">
          ← Retour
        </Link>
        <div className="mt-6 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_6px_0_0_var(--color-primary-dark)]">
            <Heart size={32} strokeWidth={2.5} fill="currentColor" />
          </div>
          <h1 className="text-2xl font-extrabold">Vita</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ton coach santé personnel
          </p>
        </div>

        <div className="segmented mt-8">
          <button
            type="button"
            data-active={!isSignup}
            onClick={() => setMode("signin")}
          >
            Connexion
          </button>
          <button
            type="button"
            data-active={isSignup}
            onClick={() => setMode("signup")}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Mail size={14} /> Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-chunky"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Lock size={14} /> Mot de passe
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="input-chunky"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={loading} className="btn-chunky w-full">
            {loading ? "…" : isSignup ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            ou
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => signInWithProvider("google")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-card px-4 py-3 text-sm font-bold shadow-[0_4px_0_0_var(--color-foreground)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--color-foreground)] disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.95 10.71A5.4 5.4 0 0 1 3.66 9c0-.6.1-1.17.29-1.71V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l2.99-2.34z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"/>
            </svg>
            {oauthLoading === "google" ? "…" : "Continuer avec Google"}
          </button>
          <button
            type="button"
            onClick={() => signInWithProvider("apple")}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-foreground bg-foreground px-4 py-3 text-sm font-bold text-background shadow-[0_4px_0_0_var(--color-foreground)] transition-transform active:translate-y-0.5 active:shadow-[0_2px_0_0_var(--color-foreground)] disabled:opacity-60"
          >
            <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
              <path d="M13.05 9.58c-.02-2.16 1.77-3.2 1.85-3.25-1.01-1.47-2.58-1.68-3.14-1.7-1.34-.13-2.61.79-3.29.79-.68 0-1.73-.77-2.84-.75-1.46.02-2.81.85-3.56 2.16-1.52 2.63-.39 6.52 1.09 8.65.72 1.04 1.58 2.21 2.7 2.17 1.08-.04 1.49-.7 2.8-.7 1.31 0 1.67.7 2.82.67 1.16-.02 1.9-1.05 2.61-2.1.83-1.21 1.17-2.39 1.19-2.45-.03-.01-2.28-.87-2.3-3.46zM10.91 3.2c.59-.72.99-1.71.88-2.7-.85.03-1.88.57-2.5 1.28-.55.63-1.03 1.65-.9 2.61.95.07 1.92-.48 2.52-1.19z"/>
            </svg>
            {oauthLoading === "apple" ? "…" : "Continuer avec Apple"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {isSignup ? "En créant un compte, tu acceptes nos conditions." : "Heureux de te revoir 💚"}
        </p>
      </div>
    </div>
  );
}
