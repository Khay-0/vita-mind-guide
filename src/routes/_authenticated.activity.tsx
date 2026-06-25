import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import { Activity, Bike, Footprints, Play, Pause, Square, MapPin } from "lucide-react";
import { formatDuration, haversine } from "@/lib/score";
import { toast } from "sonner";

type Kind = "run" | "bike" | "walk";
type Point = { lat: number; lng: number; t: number };

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activité — Vita" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const session = useSession();
  const userId = session?.user.id;
  const [kind, setKind] = useState<Kind>("run");
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [distance, setDistance] = useState(0); // meters
  const [duration, setDuration] = useState(0); // seconds
  const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
  const [permError, setPermError] = useState<string | null>(null);

  const watchId = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<number>(0);
  const accumSec = useRef<number>(0);
  const pausedAt = useRef<number>(0);

  function start() {
    if (!navigator.geolocation) {
      setPermError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    setPoints([]);
    setDistance(0);
    setDuration(0);
    setCurrentSpeed(0);
    accumSec.current = 0;
    startTime.current = Date.now();
    setRunning(true);
    setPaused(false);
    beginWatch();
    beginTick();
  }

  function beginTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const liveSec = (Date.now() - startTime.current) / 1000;
      setDuration(Math.floor(accumSec.current + liveSec));
    }, 500);
  }

  function beginWatch() {
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermError(null);
        const p: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
        };
        setPoints((prev) => {
          const next = [...prev, p];
          if (prev.length > 0) {
            const last = prev[prev.length - 1];
            const d = haversine(last, p);
            // filter GPS jitter
            if (d < 200) {
              setDistance((curr) => curr + d);
            }
          }
          if (pos.coords.speed != null && pos.coords.speed >= 0) {
            setCurrentSpeed(pos.coords.speed * 3.6);
          }
          return next;
        });
      },
      (err) => {
        setPermError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
  }

  function pause() {
    setPaused(true);
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (tickRef.current) clearInterval(tickRef.current);
    accumSec.current += (Date.now() - startTime.current) / 1000;
    pausedAt.current = Date.now();
  }

  function resume() {
    setPaused(false);
    startTime.current = Date.now();
    beginWatch();
    beginTick();
  }

  async function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (tickRef.current) clearInterval(tickRef.current);
    watchId.current = null;
    tickRef.current = null;

    const totalSec = paused
      ? Math.floor(accumSec.current)
      : Math.floor(accumSec.current + (Date.now() - startTime.current) / 1000);
    setRunning(false);
    setPaused(false);

    if (totalSec < 5 || distance < 10) {
      toast.info("Trop court pour être enregistré.");
      return;
    }
    if (!userId) return;

    const avgKmh = (distance / 1000) / (totalSec / 3600);
    const maxKmh = points.length > 1 ? estimateMaxSpeed(points) : 0;
    const calories = Math.round(estimateCalories(kind, distance, totalSec));

    const { error } = await supabase.from("activities").insert({
      user_id: userId,
      kind,
      distance_m: Math.round(distance),
      duration_s: totalSec,
      avg_speed_kmh: avgKmh,
      max_speed_kmh: maxKmh,
      calories,
      route: { points } as any,
      started_at: new Date(Date.now() - totalSec * 1000).toISOString(),
      ended_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Award XP scaled by distance (1 xp per 100m)
    const earned = Math.round((distance / 100) * (kind === "bike" ? 0.5 : 1));
    const { data: prof } = await supabase
      .from("profiles")
      .select("xp")
      .eq("user_id", userId)
      .maybeSingle();
    await supabase
      .from("profiles")
      .update({
        xp: (prof?.xp ?? 0) + earned,
        last_active_date: new Date().toISOString().slice(0, 10),
      })
      .eq("user_id", userId);
    toast.success(`Session enregistrée ! +${earned} XP`);

    setPoints([]);
    setDistance(0);
    setDuration(0);
  }

  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const km = distance / 1000;
  const pace = km > 0 ? duration / 60 / km : 0; // min/km
  const avg = duration > 0 ? km / (duration / 3600) : 0;

  return (
    <Page title="Activité" subtitle={running ? "En cours…" : "Démarre une session"}>
      {!running && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <KindBtn k="run" current={kind} set={setKind} icon={<Footprints size={22} />} label="Course" />
          <KindBtn k="bike" current={kind} set={setKind} icon={<Bike size={22} />} label="Vélo" />
          <KindBtn k="walk" current={kind} set={setKind} icon={<Activity size={22} />} label="Marche" />
        </div>
      )}

      <div className="card-chunky animate-pop mb-4 bg-gradient-to-b from-secondary to-card">
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Distance
          </div>
          <div className="text-6xl font-extrabold tabular-nums">{km.toFixed(2)}</div>
          <div className="text-sm font-bold text-muted-foreground">km</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Temps" value={formatDuration(duration)} />
          <Metric label="Allure" value={pace > 0 ? `${formatDuration(pace * 60)}/km` : "—"} />
          <Metric
            label={running ? "Vitesse" : "Moyenne"}
            value={`${(running ? currentSpeed : avg).toFixed(1)} km/h`}
          />
        </div>
      </div>

      {permError && (
        <div className="card-chunky mb-4 border-destructive bg-destructive/10 text-sm text-destructive">
          <MapPin className="mb-1 inline" size={16} /> {permError}
          <div className="mt-1 text-xs">
            Autorise la géolocalisation dans les réglages du navigateur, puis recommence.
          </div>
        </div>
      )}

      {!running ? (
        <button onClick={start} className="btn-chunky w-full text-lg">
          <Play size={22} fill="currentColor" /> Démarrer
        </button>
      ) : (
        <div className="space-y-3">
          {!paused ? (
            <button onClick={pause} className="btn-chunky btn-chunky-accent w-full">
              <Pause size={20} /> Pause
            </button>
          ) : (
            <button onClick={resume} className="btn-chunky w-full">
              <Play size={20} /> Reprendre
            </button>
          )}
          <button onClick={stop} className="btn-chunky btn-chunky-secondary w-full">
            <Square size={20} /> Terminer et enregistrer
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Garde l'écran allumé pour un suivi GPS continu.
      </p>
    </Page>
  );
}

function KindBtn({
  k,
  current,
  set,
  icon,
  label,
}: {
  k: Kind;
  current: Kind;
  set: (k: Kind) => void;
  icon: React.ReactNode;
  label: string;
}) {
  const active = k === current;
  return (
    <button
      onClick={() => set(k)}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 font-extrabold ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
      }`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-extrabold tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function estimateMaxSpeed(pts: Point[]) {
  let max = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i]);
    const dt = (pts[i].t - pts[i - 1].t) / 1000;
    if (dt > 0) {
      const v = (d / dt) * 3.6;
      if (v > max && v < 80) max = v;
    }
  }
  return max;
}

function estimateCalories(kind: Kind, meters: number, seconds: number) {
  const hours = seconds / 3600;
  const met = kind === "bike" ? 7.5 : kind === "walk" ? 3.8 : 9.8;
  const kg = 70; // default weight
  return met * kg * hours;
  void meters;
}
