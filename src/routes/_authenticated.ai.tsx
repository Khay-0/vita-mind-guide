import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Page } from "@/components/AppShell";
import {
  Camera,
  Send,
  X,
  ArrowLeft,
  Plus,
  Menu,
  Trash2,
  Mic,
  Square,
  HeartPulse,
  MessageCircle,
  PersonStanding,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import mascot from "@/assets/vita-mascot.png";
import type { VitaResponse } from "@/lib/vita-ai/schemas";

const BodyPicker3D = lazy(() =>
  import("@/components/BodyPicker3D").then((m) => ({ default: m.BodyPicker3D })),
);

type DBMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url: string | null;
  created_at: string;
  structured?: VitaResponse | null;
};

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [{ title: "Vita IA — Coach santé" }] }),
  component: AiPage,
});

function AiPage() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);

  if (!threadId)
    return (
      <ThreadPicker
        onNew={(id) => setThreadId(id)}
        onPick={(id) => setThreadId(id)}
      />
    );

  return (
    <Chat
      threadId={threadId}
      onBack={() => setThreadId(null)}
      onNew={(id) => setThreadId(id)}
      drawer={drawer}
      setDrawer={setDrawer}
      onPick={(id) => {
        setThreadId(id);
        setDrawer(false);
      }}
    />
  );
}

