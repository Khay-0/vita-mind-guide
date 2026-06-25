import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Page } from "@/components/AppShell";
import { COACHES, type CoachId } from "@/lib/coaches";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { coachChat } from "@/lib/coach.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { ArrowLeft, Send, Mic, Square, Camera, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/coach/$id/chat")({
  head: () => ({ meta: [{ title: "Chat coach — Vita" }] }),
  component: CoachChatPage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-xl p-6 text-center">
      <div className="clay p-6">
        <div className="text-base font-extrabold">Chat indisponible</div>
        <p className="mt-1 text-sm text-muted-foreground">{error.message ?? "Une erreur est survenue."}</p>
        <button onClick={reset} className="clay-btn mt-4">Réessayer</button>
      </div>
    </div>
  ),
  pendingComponent: () => (
    <div className="mx-auto max-w-xl p-6">
      <div className="clay h-20 animate-pulse" />
    </div>
  ),
});


type Msg = { role: "user" | "assistant"; content: string; image?: string };

function CoachChatPage() {
  const { id } = Route.useParams();
  const coachId = id as CoachId;
  const coach = COACHES[coachId];
  const navigate = useNavigate();
  const session = useSession();
  const userId = session?.user.id;
  const chat = useServerFn(coachChat);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Salut ! Moi c'est ${coach?.name}. Comment puis-je t'aider aujourd'hui ?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (!coach) {
    return (
      <Page>
        <div className="clay p-6 text-center">
          <div className="text-base font-extrabold">Coach introuvable</div>
          <p className="mt-1 text-sm text-muted-foreground">Ce coach n'existe pas (id: {String(id)}).</p>
          <button onClick={() => navigate({ to: "/coach" })} className="clay-btn mt-4">Retour aux coachs</button>
        </div>
      </Page>
    );
  }


  async function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function send(forceText?: string) {
    const text = forceText ?? input.trim();
    if (!text && !photo) return;
    setLoading(true);
    let img: string | undefined;
    if (photo) img = await fileToDataUrl(photo.file);
    const userMsg: Msg = { role: "user", content: text || "Analyse cette photo.", image: photo?.preview };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPhoto(null);
    try {
      const apiMessages = next.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      apiMessages.push(
        img
          ? ({ role: "user", content: [{ type: "text", text: text || "Analyse cette photo." }, { type: "image_url", image_url: { url: img } }] } as any)
          : { role: "user", content: text },
      );
      const res = await chat({ data: { coachId, systemPrompt: coach.systemPrompt, messages: apiMessages } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setLoading(false);
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
        if (blob.size < 1024) {
          toast.error("Enregistrement vide");
          return;
        }
        setTranscribing(true);
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          const fd = new FormData();
          fd.append("file", blob, `rec.${mime.includes("mp4") ? "mp4" : "webm"}`);
          const r = await fetch("/api/stt", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
          if (!r.ok) throw new Error(await r.text());
          const j = await r.json();
          if (j.text) await send(j.text);
        } catch (e: any) {
          toast.error(e.message ?? "Erreur transcription");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("Microphone refusé");
    }
  }
  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <Page>
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
        <button onClick={() => navigate({ to: "/coach/$id", params: { id: coachId } })} className="rounded-xl p-2 hover:bg-muted">
          <ArrowLeft size={20} />
        </button>
        <img src={coach.mascot} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-2xl object-cover" style={{ background: `linear-gradient(135deg, ${coach.accent}30, ${coach.accent}05)` }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">{coach.fullName}</div>
          <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: coach.accent }} />
            En ligne · {coach.tagline}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="mb-3 max-h-[62vh] space-y-3 overflow-y-auto rounded-2xl p-1">
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && <img src={coach.mascot} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" style={{ background: `linear-gradient(135deg, ${coach.accent}30, ${coach.accent}05)` }} />}
              <div className={`max-w-[82%] ${isUser ? "" : ""}`}>
                <div
                  className={isUser ? "rounded-[20px_20px_6px_20px] px-3.5 py-2.5 text-[0.95rem] text-white shadow-md" : "rounded-[20px_20px_20px_6px] border border-border bg-card px-3.5 py-2.5 text-[0.95rem] text-foreground shadow-sm"}
                  style={isUser ? { backgroundColor: coach.accent } : undefined}
                >
                  {m.image && <img src={m.image} className="mb-2 max-h-48 rounded-xl" />}
                  <div className="prose-chat">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {(loading || transcribing) && (
          <div className="flex items-end gap-2">
            <img src={coach.mascot} alt="" className="h-7 w-7 shrink-0 rounded-lg object-cover" style={{ background: `linear-gradient(135deg, ${coach.accent}30, ${coach.accent}05)` }} />
            <div className="rounded-[20px_20px_20px_6px] border border-border bg-card px-3.5 py-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">{transcribing ? "Transcription" : `${coach.name} écrit`}</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: coach.accent }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: coach.accent }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: coach.accent }} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>


      {photo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <img src={photo.preview} className="h-12 w-12 rounded-lg object-cover" />
          <span className="flex-1 truncate text-xs">{photo.file.name}</span>
          <button onClick={() => setPhoto(null)}><X size={16} /></button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground">
          <Camera size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto({ file: f, preview: URL.createObjectURL(f) }); }} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={`Demande à ${coach.name}…`}
          className="flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        {recording ? (
          <button onClick={stopRec} className="animate-pulse rounded-xl bg-destructive p-2.5 text-white">
            <Square size={18} />
          </button>
        ) : (
          <button onClick={startRec} className="rounded-xl border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground">
            <Mic size={18} />
          </button>
        )}
        <button onClick={() => send()} disabled={loading || (!input.trim() && !photo)} className="rounded-xl p-2.5 text-white disabled:opacity-40" style={{ backgroundColor: coach.accent }}>
          <Send size={18} />
        </button>
      </div>
    </Page>
  );
}
