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
} from "lucide-react";

export type Sex = "male" | "female"; // kept for API compat
export type BodyRegion = string;
export const REGION_LABELS: Record<string, string> = {};

// Z-Anatomy human body, Draco-compressed, ~8 MB, CORS-enabled via jsDelivr.
// CC BY-SA 4.0 — https://github.com/hpfrei/body-anatomy-3d-viewer
const BODY_URL =
  "https://cdn.jsdelivr.net/gh/hpfrei/body-anatomy-3d-viewer@main/public/body.glb";

useGLTF.preload(BODY_URL, true);

type Tool = "move" | "brush" | "eraser";

// Soft red disc texture used as the decal stamp.
function makeStampTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  g.addColorStop(0, "rgba(255,40,40,1)");
  g.addColorStop(0.55, "rgba(255,40,40,0.85)");
  g.addColorStop(1, "rgba(255,40,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Body({
  toolRef,
  drawingRef,
  brushRef,
  decalGroupRef,
  setHasPaint,
}: {
  toolRef: React.MutableRefObject<Tool>;
  drawingRef: React.MutableRefObject<boolean>;
  brushRef: React.MutableRefObject<number>;
  decalGroupRef: React.MutableRefObject<THREE.Group | null>;
  setHasPaint: (b: boolean) => void;
}) {
  const { scene } = useGLTF(BODY_URL, true) as any;

  // Clone & center/scale once.
  const cloned = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Center to origin, then scale to ~1.9 units tall.
    s.position.set(-center.x, -box.min.y, -center.z);
    const scl = 1.9 / Math.max(size.y, 0.001);
    s.scale.setScalar(scl);
    // After scaling we must recenter Y because we already shifted by min.y at scale 1.
    s.position.y *= scl;
    return s;
  }, [scene]);

  // Make sure every mesh casts/receives shadows and is raycastable.
  useEffect(() => {
    cloned.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });
  }, [cloned]);

  const stampTex = useMemo(() => makeStampTexture(), []);
  const lastDecalRef = useRef<{ mesh: THREE.Mesh; pos: THREE.Vector3 } | null>(null);

  function stampDecal(targetMesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3) {
    if (!decalGroupRef.current) return;
    const size = brushRef.current * 0.0025; // canvas px → world units
    // Build orientation from normal direction.
    const orient = new THREE.Object3D();
    orient.position.copy(point);
    orient.lookAt(point.clone().add(normal));
    orient.rotation.z = Math.random() * Math.PI * 2;
    const geom = new DecalGeometry(
      targetMesh,
      point,
      orient.rotation,
      new THREE.Vector3(size, size, size * 1.2),
    );
    const mat = new THREE.MeshBasicMaterial({
      map: stampTex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 10;
    decalGroupRef.current.add(mesh);
    setHasPaint(true);
  }

  function eraseAt(point: THREE.Vector3) {
    if (!decalGroupRef.current) return;
    const r = brushRef.current * 0.003;
    const toRemove: THREE.Object3D[] = [];
    decalGroupRef.current.traverse((child: any) => {
      if (!child.geometry) return;
      if (child === decalGroupRef.current) return;
      const c = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
      if (c.distanceTo(point) <= r) toRemove.push(child);
    });
    toRemove.forEach((m) => {
      decalGroupRef.current!.remove(m);
      (m as THREE.Mesh).geometry?.dispose();
      const mm = (m as THREE.Mesh).material as THREE.Material;
      mm?.dispose?.();
    });
    if (decalGroupRef.current.children.length === 0) setHasPaint(false);
  }

  const isPaintTool = () => toolRef.current === "brush" || toolRef.current === "eraser";

  function handle(e: ThreeEvent<PointerEvent>) {
    if (!isPaintTool()) return;
    const obj = e.object as THREE.Mesh;
    if (!obj || !e.face || !e.point) return;
    // World-space normal:
    const normal = e.face.normal.clone();
    const nm = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
    normal.applyMatrix3(nm).normalize();
    if (toolRef.current === "brush") {
      stampDecal(obj, e.point.clone(), normal);
    } else {
      eraseAt(e.point.clone());
    }
    lastDecalRef.current = null;
  }

  return (
    <group>
      <primitive
        object={cloned}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (!isPaintTool()) return;
          e.stopPropagation();
          drawingRef.current = true;
          handle(e);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!drawingRef.current || !isPaintTool()) return;
          e.stopPropagation();
          handle(e);
        }}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
      />
    </group>
  );
}