// ============ Picker ============
function ThreadPicker({
  onNew,
  onPick,
}: {
  onNew: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const { data: threads } = useQuery({
    queryKey: ["threads", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });



  async function createThread() {
    if (!userId) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({
        user_id: userId,
        kind: "question",
        title: "Nouvelle consultation",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    onNew(data.id);
  }

  async function deleteThread(id: string) {
    await supabase.from("chat_threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads", userId] });
  }

  return (
    <Page title="Vita IA" subtitle="Ton médecin de poche">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3">
        <img
          src={mascot}
          alt="Mascotte Vita"
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">Bonjour, je suis Vita 💚</div>
          <p className="text-xs text-muted-foreground">
            Décris un symptôme, montre une photo, ou indique sur le corps 3D où tu as mal.
          </p>
        </div>
      </div>

      <button onClick={() => createThread()} className="btn-chunky mb-5 w-full">
        <Plus size={18} /> Nouvelle consultation
      </button>

      <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        Conversations
      </h2>
      {threads && threads.length === 0 && (
        <div className="card-chunky bg-muted text-sm text-muted-foreground">
          Aucune conversation pour l'instant.
        </div>
      )}
      <ul className="space-y-2">
        {threads?.map((t) => (
          <li key={t.id} className="card-chunky group flex items-center gap-3 !p-3">
            <button
              onClick={() => onPick(t.id)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <img
                src={mascot}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold">{t.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.last_message_preview ?? "—"}
                </div>
              </div>
              <div className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(t.updated_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </button>
            <button
              onClick={() => deleteThread(t.id)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-6 px-2 text-[11px] text-muted-foreground">
        Vita fournit des informations générales. Elle ne remplace pas un médecin
        — en cas de doute ou d'urgence, consulte un professionnel.
      </p>
    </Page>
  );
}

// ============ Chat ============
function Chat({
  threadId,
  onBack,
  onNew,
  drawer,
  setDrawer,
  onPick,
}: {
  threadId: string;
  onBack: () => void;
  onNew: (id: string) => void;
  drawer: boolean;
  setDrawer: (b: boolean) => void;
  onPick: (id: string) => void;
}) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: thread } = useQuery({
    queryKey: ["thread", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("id", threadId)
        .maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: dbMessages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      return (data ?? []) as DBMsg[];
    },
  });

  const messages = useMemo<DBMsg[]>(() => dbMessages ?? [], [dbMessages]);
  const [input, setInput] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [creatingTracker, setCreatingTracker] = useState(false);
  const [askPhotoPopup, setAskPhotoPopup] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("vita-disclaimer-dismissed") !== "1";
  });
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [bodyPickerOpen, setBodyPickerOpen] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, streamingText]);

  async function send(forcedText?: string) {
    const text = forcedText ?? input.trim();
    if (!text && !photo) return;
    if (!userId || !threadId) return;
    setLoading(true);
    setStreamingText("");

    let imageDataUrl: string | undefined;
    let uploadedPath: string | undefined;
    if (photo) {
      const path = `${userId}/${crypto.randomUUID()}-${photo.file.name}`;
      const { error: upErr } = await supabase.storage
        .from("symptom-photos")
        .upload(path, photo.file, { upsert: false });
      if (upErr) {
        toast.error(upErr.message);
        setLoading(false);
        setStreamingText(null);
        return;
      }
      uploadedPath = path;
      imageDataUrl = await fileToDataUrl(photo.file);
    }

    // Persist user message
    const { data: insertedUser } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        user_id: userId,
        role: "user",
        content: text || "(Photo jointe)",
        image_url: uploadedPath ?? null,
      })
      .select()
      .single();
    if (insertedUser) {
      qc.setQueryData<DBMsg[]>(["messages", threadId], (old = []) => [
        ...old,
        insertedUser as DBMsg,
      ]);
    }
    setInput("");
    setPhoto(null);

    try {
      const isFirstMessage = messages.length === 0;
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        imageDataUrl
          ? {
              role: "user" as const,
              content: [
                { type: "text" as const, text: text || "Analyse cette image." },
                { type: "image_url" as const, image_url: { url: imageDataUrl } },
              ],
            }
          : { role: "user" as const, content: text },
      ];

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session expirée");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          profile: profile as any,
          generateTitle: isFirstMessage,
          hasImage: !!imageDataUrl,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Erreur ${res.status}`);
      }

      const structured = (await res.json()) as VitaResponse;
      const messageText = structured.message ?? "";
      const title = structured.title ?? null;

      // Client-side typewriter on the final text.
      {
        const target = messageText;
        let shown = 0;
        while (shown < target.length) {
          const remaining = target.length - shown;
          const step = Math.max(1, Math.min(4, Math.ceil(remaining / 30)));
          shown = Math.min(target.length, shown + step);
          setStreamingText(target.slice(0, shown));
          await new Promise((r) => setTimeout(r, 22));
        }
      }

      // Persist assistant message with structured payload.
      const { data: insertedAssistant } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: threadId,
          user_id: userId,
          role: "assistant",
          content: messageText,
          structured: structured as unknown as Record<string, unknown>,
        } as never)
        .select()
        .single();

      if (insertedAssistant) {
        qc.setQueryData<DBMsg[]>(["messages", threadId], (old = []) => [
          ...old,
          insertedAssistant as DBMsg,
        ]);
      }
      setStreamingText(null);
      setLoading(false);

      const updates: {
        last_message_preview: string;
        updated_at: string;
        title?: string;
      } = {
        last_message_preview: messageText.slice(0, 80),
        updated_at: new Date().toISOString(),
      };
      if (title && isFirstMessage) updates.title = title;
      await supabase.from("chat_threads").update(updates).eq("id", threadId);

      // Photo request card → open the photo dialog.
      const photoCard = structured.cards?.find((c) => c.type === "photo_request");
      if (photoCard && !photo) {
        setAskPhotoPopup(photoCard.instructions.join(" • "));
      }

      qc.invalidateQueries({ queryKey: ["threads", userId] });
      qc.invalidateQueries({ queryKey: ["thread", threadId] });

      if (isFirstMessage && profile) {
        await supabase
          .from("profiles")
          .update({ xp: (profile.xp ?? 0) + 15 })
          .eq("user_id", userId);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erreur IA");
    } finally {
      setLoading(false);
      setStreamingText(null);
    }
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto({ file: f, preview: URL.createObjectURL(f) });
    setAskPhotoPopup(null);
  }

  async function startTracker(override?: {
    title: string;
    emoji: string;
    summary: string;
  }) {
    if (!userId || creatingTracker || messages.length === 0) return;
    setCreatingTracker(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Session expirée");
      const r = await fetch("/api/tracker-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const plan = (await r.json()) as { title: string; emoji: string; summary: string; plan: string[] };
      const { data: created, error } = await (supabase as any)
        .from("health_trackers")
        .insert({
          user_id: userId,
          thread_id: threadId,
          title: override?.title || plan.title,
          emoji: override?.emoji || plan.emoji,
          summary: override?.summary || plan.summary,
          plan: plan.plan,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Suivi créé ✨");
      navigate({ to: "/suivi/$id", params: { id: created.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur création suivi");
    } finally {
      setCreatingTracker(false);
    }
  }

  async function newThread() {
    if (!userId) return;
    const { data } = await supabase
      .from("chat_threads")
      .insert({ user_id: userId, kind: "question", title: "Nouvelle conversation" })
      .select()
      .single();
    if (data) onNew(data.id);
  }

  const placeholder = "Pose ta question…";

  async function startRecording() {
    if (recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size < 1024) {
          toast.error("Enregistrement trop court");
          return;
        }
        setTranscribing(true);
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          if (!token) throw new Error("Session expirée");
          const form = new FormData();
          form.append("file", blob, `rec.${(blob.type.split(";")[0].split("/")[1] || "webm")}`);
          const r = await fetch("/api/stt", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!r.ok) throw new Error(await r.text());
          const j = (await r.json()) as { text: string };
          setInput((cur) => (cur ? cur + " " + j.text : j.text));
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
      toast.error("Micro indisponible");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] w-full max-w-md flex-col">
      <header className="flex items-center gap-2 border-b-2 border-border bg-card px-3 py-3 safe-top">
        <button onClick={onBack} className="rounded-xl p-2 hover:bg-muted">
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => setDrawer(true)} className="rounded-xl p-2 hover:bg-muted">
          <Menu size={20} />
        </button>
        <img src={mascot} alt="Vita" width={36} height={36} loading="lazy" className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold">
            {thread?.title ?? "Vita IA"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              En ligne · Coach santé
            </span>
          </div>
        </div>
        {messages.length >= 2 && (
          <button
            onClick={() => startTracker()}
            disabled={creatingTracker}
            className="mr-1 flex items-center gap-1 rounded-full border-2 border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary disabled:opacity-50"
            title="Créer un suivi à partir de cette conversation"
          >
            <HeartPulse size={14} />
            {creatingTracker ? "…" : "Suivre"}
          </button>
        )}
        <button onClick={newThread} className="rounded-xl p-2 hover:bg-muted" title="Nouvelle conversation">
          <Plus size={20} />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {showDisclaimer && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-border bg-muted/40 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1">
              Vita donne un avis basé sur ce que tu décris. Ce n'est pas un
              diagnostic médical officiel — en cas d'urgence, appelle le 15.
            </div>
            <button
              onClick={() => {
                localStorage.setItem("vita-disclaimer-dismissed", "1");
                setShowDisclaimer(false);
              }}
              className="rounded-lg p-1 hover:bg-muted"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <img src={mascot} alt="" width={88} height={88} loading="lazy" className="h-22 w-22" />
            <div>
              <div className="text-base font-extrabold">Comment veux-tu commencer ?</div>
              <div className="text-xs text-muted-foreground">
                Décris ce que tu ressens, ou pointe la zone qui te gêne sur un corps 3D.
              </div>
            </div>
            <div className="grid w-full gap-2.5">
              <button
                onClick={() => setBodyPickerOpen(true)}
                className="group relative overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/15 to-primary/5 p-4 text-left transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <PersonStanding size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold">Indiquer où j'ai mal</div>
                    <div className="text-[11px] text-muted-foreground">
                      Tourne un corps 3D, sélectionne ta zone
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  const el = document.querySelector<HTMLTextAreaElement>(".input-chunky");
                  el?.focus();
                }}
                className="rounded-2xl border-2 border-border bg-card p-4 text-left transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
                    <MessageCircle size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold">Parler à Vita</div>
                    <div className="text-[11px] text-muted-foreground">
                      Décris en texte, photo ou voix
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isLastAssistant =
            m.role === "assistant" &&
            i === messages.length - 1 &&
            streamingText === null &&
            !loading;
          // Prefer structured tracker_offer card; fall back to legacy marker for old messages.
          let offer: { title: string; emoji: string; summary: string } | null = null;
          if (isLastAssistant) {
            const trackerCard = m.structured?.cards?.find(
              (c) => c.type === "tracker_offer",
            );
            if (trackerCard && trackerCard.type === "tracker_offer") {
              offer = {
                title: trackerCard.title,
                emoji: trackerCard.emoji,
                summary: trackerCard.summary,
              };
            } else {
              offer = parseOffer(m.content);
            }
          }
          return (
            <Bubble
              key={m.id}
              m={m}
              showChoices={isLastAssistant}
              onChoose={(c) => void send(c)}
              offer={offer}
              onAcceptOffer={
                offer ? () => void startTracker(offer) : undefined
              }
              creatingTracker={creatingTracker}
            />
          );
        })}
        {streamingText !== null && streamingText.length > 0 && (
          <Bubble
            m={{
              id: "_streaming",
              role: "assistant",
              content: streamingText,
              image_url: null,
              created_at: "",
            }}
            showChoices={false}
            onChoose={() => {}}
            typing
          />
        )}
        {loading && (streamingText === null || streamingText.length === 0) && (
          <div className="flex items-end gap-2">
            <img src={mascot} alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            <div className="bubble-assistant">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">Vita écrit</span>
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {askPhotoPopup && (
        <PhotoAskDialog
          instructions={askPhotoPopup}
          onClose={() => setAskPhotoPopup(null)}
          onTake={() => {
            setAskPhotoPopup(null);
            fileRef.current?.click();
          }}
        />
      )}

      <div className="border-t-2 border-border bg-card p-3 safe-bottom">
        {photo && (
          <div className="mb-2 flex items-center gap-2">
            <img src={photo.preview} className="h-14 w-14 rounded-xl object-cover" />
            <button onClick={() => setPhoto(null)} className="rounded-xl bg-muted p-2">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card"
            title="Joindre une photo"
          >
            <Camera size={20} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onPickPhoto}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={transcribing ? "Transcription…" : placeholder}
            rows={1}
            className="input-chunky max-h-32 flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading || transcribing}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 ${
              recording
                ? "border-destructive bg-destructive text-destructive-foreground animate-pulse"
                : "border-border bg-card"
            }`}
            title={recording ? "Stop" : "Parler"}
          >
            {recording ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
          </button>
          <button
            onClick={() => void send()}
            disabled={loading || (!input.trim() && !photo)}
            className="btn-chunky h-12 w-12 !p-0"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {drawer && (
        <ThreadsDrawer
          activeId={threadId}
          onClose={() => setDrawer(false)}
          onPick={onPick}
          onNew={async () => {
            if (!userId) return;
            const { data } = await supabase
              .from("chat_threads")
              .insert({ user_id: userId, kind: "question", title: "Nouvelle conversation" })
              .select()
              .single();
            if (data) {
              setDrawer(false);
              onNew(data.id);
            }
          }}
        />
      )}

      <Suspense fallback={null}>
        {bodyPickerOpen && (
          <BodyPicker3D
            open={bodyPickerOpen}
            onClose={() => setBodyPickerOpen(false)}
            onConfirm={async (screenshotDataUrl, sex) => {
              setBodyPickerOpen(false);
              try {
                const blob = await (await fetch(screenshotDataUrl)).blob();
                const file = new File([blob], "zone-douleur.jpg", { type: "image/jpeg" });
                setPhoto({ file, preview: screenshotDataUrl });
                const sexLabel = sex === "male" ? "un homme" : "une femme";
                setInput(
                  `Je suis ${sexLabel}. J'ai mal là où c'est marqué en rouge sur le schéma. Qu'est-ce que ça peut être ?`,
                );
                toast.success("Schéma ajouté — touche Envoyer ✨");
              } catch (e: any) {
                toast.error("Impossible de préparer le schéma");
              }
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

function Bubble({
  m,
  showChoices = false,
  onChoose,
  typing = false,
  offer = null,
  onAcceptOffer,
  creatingTracker = false,
}: {
  m: DBMsg;
  showChoices?: boolean;
  onChoose?: (choice: string) => void;
  typing?: boolean;
  offer?: { title: string; emoji: string; summary: string } | null;
  onAcceptOffer?: () => void;
  creatingTracker?: boolean;
}) {
  const isUser = m.role === "user";
  const parsed = !isUser ? parseChoices(m.content) : { text: m.content, choices: [] };
  const displayText = isUser ? m.content : parsed.text;
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <img src={mascot} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0" />
      )}
      <div className="max-w-[82%]">
        <div className={isUser ? "bubble-user" : "bubble-assistant"}>
          {m.image_url && <SignedImage path={m.image_url} />}
          {isUser ? (
            <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{displayText}</p>
          ) : (
            <div className="prose-chat text-[0.95rem] text-foreground">
              <ReactMarkdown>{displayText}</ReactMarkdown>
              {typing && <span className="caret">▍</span>}
            </div>
          )}
        </div>
        {!isUser && showChoices && parsed.choices.length > 0 && onChoose && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {parsed.choices.map((c) => (
              <button key={c} onClick={() => onChoose(c)} className="choice-chip">
                {c}
              </button>
            ))}
          </div>
        )}
        {!isUser && offer && onAcceptOffer && (
          <div className="mt-2 rounded-2xl border-2 border-primary bg-primary/10 p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">{offer.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                  Suivi proposé
                </div>
                <div className="truncate font-extrabold">{offer.title}</div>
              </div>
            </div>
            {offer.summary && (
              <p className="mb-2 text-xs text-muted-foreground">{offer.summary}</p>
            )}
            <button
              onClick={onAcceptOffer}
              disabled={creatingTracker}
              className="btn-chunky w-full !py-2 text-sm"
            >
              {creatingTracker ? "Création…" : "Commencer le suivi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignedImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("symptom-photos")
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return null;
  return <img src={url} className="mb-2 max-h-48 rounded-xl object-cover" />;
}

function PhotoAskDialog({
  instructions,
  onClose,
  onTake,
}: {
  instructions: string;
  onClose: () => void;
  onTake: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="card-chunky w-full max-w-sm bg-card">
        <div className="mb-2 flex items-center gap-2">
          <Camera className="text-primary" size={22} />
          <h3 className="text-lg font-extrabold">Une photo m'aiderait</h3>
        </div>
        <p className="mb-2 text-sm text-muted-foreground">
          Pour mieux t'orienter, partage-moi une photo de la zone concernée.
        </p>
        <div className="mb-4 rounded-xl border-2 border-border bg-muted/40 p-3 text-xs leading-relaxed">
          <div className="mb-1 font-extrabold uppercase tracking-wider text-muted-foreground">
            Comment la prendre
          </div>
          {instructions}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="btn-chunky btn-chunky-secondary flex-1"
          >
            Plus tard
          </button>
          <button onClick={onTake} className="btn-chunky flex-1">
            <Camera size={18} /> Prendre une photo
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadsDrawer({
  activeId,
  onClose,
  onPick,
  onNew,
}: {
  activeId: string;
  onClose: () => void;
  onPick: (id: string) => void;
  onNew: () => void;
}) {
  const session = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const { data: threads } = useQuery({
    queryKey: ["threads", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("user_id", userId!)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  async function deleteThread(id: string) {
    await supabase.from("chat_threads").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["threads", userId] });
    if (id === activeId) onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative ml-0 h-full w-72 max-w-[80%] overflow-y-auto bg-card p-3 safe-top safe-bottom"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-extrabold">Conversations</h3>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <button
          onClick={onNew}
          className="btn-chunky mb-3 w-full"
        >
          <Plus size={16} /> Nouvelle
        </button>
        <ul className="space-y-1">
          {threads?.map((t) => (
            <li
              key={t.id}
              className={`group flex items-center gap-2 rounded-xl p-2 ${t.id === activeId ? "bg-primary/15" : "hover:bg-muted"}`}
            >
              <button
                onClick={() => onPick(t.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-bold">{t.title}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {new Date(t.updated_at).toLocaleDateString("fr-FR")}
                </div>
              </button>
              <button
                onClick={() => deleteThread(t.id)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function stripMarkers(s: string) {
  return s
    .replace(/^\s*\[\[TITLE:[^\]]*\]\]\s*\n?/i, "")
    .replace(/\[\[ASK_PHOTO(?::[^\]]*)?\]\]/gi, "")
    .replace(/\[\[CHOICES:[^\]]*\]\]/gi, "")
    .replace(/\[\[OFFER_TRACKER:[^\]]*\]\]/gi, "")
    .trimEnd();
}

export function parseChoices(s: string): { text: string; choices: string[] } {
  const m = s.match(/\[\[CHOICES:\s*([^\]]+)\]\]/i);
  if (!m) return { text: s, choices: [] };
  const choices = m[1]
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 60)
    .slice(0, 5);
  const text = s.replace(m[0], "").trim();
  return { text, choices };
}

export function parseOffer(
  s: string,
): { title: string; emoji: string; summary: string } | null {
  const m = s.match(/\[\[OFFER_TRACKER:\s*([^\]]+)\]\]/i);
  if (!m) return null;
  const parts = m[1].split("|").map((x) => x.trim());
  const title = (parts[0] ?? "").slice(0, 60);
  const emoji = (parts[1] ?? "🩺").slice(0, 4);
  const summary = (parts[2] ?? "").slice(0, 200);
  if (!title) return null;
  return { title, emoji, summary };
}
