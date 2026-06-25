import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import {
  X,
  RotateCcw,
  Check,
  Eraser,
  Loader2,
  Brush,
  Move3d,
  Undo2,
} from "lucide-react";

export type Sex = "male" | "female";
export type BodyRegion = string;
export const REGION_LABELS: Record<string, string> = {};

// Three.js reference humanoid mannequin (Mixamo "X Bot"). Single clean mesh,
// no anatomical layers, no clothing, CORS-enabled CDN.
const BODY_URL =
  "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/Xbot.glb";

useGLTF.preload(BODY_URL, true);

type Tool = "move" | "brush" | "eraser";

// Soft red disc — used as the decal stamp on the body surface.
function makeStampTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 256, 160, 256, 256, 250);
  g.addColorStop(0, "rgba(244,63,94,1)");
  g.addColorStop(0.65, "rgba(244,63,94,0.95)");
  g.addColorStop(0.9, "rgba(225,29,72,0.55)");
  g.addColorStop(1, "rgba(225,29,72,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(256, 256, 250, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Body({
  toolRef,
  drawingRef,
  brushRef,
  decalGroupRef,
  pushStroke,
}: {
  toolRef: React.MutableRefObject<Tool>;
  drawingRef: React.MutableRefObject<boolean>;
  brushRef: React.MutableRefObject<number>;
  decalGroupRef: React.MutableRefObject<THREE.Group | null>;
  pushStroke: (m: THREE.Mesh) => void;
}) {
  const { scene } = useGLTF(BODY_URL, true) as any;

  // Clone, paint every mesh with a unified matte-gray studio material,
  // and normalize position + height.
  const cloned = useMemo(() => {
    const s = scene.clone(true);

    const grayMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#cbd0d6"),
      roughness: 0.62,
      metalness: 0.04,
      envMapIntensity: 0.85,
    });

    s.traverse((obj: any) => {
      if (obj.isMesh) {
        // SkinnedMesh keeps its skeleton; we only swap the material.
        obj.material = grayMat;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });

    // Center on origin, scale to 1.85 units tall.
    s.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    s.position.set(-center.x, -box.min.y, -center.z);
    const scl = 1.85 / Math.max(size.y, 0.001);
    s.scale.setScalar(scl);
    s.position.multiplyScalar(scl);
    return s;
  }, [scene]);

  const stampTex = useMemo(() => makeStampTexture(), []);
  const lastPointRef = useRef<THREE.Vector3 | null>(null);

  function stampDecal(targetMesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3) {
    if (!decalGroupRef.current) return;
    const size = brushRef.current * 0.0011;
    const orient = new THREE.Object3D();
    orient.position.copy(point);
    orient.lookAt(point.clone().add(normal));
    const geom = new DecalGeometry(
      targetMesh,
      point,
      orient.rotation,
      new THREE.Vector3(size, size, size * 1.4),
    );
    const mat = new THREE.MeshBasicMaterial({
      map: stampTex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 10;
    decalGroupRef.current.add(mesh);
    pushStroke(mesh);
  }

  function eraseAt(point: THREE.Vector3) {
    if (!decalGroupRef.current) return;
    const r = brushRef.current * 0.0017;
    const toRemove: THREE.Object3D[] = [];
    decalGroupRef.current.children.forEach((child) => {
      const c = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
      if (c.distanceTo(point) <= r) toRemove.push(child);
    });
    toRemove.forEach((m) => {
      decalGroupRef.current!.remove(m);
      (m as THREE.Mesh).geometry?.dispose();
      const mm = (m as THREE.Mesh).material as THREE.Material;
      mm?.dispose?.();
    });
  }

  const isPaintTool = () => toolRef.current === "brush" || toolRef.current === "eraser";

  function handle(e: ThreeEvent<PointerEvent>) {
    if (!isPaintTool()) return;
    const obj = e.object as THREE.Mesh;
    if (!obj || !e.face || !e.point) return;
    const normal = e.face.normal.clone();
    const nm = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
    normal.applyMatrix3(nm).normalize();

    if (toolRef.current === "brush") {
      const cur = e.point.clone();
      const last = lastPointRef.current;
      const stepSize = brushRef.current * 0.00055;
      if (last && stepSize > 0) {
        const dist = last.distanceTo(cur);
        const steps = Math.min(10, Math.max(1, Math.floor(dist / stepSize)));
        for (let i = 1; i <= steps; i++) {
          const p = last.clone().lerp(cur, i / steps);
          stampDecal(obj, p, normal);
        }
      } else {
        stampDecal(obj, cur, normal);
      }
      lastPointRef.current = cur;
    } else {
      eraseAt(e.point.clone());
    }
  }

  return (
    <group>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (!isPaintTool()) return;
          e.stopPropagation();
          drawingRef.current = true;
          lastPointRef.current = null;
          handle(e);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!drawingRef.current || !isPaintTool()) return;
          e.stopPropagation();
          handle(e);
        }}
        onPointerUp={() => {
          drawingRef.current = false;
          lastPointRef.current = null;
        }}
        onPointerLeave={() => {
          lastPointRef.current = null;
        }}
      />
    </group>
  );
}

