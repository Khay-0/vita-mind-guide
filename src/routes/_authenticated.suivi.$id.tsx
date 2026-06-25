import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useRef, useEffect } from "react";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import {
  Camera,
  Trash2,
  ArrowLeft,
  Check,
  FileText,
  CheckCircle2,
  X,
  Mic,
  Square,
  MessageCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { computeImprovement } from "./_authenticated.suivi.index";
import { COACHES, type CoachId } from "@/lib/coaches";


export const Route = createFileRoute("/_authenticated/suivi/$id")({
  head: () => ({ meta: [{ title: "Suivi — Vita" }] }),
  component: SuiviDetail,
});

const FEELINGS = [
  { v: 1, e: "😣", label: "Pire" },
  { v: 2, e: "🙁", label: "Moyen" },
  { v: 3, e: "😐", label: "Stable" },
  { v: 4, e: "🙂", label: "Mieux" },
  { v: 5, e: "😄", label: "Top" },
];

function SuiviDetail() {
  const { id } = Route.useParams();
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [feeling, setFeeling] = useState(3);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [openReport, setOpenReport] = useState<any | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showPhotoHelp, setShowPhotoHelp] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);


  const { data: tracker } = useQuery({
    queryKey: ["tracker", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("health_trackers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["tracker-entries", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("tracker_entries")
        .select("*")
        .eq("tracker_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["tracker-reports", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("tracker_reports")
        .select("*")
        .eq("tracker_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function submit() {
    if (!userId) return;
    setSaving(true);
    try {
      let photo_url: string | null = null;
      if (photo) {
        const path = `${userId}/tracker-${id}/${crypto.randomUUID()}-${photo.name}`;
        const { error } = await supabase.storage.from("symptom-photos").upload(path, photo);
        if (error) throw error;
        photo_url = path;
      }
      const { error } = await (supabase as any)
        .from("tracker_entries")
        .insert({ tracker_id: id, user_id: userId, feeling, note: note || null, photo_url });
      if (error) throw error;
      await (supabase as any)
        .from("health_trackers")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      setNote("");
      setPhoto(null);
      setFeeling(3);
      qc.invalidateQueries({ queryKey: ["tracker-entries", id] });
      qc.invalidateQueries({ queryKey: ["trackers", userId] });
      toast.success("Mise à jour enregistrée ✨");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTracker() {
    if (!confirm("Supprimer ce suivi et tout son historique ?")) return;
    await (supabase as any).from("health_trackers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["trackers", userId] });
    navigate({ to: "/suivi" });
  }

  async function markDone() {
    if (!tracker) return;
    const isDone = tracker.status === "done";
    await (supabase as any)
      .from("health_trackers")
      .update({
        status: isDone ? "active" : "done",
        ended_at: isDone ? null : new Date().toISOString(),
      })
      .eq("id", id);
    qc.invalidateQueries({ queryKey: ["tracker", id] });
    qc.invalidateQueries({ queryKey: ["trackers", userId] });
    toast.success(isDone ? "Suivi réactivé" : "Suivi marqué comme terminé ✅");
  }

  async function generateVisitReport() {
    if (generatingReport) return;
    setGeneratingReport(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session expirée");
      const r = await fetch("/api/visit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ trackerId: id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const saved = await r.json();
      qc.invalidateQueries({ queryKey: ["tracker-reports", id] });
      setOpenReport(saved);
      toast.success("Rapport prêt 📄");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size < 1024) return toast.error("Enregistrement vide");
        setTranscribing(true);
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          const fd = new FormData();
          fd.append("file", blob, `rec.${mime.includes("mp4") ? "mp4" : "webm"}`);
          const r = await fetch("/api/stt", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
          if (!r.ok) throw new Error(await r.text());
          const j = await r.json();
          if (j.text) setNote((n) => (n ? n + " " : "") + j.text);
        } catch (e: any) { toast.error(e.message ?? "Erreur transcription"); }
        finally { setTranscribing(false); }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch { toast.error("Microphone refusé"); }
  }
  function stopRec() { recorderRef.current?.stop(); setRecording(false); }

  const plan: string[] = Array.isArray(tracker?.plan) ? tracker!.plan : [];
  const linkedCoachId = tracker?.linked_coach_id as CoachId | undefined;
  const linkedCoach = linkedCoachId ? COACHES[linkedCoachId] : null;


  // Simple sparkline + improvement % (computed in chronological order)
  const series = (entries ?? [])
    .slice()
    .reverse()
    .map((e: any) => e.feeling as number)
    .filter((v: any) => typeof v === "number");
  const improvement = computeImprovement(series);
  const photoEntries = (entries ?? []).filter((e: any) => e.photo_url);
  const daysSince = tracker?.created_at
    ? Math.max(
        1,
        Math.floor((Date.now() - new Date(tracker.created_at).getTime()) / 86400000),
      )
    : 0;
  const isDone = tracker?.status === "done";

  return (
    <Page>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => navigate({ to: "/suivi" })}
          className="rounded-xl p-2 hover:bg-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tracker?.emoji ?? "🩺"}</span>
            <h1 className="truncate text-xl font-extrabold">{tracker?.title ?? "Suivi"}</h1>
            {isDone && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-extrabold text-success">
                Terminé
              </span>
            )}
          </div>
          {tracker?.summary && (
            <p className="text-xs text-muted-foreground">{tracker.summary}</p>
          )}
        </div>
        <button onClick={deleteTracker} className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Hero stats */}
      {tracker && (
        <div className="card-chunky mb-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Depuis" value={`${daysSince}j`} />
          <Stat
            label="Check-ins"
            value={String((entries ?? []).filter((e: any) => e.feeling != null).length)}
          />
          <Stat
            label="Évolution"
            value={improvement === null ? "—" : `${improvement > 0 ? "+" : ""}${improvement}%`}
            tone={improvement === null ? undefined : improvement > 5 ? "good" : improvement < -5 ? "bad" : undefined}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          onClick={generateVisitReport}
          disabled={generatingReport}
          className="btn-chunky btn-chunky-secondary !py-3 text-sm"
        >
          <FileText size={16} />
          {generatingReport ? "Préparation…" : "Préparer mon RDV"}
        </button>
        <button
          onClick={markDone}
          className="btn-chunky btn-chunky-secondary !py-3 text-sm"
        >
          <CheckCircle2 size={16} />
          {isDone ? "Réactiver" : "Marquer terminé"}
        </button>
      </div>

      {plan.length > 0 && (
        <div className="card-chunky mb-4">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Plan personnalisé
          </div>
          <ul className="space-y-1.5 text-sm">
            {plan.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {series.length >= 2 && (
        <div className="card-chunky mb-4">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Évolution
          </div>
          <Sparkline data={series} />
        </div>
      )}

      {photoEntries.length >= 2 && (
        <div className="card-chunky mb-4">
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Avant / Après
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BeforeAfter
              label={`J1 — ${new Date(photoEntries[photoEntries.length - 1].created_at).toLocaleDateString("fr-FR")}`}
              path={photoEntries[photoEntries.length - 1].photo_url}
            />
            <BeforeAfter
              label={`Aujourd'hui — ${new Date(photoEntries[0].created_at).toLocaleDateString("fr-FR")}`}
              path={photoEntries[0].photo_url}
            />
          </div>
        </div>
      )}

      {linkedCoach && (
        <Link
          to="/coach/$id"
          params={{ id: linkedCoach.id }}
          className="clay clay-tap mb-4 flex items-center gap-3 p-4"
          style={{ ["--clay-accent" as any]: linkedCoach.accent }}
        >
          <img src={linkedCoach.mascot} alt="" className="clay-mascot-frame h-14 w-14 object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: linkedCoach.accent }}>Coach lié</div>
            <div className="truncate text-[15px] font-bold leading-tight">{linkedCoach.name}</div>
            <div className="truncate text-[11.5px] text-muted-foreground">Crée un programme à partir de ce suivi</div>
          </div>
          <Sparkles size={18} style={{ color: linkedCoach.accent }} />
        </Link>
      )}

      <div className="clay mb-4 p-4" style={linkedCoach ? { ["--clay-accent" as any]: linkedCoach.accent } : undefined}>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Comment tu te sens aujourd'hui ?
        </div>
        <div className="mb-3 flex justify-between gap-1">
          {FEELINGS.map((f) => (
            <button
              key={f.v}
              onClick={() => setFeeling(f.v)}
              className={`flex flex-1 flex-col items-center rounded-2xl border-2 py-2 transition ${
                feeling === f.v ? "border-primary bg-primary/10 scale-105" : "border-border bg-card"
              }`}
            >
              <span className="text-xl">{f.e}</span>
              <span className="text-[10px] font-bold text-muted-foreground">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <textarea
            rows={2}
            placeholder={recording ? "🎙️ J'écoute…" : transcribing ? "Transcription…" : "Une note, ou utilise le micro…"}
            className="input-chunky mb-2 w-full resize-none pr-12 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {tracker?.voice_enabled !== false && (
            <button
              onClick={recording ? stopRec : startRec}
              disabled={transcribing}
              className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full transition ${recording ? "bg-destructive text-white animate-pulse" : "bg-primary text-primary-foreground"}`}
              aria-label={recording ? "Stop" : "Dicter"}
            >
              {recording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
            </button>
          )}
        </div>
        {photo && (
          <div className="mb-2 flex items-center gap-2">
            <img src={URL.createObjectURL(photo)} className="h-14 w-14 rounded-xl object-cover" />
            <button onClick={() => setPhoto(null)} className="text-xs text-muted-foreground">Retirer</button>
          </div>
        )}
        {tracker?.photo_guidance && (
          <button onClick={() => setShowPhotoHelp((v) => !v)} className="mb-2 flex w-full items-start gap-2 rounded-2xl bg-primary/5 p-3 text-left text-[11.5px] text-foreground/80">
            <Info size={14} className="mt-0.5 shrink-0 text-primary" />
            <span className={showPhotoHelp ? "" : "line-clamp-1"}>
              <b className="text-primary">Comment prendre la photo : </b>
              {tracker.photo_guidance}
            </span>
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-chunky btn-chunky-secondary flex-1">
            <Camera size={16} /> Photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          <button onClick={submit} disabled={saving} className="btn-chunky flex-1">
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
        <Link
          to="/ai"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 py-2.5 text-xs font-bold text-foreground/80 hover:bg-surface-3"
        >
          <MessageCircle size={14} /> Poser une question à Vita IA
        </Link>

      </div>


      <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        Chronologie
      </h2>
      <Timeline entries={entries ?? []} />

      {(reports?.length ?? 0) > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Rapports
          </h2>
          <ul className="space-y-2">
            {reports!.map((r: any) => (
              <li key={r.id}>
                <button
                  onClick={() => setOpenReport(r)}
                  className="card-chunky flex w-full items-center gap-3 !p-3 text-left hover:bg-muted/40"
                >
                  <FileText size={18} className="shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold">{r.title ?? "Rapport"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {openReport && (
        <ReportModal report={openReport} onClose={() => setOpenReport(null)} />
      )}
    </Page>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className={`text-lg font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Timeline({ entries }: { entries: any[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of entries) {
      const day = new Date(e.created_at).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  if (entries.length === 0)
    return (
      <div className="card-chunky bg-muted text-sm text-muted-foreground">
        Aucun check-in pour l'instant. Note ton premier ressenti ci-dessus 👆
      </div>
    );

  return (
    <div className="space-y-4">
      {groups.map(([day, items]) => (
        <div key={day}>
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
            {day}
          </div>
          <ul className="space-y-2 border-l-2 border-border pl-4">
            {items.map((e: any) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[1.4rem] top-2 h-3 w-3 rounded-full border-2 border-primary bg-card" />
                <div className="card-chunky !p-3">
                  <div className="flex items-center gap-2">
                    {e.feeling != null && (
                      <span className="text-xl">
                        {FEELINGS.find((f) => f.v === e.feeling)?.e ?? "😐"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                  {e.photo_url && <EntryPhoto path={e.photo_url} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BeforeAfter({ label, path }: { label: string; path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("symptom-photos")
      .createSignedUrl(path, 600)
      .then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [path]);
  return (
    <div>
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {url ? (
        <img src={url} className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />
      )}
    </div>
  );
}

function ReportModal({
  report,
  onClose,
}: {
  report: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="card-chunky relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden !p-0 sm:rounded-3xl">
        <header className="flex items-center gap-2 border-b-2 border-border bg-card p-3">
          <FileText size={18} className="text-primary" />
          <h3 className="min-w-0 flex-1 truncate font-extrabold">{report.title ?? "Rapport"}</h3>
          <button
            onClick={() => window.print()}
            className="rounded-xl p-2 hover:bg-muted"
            title="Imprimer / PDF"
          >
            <FileText size={18} />
          </button>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted">
            <X size={18} />
          </button>
        </header>
        <div className="prose-chat flex-1 overflow-y-auto p-4 text-sm">
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function EntryPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("symptom-photos")
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => { alive = false; };
  }, [path]);
  if (!url) return null;
  return <img src={url} className="mt-2 max-h-48 rounded-xl object-cover" />;
}

function Sparkline({ data }: { data: number[] }) {
  const w = 280, h = 60, pad = 4;
  const max = 5, min = 1;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--color-primary)" />;
      })}
    </svg>
  );
}