function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.95, 3.0);
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
  const [brush, setBrush] = useState(50);
  const [resetN, setResetN] = useState(0);
  const [hasPaint, setHasPaint] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toolRef = useRef<Tool>(tool);
  const brushRef = useRef(brush);
  const drawingRef = useRef(false);
  const decalGroupRef = useRef<THREE.Group | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      drawingRef.current = false;
    }
  }, [open]);

  function clearAll() {
    const g = decalGroupRef.current;
    if (!g) return;
    while (g.children.length > 0) {
      const child = g.children[0] as THREE.Mesh;
      g.remove(child);
      child.geometry?.dispose();
      (child.material as THREE.Material)?.dispose?.();
    }
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/85 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col bg-card">
        <header className="flex items-center justify-between border-b-2 border-border px-4 py-3 safe-top">
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted" aria-label="Fermer">
            <X size={20} />
          </button>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cabinet médical
            </div>
            <div className="text-sm font-extrabold">Dessine où tu as mal</div>
          </div>
          <button
            onClick={() => setResetN((n) => n + 1)}
            className="rounded-xl p-2 hover:bg-muted"
            aria-label="Recentrer la caméra"
            title="Recentrer"
          >
            <RotateCcw size={18} />
          </button>
        </header>

        <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617]">
          <Canvas
            shadows
            camera={{ position: [0, 0.95, 3.0], fov: 32 }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
            dpr={[1, 2]}
            style={{ cursor, touchAction: "none" }}
            onCreated={({ gl }) => {
              glCanvasRef.current = gl.domElement;
            }}
          >
            <color attach="background" args={["#0b1220"]} />
            <hemisphereLight args={["#ffffff", "#1f2937", 0.6]} />
            <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-4, 2, -3]} intensity={0.45} color="#93c5fd" />
            <directionalLight position={[0, -3, 2]} intensity={0.3} color="#fef3c7" />
            <Suspense fallback={null}>
              <Body
                toolRef={toolRef}
                drawingRef={drawingRef}
                brushRef={brushRef}
                decalGroupRef={decalGroupRef}
                setHasPaint={setHasPaint}
              />
              <group ref={decalGroupRef} />
              <Environment preset="studio" />
              <ContactShadows
                position={[0, -0.01, 0]}
                opacity={0.5}
                scale={4}
                blur={2.4}
                far={2}
              />
            </Suspense>
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              enableRotate={tool === "move"}
              zoomSpeed={0.7}
              rotateSpeed={0.9}
              minDistance={1.5}
              maxDistance={6}
              target={[0, 0.95, 0]}
              minPolarAngle={Math.PI * 0.05}
              maxPolarAngle={Math.PI * 0.95}
              makeDefault
            />
            <CameraReset resetKey={resetN} />
          </Canvas>

          {/* Hint */}
          <div className="pointer-events-none absolute left-3 top-3 max-w-[60%] rounded-full bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            {tool === "move"
              ? "Glisse pour tourner · pince pour zoomer"
              : tool === "brush"
                ? "Peins la zone douloureuse"
                : "Touche un marqueur pour l'effacer"}
          </div>

          {/* Right-side floating toolbar */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-1.5 shadow-2xl backdrop-blur">
            <ToolBtn active={tool === "move"} onClick={() => setTool("move")} label="Tourner">
              <Move3d size={18} />
            </ToolBtn>
            <ToolBtn active={tool === "brush"} onClick={() => setTool("brush")} label="Pinceau" accent>
              <Brush size={18} />
            </ToolBtn>
            <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Gomme">
              <Eraser size={18} />
            </ToolBtn>
            <div className="my-0.5 h-px bg-white/15" />
            <button
              onClick={clearAll}
              disabled={!hasPaint}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/85 hover:bg-white/10 disabled:opacity-30"
              title="Tout effacer"
            >
              <span className="text-[10px] font-extrabold">RAZ</span>
            </button>
          </div>

          {/* Brush size */}
          {tool !== "move" && (
            <div className="absolute bottom-3 left-3 right-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                Taille
              </span>
              <input
                type="range"
                min={15}
                max={140}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className="flex-1 accent-red-500"
              />
              <span className="w-8 text-right text-[11px] font-extrabold text-white">{brush}</span>
            </div>
          )}
        </div>

        <footer className="border-t-2 border-border p-3 safe-bottom">
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            Vita recevra une capture avec la zone que tu as marquée.
          </p>
          <button
            onClick={handleConfirm}
            disabled={!hasPaint || exporting}
            className="btn-chunky w-full disabled:opacity-40"
          >
            {exporting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Préparation…
              </>
            ) : (
              <>
                <Check size={18} /> Envoyer à Vita
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
      className={`grid h-10 w-10 place-items-center rounded-xl transition ${
        active
          ? accent
            ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
            : "bg-white text-slate-900 shadow-lg"
          : "text-white/80 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
