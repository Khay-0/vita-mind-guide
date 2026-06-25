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

// Anatomically correct human base mesh — we strip every internal layer
// (muscles, organs, skeleton) and keep ONLY the outer skin shell, then
// re-paint it with a clean matte gray studio material so it looks like
// a neutral 3D mannequin (see reference image).
const BODY_URL =
  "https://cdn.jsdelivr.net/gh/hpfrei/body-anatomy-3d-viewer@main/public/body.glb";

useGLTF.preload(BODY_URL, true);

type Tool = "move" | "brush" | "eraser";

// Sharp red disc used as the decal stamp. Tight falloff = clean dot.
function makeStampTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(256, 256, 180, 256, 256, 252);
  g.addColorStop(0, "rgba(239,68,68,1)");
  g.addColorStop(0.7, "rgba(239,68,68,0.98)");
  g.addColorStop(0.92, "rgba(220,38,38,0.6)");
  g.addColorStop(1, "rgba(220,38,38,0)");
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

  // Clone, isolate the outer skin shell, repaint it gray, normalize scale.
  const cloned = useMemo(() => {
    const s = scene.clone(true);

    // 1. Collect every mesh + measure its world bbox volume.
    const meshes: { mesh: THREE.Mesh; vol: number }[] = [];
    s.updateMatrixWorld(true);
    s.traverse((obj: any) => {
      if (obj.isMesh) {
        const bb = new THREE.Box3().setFromObject(obj);
        const sz = bb.getSize(new THREE.Vector3());
        meshes.push({ mesh: obj, vol: sz.x * sz.y * sz.z });
      }
    });
    if (meshes.length === 0) return s;

    // 2. Keep only the largest-volume mesh (outer skin shell).
    meshes.sort((a, b) => b.vol - a.vol);
    const keep = meshes[0].mesh;
    for (const m of meshes) {
      if (m.mesh !== keep) m.mesh.visible = false;
    }

    // 3. Apply a clean neutral-gray studio material.
    const grayMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c8ccd1"),
      roughness: 0.55,
      metalness: 0.05,
    });
    keep.material = grayMat;
    keep.castShadow = true;
    keep.receiveShadow = true;
    keep.frustumCulled = false;

    // 4. Center + normalize height to 1.9 units.
    const box = new THREE.Box3().setFromObject(keep);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    s.position.set(-center.x, -box.min.y, -center.z);
    const scl = 1.9 / Math.max(size.y, 0.001);
    s.scale.setScalar(scl);
    s.position.y *= scl;
    s.position.x *= scl;
    s.position.z *= scl;
    return s;
  }, [scene]);

  const stampTex = useMemo(() => makeStampTexture(), []);
  const lastPointRef = useRef<THREE.Vector3 | null>(null);

  function stampDecal(targetMesh: THREE.Mesh, point: THREE.Vector3, normal: THREE.Vector3) {
    if (!decalGroupRef.current) return;
    const size = brushRef.current * 0.0012;
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
    const r = brushRef.current * 0.0018;
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
      // Smooth strokes: interpolate between last point and current one
      // so fast moves don't leave gaps.
      const cur = e.point.clone();
      const last = lastPointRef.current;
      const stepSize = brushRef.current * 0.0006;
      if (last && stepSize > 0) {
        const dist = last.distanceTo(cur);
        const steps = Math.min(8, Math.max(1, Math.floor(dist / stepSize)));
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
  const [brush, setBrush] = useState(28);
  const [resetN, setResetN] = useState(0);
  const [hasPaint, setHasPaint] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const toolRef = useRef<Tool>(tool);
  const brushRef = useRef(brush);
  const drawingRef = useRef(false);
  const decalGroupRef = useRef<THREE.Group | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Group strokes per pointer-down so Undo removes the last stroke.
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
    if (!drawingRef.current && strokesRef.current.length === 0) {
      strokesRef.current.push([m]);
    } else if (drawingRef.current) {
      // Start a new stroke group on the first stamp of a press.
      const last = strokesRef.current[strokesRef.current.length - 1];
      if (!last || last.length === 0 || last.__closed) {
        const ns: any = [m];
        strokesRef.current.push(ns);
      } else {
        last.push(m);
      }
    } else {
      strokesRef.current.push([m]);
    }
    setHasPaint(true);
    setStrokeCount(strokesRef.current.length);
  }

  // Mark stroke as closed on pointer up via effect on drawingRef changes.
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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/90 backdrop-blur-md">
      <div className="flex w-full max-w-md flex-col bg-card">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 safe-top">
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-muted transition"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Vita · Cabinet
            </div>
            <div className="text-sm font-bold tracking-tight">
              Dessine la zone douloureuse
            </div>
          </div>
          <button
            onClick={() => setResetN((n) => n + 1)}
            className="rounded-xl p-2 hover:bg-muted transition"
            aria-label="Recentrer"
            title="Recentrer"
          >
            <RotateCcw size={18} />
          </button>
        </header>

        <div className="relative flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_center,_#1c1f24_0%,_#0a0c10_70%)]">
          <Canvas
            shadows
            camera={{ position: [0, 0.95, 3.0], fov: 32 }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
            dpr={[1, 2]}
            style={{ cursor, touchAction: "none" }}
            onCreated={({ gl }) => {
              glCanvasRef.current = gl.domElement;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.05;
            }}
          >
            <color attach="background" args={["#0b0d11"]} />
            <hemisphereLight args={["#ffffff", "#1a1d23", 0.45]} />
            <directionalLight
              position={[3, 5, 4]}
              intensity={1.2}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-bias={-0.0001}
            />
            <directionalLight position={[-4, 3, -3]} intensity={0.35} color="#a8c5ff" />
            <directionalLight position={[0, 1.5, -4]} intensity={0.25} color="#fff" />
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
                opacity={0.55}
                scale={5}
                blur={2.6}
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
              maxDistance={5.5}
              target={[0, 0.95, 0]}
              minPolarAngle={Math.PI * 0.1}
              maxPolarAngle={Math.PI * 0.9}
              makeDefault
            />
            <CameraReset resetKey={resetN} />
          </Canvas>

          {/* Hint */}
          <div className="pointer-events-none absolute left-3 top-3 max-w-[60%] rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md ring-1 ring-white/15">
            {tool === "move"
              ? "Glisse · pince pour zoomer"
              : tool === "brush"
                ? "Dessine la zone douloureuse"
                : "Touche un marqueur pour l'effacer"}
          </div>

          {/* Right-side floating toolbar */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/55 p-1.5 shadow-2xl backdrop-blur-md">
            <ToolBtn active={tool === "move"} onClick={() => setTool("move")} label="Tourner">
              <Move3d size={18} />
            </ToolBtn>
            <ToolBtn active={tool === "brush"} onClick={() => setTool("brush")} label="Pinceau" accent>
              <Brush size={18} />
            </ToolBtn>
            <ToolBtn active={tool === "eraser"} onClick={() => setTool("eraser")} label="Gomme">
              <Eraser size={18} />
            </ToolBtn>
            <div className="my-1 h-px bg-white/15" />
            <button
              onClick={undoLast}
              disabled={strokeCount === 0}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/85 hover:bg-white/10 disabled:opacity-25 transition"
              title="Annuler le dernier tracé"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={clearAll}
              disabled={!hasPaint}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/85 hover:bg-white/10 disabled:opacity-25 transition"
              title="Tout effacer"
            >
              <span className="text-[10px] font-bold tracking-wider">RAZ</span>
            </button>
          </div>

          {/* Brush size */}
          {tool !== "move" && (
            <div className="absolute bottom-3 left-3 right-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                Taille
              </span>
              <input
                type="range"
                min={8}
                max={90}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className="flex-1 accent-red-500"
              />
              <span className="w-8 text-right text-[11px] font-bold text-white tabular-nums">
                {brush}
              </span>
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 p-3 safe-bottom">
          <p className="mb-2 text-center text-[11px] text-muted-foreground">
            Vita recevra une capture avec la zone marquée.
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