function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 1.0, 2.9);
    camera.lookAt(0, 0.95, 0);
  }, [resetKey, camera]);
  return null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (screenshotDataUrl: string, sex: Sex) => void;
};

export function BodyPicker3D({ open, onClose, onConfirm }: Props) {
  const [tool, setTool] = useState<Tool>("brush");
  const [brush, setBrush] = useState(26);
  const [resetN, setResetN] = useState(0);
  const [hasPaint, setHasPaint] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const toolRef = useRef<Tool>(tool);
  const brushRef = useRef(brush);
  const drawingRef = useRef(false);
  const decalGroupRef = useRef<THREE.Group | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<THREE.Mesh[][]>([]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  useEffect(() => {
    if (open) {
      setTool("brush");
      setHasPaint(false);
      setStrokeCount(0);
      strokesRef.current = [];
      drawingRef.current = false;
    }
  }, [open]);

  function pushStroke(m: THREE.Mesh) {
    const arr = strokesRef.current;
    if (drawingRef.current) {
      const last: any = arr[arr.length - 1];
      if (!last || last.__closed) {
        const ns: any = [m];
        ns.__closed = false;
        arr.push(ns);
      } else {
        last.push(m);
      }
    } else {
      const ns: any = [m];
      ns.__closed = true;
      arr.push(ns);
    }
    setHasPaint(true);
    setStrokeCount(arr.length);
  }

  useEffect(() => {
    const onUp = () => {
      const last: any = strokesRef.current[strokesRef.current.length - 1];
      if (last) last.__closed = true;
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  function undoLast() {
    const g = decalGroupRef.current;
    const stroke = strokesRef.current.pop();
    if (!g || !stroke) return;
    stroke.forEach((m) => {
      g.remove(m);
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose?.();
    });
    setStrokeCount(strokesRef.current.length);
    if (strokesRef.current.length === 0) setHasPaint(false);
  }

  function clearAll() {
    const g = decalGroupRef.current;
    if (!g) return;
    while (g.children.length > 0) {
      const child = g.children[0] as THREE.Mesh;
      g.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose?.();
    }
    strokesRef.current = [];
    setStrokeCount(0);
    setHasPaint(false);
  }

  async function handleConfirm() {
    if (!glCanvasRef.current) return;
    setExporting(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const dataUrl = glCanvasRef.current.toDataURL("image/jpeg", 0.92);
      onConfirm(dataUrl, "male");
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  const cursor =
    tool === "brush" ? "crosshair" : tool === "eraser" ? "cell" : "grab";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black">
      <div className="relative flex w-full max-w-md flex-col bg-[#0a0a0c] text-white">
        {/* ===== HEADER ===== */}
        <header
          className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3"
          style={{ background: "linear-gradient(180deg, rgba(10,10,12,0.95) 0%, rgba(10,10,12,0) 100%)" }}
        >
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/85 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
          <div className="text-center">
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Vita · Cabinet
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tracking-tight text-white">
              Localise ta douleur
            </div>
          </div>
          <button
            onClick={() => setResetN((n) => n + 1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/85 ring-1 ring-white/10 backdrop-blur-md transition hover:bg-white/15"
            aria-label="Recentrer"
            title="Recentrer"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
          </button>
        </header>

        {/* ===== STAGE ===== */}
        <div className="relative flex-1 overflow-hidden">
          {/* Studio backdrop */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 50% 35%, #1a1c22 0%, #0c0d11 55%, #050608 100%)",
            }}
          />
          {/* Soft vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(100% 70% at 50% 100%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 60%)",
            }}
          />

          <Canvas
            shadows
            camera={{ position: [0, 1.0, 2.9], fov: 30 }}
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
            dpr={[1, 2]}
            style={{ cursor, touchAction: "none" }}
            onCreated={({ gl }) => {
              glCanvasRef.current = gl.domElement;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.0;
            }}
          >
            <hemisphereLight args={["#ffffff", "#1a1d23", 0.5]} />
            <directionalLight
              position={[3, 5, 4]}
              intensity={1.15}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0001}
            />
            <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#a8c5ff" />
            <directionalLight position={[0, 2, -4]} intensity={0.3} color="#fff7ed" />
            <Suspense fallback={null}>
              <Body
                toolRef={toolRef}
                drawingRef={drawingRef}
                brushRef={brushRef}
                decalGroupRef={decalGroupRef}
                pushStroke={pushStroke}
              />
              <group ref={decalGroupRef} />
              <Environment preset="studio" />
              <ContactShadows
                position={[0, -0.005, 0]}
                opacity={0.6}
                scale={5}
                blur={2.8}
                far={2}
              />
            </Suspense>
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              enableRotate={tool === "move"}
              zoomSpeed={0.7}
              rotateSpeed={0.9}
              minDistance={1.4}
              maxDistance={5}
              target={[0, 0.95, 0]}
              minPolarAngle={Math.PI * 0.12}
              maxPolarAngle={Math.PI * 0.88}
              makeDefault
            />
            <CameraReset resetKey={resetN} />
          </Canvas>

          {/* Hint pill */}
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/8 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/75 ring-1 ring-white/10 backdrop-blur-xl">
            {tool === "move"
              ? "Glisse pour tourner"
              : tool === "brush"
                ? "Touche la zone douloureuse"
                : "Touche un marqueur pour effacer"}
          </div>

          {/* Floating tool dock */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 rounded-2xl bg-black/55 p-1.5 ring-1 ring-white/10 shadow-2xl backdrop-blur-2xl">
            <ToolBtn active={tool === "brush"} onClick={() => setTool("brush")} label="Pinceau" accent>
              <Brush size={17} strokeWidth={2.2} />
            </ToolBtn>
            <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Gomme">
              <Eraser size={17} strokeWidth={2.2} />
            </ToolBtn>
            <ToolBtn active={tool === "move"} onClick={() => setTool("move")} label="Tourner">
              <Move3d size={17} strokeWidth={2.2} />
            </ToolBtn>
            <div className="my-1 h-px w-6 bg-white/12" />
            <button
              onClick={undoLast}
              disabled={strokeCount === 0}
              className="grid h-9 w-9 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 disabled:opacity-25"
              title="Annuler"
              aria-label="Annuler"
            >
              <Undo2 size={15} strokeWidth={2.2} />
            </button>
            <button
              onClick={clearAll}
              disabled={!hasPaint}
              className="grid h-9 w-9 place-items-center rounded-xl text-[9px] font-bold tracking-[0.08em] text-white/85 transition hover:bg-white/10 disabled:opacity-25"
              title="Tout effacer"
              aria-label="Tout effacer"
            >
              RAZ
            </button>
          </div>

          {/* Brush size — glass slider */}
          {tool !== "move" && (
            <div className="absolute bottom-3 left-3 right-[5.25rem] flex items-center gap-3 rounded-2xl bg-black/55 px-3.5 py-2.5 ring-1 ring-white/10 backdrop-blur-2xl">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Taille
              </span>
              <input
                type="range"
                min={8}
                max={80}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className="flex-1 accent-rose-500"
              />
              <span className="w-6 text-right text-[11px] font-semibold tabular-nums text-white/90">
                {brush}
              </span>
            </div>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <footer
          className="relative z-10 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),14px)]"
          style={{ background: "linear-gradient(0deg, rgba(10,10,12,0.95) 0%, rgba(10,10,12,0) 100%)" }}
        >
          <p className="mb-3 text-center text-[11px] text-white/50">
            Vita recevra une capture avec la zone marquée.
          </p>
          <button
            onClick={handleConfirm}
            disabled={!hasPaint || exporting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-[14px] font-semibold tracking-tight text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.4)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40 disabled:shadow-none"
          >
            {exporting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Préparation…
              </>
            ) : (
              <>
                <Check size={16} strokeWidth={2.5} /> Envoyer à Vita
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  label,
  accent = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-9 w-9 place-items-center rounded-xl transition ${
        active
          ? accent
            ? "bg-rose-500 text-white shadow-[0_8px_20px_-6px_rgba(244,63,94,0.65)]"
            : "bg-white text-black shadow-lg"
          : "text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
