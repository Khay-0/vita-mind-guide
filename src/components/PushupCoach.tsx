import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { Play, Square, RotateCcw, Camera as CamIcon, Loader2 } from "lucide-react";

// Indices (BlazePose 33-landmark model)
const L = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
};

function angle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAb = Math.hypot(ab.x, ab.y);
  const magCb = Math.hypot(cb.x, cb.y);
  if (!magAb || !magCb) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAb * magCb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

type Phase = "up" | "down" | "idle";

export function PushupCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<PoseLandmarker | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const lastVideoTimeRef = useRef(-1);

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [elbowAngle, setElbowAngle] = useState<number | null>(null);
  const [formMsg, setFormMsg] = useState<string>("Place-toi face caméra, en position de pompe.");

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      detectorRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      phaseRef.current = "up";
      loop();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur caméra ou modèle");
      setStatus("error");
    }
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    setStatus("idle");
  }

  function reset() {
    setCount(0);
    phaseRef.current = "up";
  }

  function loop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const res: PoseLandmarkerResult = detector.detectForVideo(video, performance.now());

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const lm = res.landmarks?.[0];
      if (lm) {
        // Pick the side with better visibility (BlazePose returns mirrored on user-facing cam).
        const lShoulder = lm[L.leftShoulder];
        const rShoulder = lm[L.rightShoulder];
        const lElbow = lm[L.leftElbow];
        const rElbow = lm[L.rightElbow];
        const lWrist = lm[L.leftWrist];
        const rWrist = lm[L.rightWrist];

        // Average visibilities to pick which arm to track.
        const lVis = (lShoulder?.visibility ?? 0) + (lElbow?.visibility ?? 0) + (lWrist?.visibility ?? 0);
        const rVis = (rShoulder?.visibility ?? 0) + (rElbow?.visibility ?? 0) + (rWrist?.visibility ?? 0);
        const use = rVis > lVis
          ? { s: rShoulder, e: rElbow, w: rWrist }
          : { s: lShoulder, e: lElbow, w: lWrist };

        if (use.s && use.e && use.w) {
          const ang = angle(use.s, use.e, use.w);
          setElbowAngle(ang);

          // State machine for rep counting
          if (phaseRef.current === "up" && ang < 95) {
            phaseRef.current = "down";
            setFormMsg("Remonte 💪");
          } else if (phaseRef.current === "down" && ang > 155) {
            phaseRef.current = "up";
            setCount((c) => c + 1);
            setFormMsg("Bien ! Descends à nouveau.");
          } else if (phaseRef.current === "idle") {
            phaseRef.current = ang > 140 ? "up" : "down";
          }

          // Hip alignment hint
          const lh = lm[L.leftHip];
          const rh = lm[L.rightHip];
          if (lh && rh) {
            const hipY = (lh.y + rh.y) / 2;
            const shoulderY = (lShoulder.y + rShoulder.y) / 2;
            const drop = hipY - shoulderY;
            if (Math.abs(drop) > 0.18) setFormMsg("Garde le bassin aligné — pas de creux ni de bosse.");
          }

          // Draw skeleton overlay
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 4;
          ctx.fillStyle = "#22d3ee";
          const draw = (a: any, b: any) => {
            ctx.beginPath();
            ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
            ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
            ctx.stroke();
          };
          draw(use.s, use.e);
          draw(use.e, use.w);
          for (const p of [use.s, use.e, use.w]) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Big angle badge
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(12, 12, 130, 40);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 22px system-ui";
          ctx.fillText(`${Math.round(ang)}°`, 22, 42);
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-slate-900 aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        />
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white">
            <CamIcon size={42} className="opacity-70" />
            <div className="px-6 text-center text-sm">
              Active la caméra pour que Max compte tes pompes en temps réel.
            </div>
            <button onClick={init} className="btn-chunky">
              <Play size={18} /> Démarrer la session
            </button>
          </div>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80 text-white">
            <Loader2 className="animate-spin" size={32} />
            <div className="text-sm">Chargement du modèle…</div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-6 text-center text-white">
            <div className="text-sm">{errorMsg}</div>
            <button onClick={init} className="btn-chunky">Réessayer</button>
          </div>
        )}
        {/* Live counter overlay */}
        {status === "running" && (
          <div className="absolute right-3 top-3 rounded-2xl bg-black/65 px-4 py-2 text-right text-white backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Pompes</div>
            <div className="text-3xl font-black leading-none">{count}</div>
          </div>
        )}
      </div>

      {status === "running" && (
        <>
          <div className="rounded-2xl border-2 border-border bg-card p-3 text-sm">
            <div className="font-extrabold">Coach Max</div>
            <div className="text-muted-foreground">{formMsg}</div>
            {elbowAngle != null && (
              <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Angle coude : <span className="font-mono text-foreground">{Math.round(elbowAngle)}°</span> · Phase : {phaseRef.current}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={reset} className="btn-chunky btn-chunky-secondary">
              <RotateCcw size={18} /> Reset
            </button>
            <button onClick={stop} className="btn-chunky">
              <Square size={18} /> Terminer
            </button>
          </div>
        </>
      )}
    </div>
  );
}
