import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Sparkles, Dumbbell, HeartPulse, Activity } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/home", label: "Accueil", icon: Home },
  { to: "/ai", label: "Vita", icon: Sparkles },
  { to: "/coach", label: "Coachs", icon: Dumbbell },
  { to: "/sante", label: "Santé", icon: HeartPulse },
  { to: "/suivi", label: "Suivis", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 pb-28">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
        <div className="mx-auto max-w-xl px-3 pb-2 pt-1">
          <div className="glass flex items-center justify-around rounded-[26px] px-2 py-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)]">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = pathname === to || pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className="group relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5"
                >
                  <span
                    className={`grid h-9 w-12 place-items-center rounded-2xl transition-all duration-300 ${
                      active ? "bg-primary/12 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
                  </span>
                  <span
                    className={`text-[10px] font-semibold tracking-tight transition ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}

export function Page({
  title,
  subtitle,
  children,
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-6">
      {(title || right) && (
        <header className="mb-5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <h1 className="truncate text-[28px] font-bold tracking-tight">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[13.5px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {right}
        </header>
      )}
      {children}
    </div>
  );
}
