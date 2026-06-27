import { useMemo, useRef, useState, Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { CatmullRomCurve3, Color, Vector3 } from "three";
import type { Group, Scene, WebGLRenderer } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { Loader2, Pause, Play, RotateCcw, Maximize2, Image as ImageIcon, Box as BoxIcon, NotebookPen, ChevronDown } from "lucide-react";
import type { PdbStructure } from "@/lib/pdb";
import { pushPendingCell } from "@/lib/notebookBus";
import { toast } from "sonner";

interface Props {
  sequence: string;
  structure?: PdbStructure | null;
  activeChainId?: string;
  onChainChange?: (id: string) => void;
}

// Deterministic synthetic backbone — only used when no real PDB is loaded.
function syntheticPoints(sequence: string): Vector3[] {
  const n = Math.max(8, Math.min(sequence.length, 320));
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const c = sequence.charCodeAt(i % sequence.length) || 65;
    const t = i * 0.32;
    const r = 1.6 + ((c % 7) - 3) * 0.05;
    const x = Math.cos(t) * r + Math.sin(i * 0.07) * 0.6;
    const y = i * 0.18 - n * 0.09;
    const z = Math.sin(t) * r + Math.cos(i * 0.05) * 0.6;
    pts.push(new Vector3(x, y, z));
  }
  return pts;
}

// Convert CA atoms of the chosen chain into world-space points, recentered
// and scaled to fit the camera.
function chainPoints(structure: PdbStructure, chainId: string): { points: Vector3[]; residues: string } {
  const chain = structure.chains.find(c => c.id === chainId) ?? structure.chains[0];
  if (!chain) return { points: [], residues: "" };
  const raw = chain.atoms.map(a => new Vector3(a.x, a.y, a.z));
  if (raw.length === 0) return { points: [], residues: "" };
  // Center
  const center = new Vector3();
  raw.forEach(p => center.add(p));
  center.multiplyScalar(1 / raw.length);
  // Compute bounding radius for scaling to ~12 units
  let maxD = 0;
  raw.forEach(p => { const d = p.distanceTo(center); if (d > maxD) maxD = d; });
  const scale = maxD > 0 ? 12 / maxD : 1;
  const points = raw.map(p => p.clone().sub(center).multiplyScalar(scale));
  const residues = chain.sequence;
  return { points, residues };
}

const RESIDUE_COLOR: Record<string, string> = {
  A: "#94a3b8", V: "#94a3b8", L: "#94a3b8", I: "#94a3b8", M: "#94a3b8",
  F: "#a78bfa", W: "#a78bfa", Y: "#a78bfa",
  S: "#60a5fa", T: "#60a5fa", N: "#60a5fa", Q: "#60a5fa",
  C: "#fbbf24", G: "#cbd5e1", P: "#f472b6",
  K: "#22d3ee", R: "#22d3ee", H: "#22d3ee",
  D: "#f87171", E: "#f87171",
};

function Ribbon({ points, spin, real }: { points: Vector3[]; spin: boolean; real: boolean }) {
  const ref = useRef<Group>(null);
  const curve = useMemo(
    () => new CatmullRomCurve3(points, false, "catmullrom", 0.5),
    [points]
  );
  useFrame((_, dt) => {
    if (spin && ref.current) ref.current.rotation.y += dt * 0.2;
  });
  const tubularSegments = Math.max(64, points.length * 3);
  return (
    <group ref={ref}>
      <mesh>
        <tubeGeometry args={[curve, tubularSegments, real ? 0.22 : 0.28, 12, false]} />
        <meshStandardMaterial
          color={new Color(real ? "#0ea5b7" : "#0e7490")}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}

function ResidueDots({ points, residues }: { points: Vector3[]; residues: string }) {
  const step = points.length > 400 ? 4 : points.length > 200 ? 2 : 1;
  return (
    <group>
      {points.map((p, i) => {
        if (i % step !== 0) return null;
        const aa = residues[i]?.toUpperCase() ?? "G";
        const color = RESIDUE_COLOR[aa] ?? "#94a3b8";
        return (
          <mesh key={`r${i}`} position={p}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ProteinViewer3D({ sequence, structure, activeChainId, onChainChange }: Props) {
  const [spin, setSpin] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<{ gl: WebGLRenderer; scene: Scene } | null>(null);
  const [exporting, setExporting] = useState<null | "png" | "glb" | "insert-png" | "insert-glb">(null);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);

  const real = !!structure && structure.chains.length > 0;
  const chainId = activeChainId ?? structure?.chains[0]?.id ?? "A";

  const { points, residues } = useMemo(() => {
    if (real && structure) return chainPoints(structure, chainId);
    return { points: syntheticPoints(sequence), residues: sequence };
  }, [real, structure, chainId, sequence]);

  const exportBaseName = real && structure
    ? `${structure.id ?? "structure"}_chain${chainId}`
    : `sequence_${sequence.length}aa`;

  function fullscreen() {
    const el = fullscreenRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function capturePngBlob(): Promise<Blob | null> {
    const refs = sceneRefs.current;
    if (!refs) return null;
    const canvas = refs.gl.domElement;
    return await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), "image/png"));
  }

  async function captureGlbBuffer(): Promise<ArrayBuffer | null> {
    const refs = sceneRefs.current;
    if (!refs) return null;
    const exporter = new GLTFExporter();
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        refs.scene,
        r => resolve(r as ArrayBuffer),
        err => reject(err),
        { binary: true },
      );
    });
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  async function exportPng() {
    setExporting("png");
    try {
      const blob = await capturePngBlob();
      if (blob) downloadBlob(blob, `deepdta_${exportBaseName}.png`);
    } finally {
      setExporting(null);
    }
  }

  async function exportGlb() {
    setExporting("glb");
    try {
      const buf = await captureGlbBuffer();
      if (buf) downloadBlob(new Blob([buf], { type: "model/gltf-binary" }), `deepdta_${exportBaseName}.glb`);
    } finally {
      setExporting(null);
    }
  }

  async function insertIntoNotebook(kind: "png" | "glb") {
    setInsertMenuOpen(false);
    setExporting(kind === "png" ? "insert-png" : "insert-glb");
    try {
      const filename = `deepdta_${exportBaseName}.${kind}`;
      let dataUrl: string;
      let bytes = 0;
      let source: string;
      if (kind === "png") {
        const blob = await capturePngBlob();
        if (!blob) { toast.error("Could not capture frame."); return; }
        bytes = blob.size;
        dataUrl = await blobToDataUrl(blob);
        source = [
          `### Structure snapshot — ${exportBaseName}`,
          ``,
          `![${exportBaseName}](${filename})`,
          ``,
          `_Captured from the DeepDTA Target Viewer · ${new Date().toLocaleString()}_`,
        ].join("\n");
      } else {
        const buf = await captureGlbBuffer();
        if (!buf) { toast.error("Could not export GLB."); return; }
        const blob = new Blob([buf], { type: "model/gltf-binary" });
        bytes = blob.size;
        dataUrl = await blobToDataUrl(blob);
        source = [
          `### 3D model — ${exportBaseName}`,
          ``,
          `Attached binary glTF: \`${filename}\` (${(bytes / 1024).toFixed(1)} KB).`,
          ``,
          `Load in a notebook cell with three.js / pygltflib, or download from the cell to share.`,
        ].join("\n");
      }
      pushPendingCell({
        kind: "markdown",
        source,
        attachment: { kind, dataUrl, filename, bytes },
        origin: "target-viewer",
      });
      toast.success(
        kind === "png" ? "Snapshot sent to notebook" : "GLB sent to notebook",
        { description: "Open the Research Notebook to view it." }
      );
    } catch {
      toast.error("Failed to insert into notebook.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div ref={fullscreenRef} className="relative w-full h-full panel bg-[hsl(215_32%_10%)] overflow-hidden">
      <Canvas
        key={resetKey}
        camera={{ position: [0, 0, 28], fov: 45 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={["#0b1220"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 12, 6]} intensity={1.1} />
        <directionalLight position={[-8, -4, -10]} intensity={0.4} color="#22d3ee" />
        <Suspense fallback={<Html center><Loader2 className="w-5 h-5 text-white animate-spin" /></Html>}>
          {points.length > 1 && <Ribbon points={points} spin={spin} real={real} />}
          {points.length > 1 && <ResidueDots points={points} residues={residues} />}
        </Suspense>
        <OrbitControls enablePan enableZoom enableRotate minDistance={6} maxDistance={120} />
        <SceneBridge onReady={(gl, scene) => { sceneRefs.current = { gl, scene }; }} />
      </Canvas>


      {/* HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto panel px-3 py-2 bg-card/90 backdrop-blur text-xs max-w-[60%]">
          <div className="font-semibold text-foreground flex items-center gap-2">
            Structural preview
            <span className={`chip text-[10px] ${real ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
              {real ? "PDB CA trace" : "synthetic"}
            </span>
          </div>
          <div className="text-muted-foreground truncate">
            {real && structure
              ? `${structure.id ?? "—"} · chain ${chainId} · ${points.length} CA${structure.title ? ` · ${structure.title}` : ""}`
              : `${sequence.length} aa · synthetic backbone`}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-1.5 justify-end">
          {real && structure && structure.chains.length > 1 && (
            <select
              value={chainId}
              onChange={e => onChainChange?.(e.target.value)}
              className="px-2 py-1.5 rounded bg-card/90 backdrop-blur border border-border text-xs text-foreground focus-ring"
              title="Chain"
            >
              {structure.chains.map(c => (
                <option key={c.id} value={c.id}>Chain {c.id} ({c.atoms.length})</option>
              ))}
            </select>
          )}
          <HudBtn onClick={() => setSpin(s => !s)} label={spin ? "Pause" : "Spin"} icon={spin ? Pause : Play} />
          <HudBtn onClick={() => setResetKey(k => k + 1)} label="Reset" icon={RotateCcw} />
          <HudBtn
            onClick={exportPng}
            label={exporting === "png" ? "Saving…" : "PNG"}
            icon={exporting === "png" ? Loader2 : ImageIcon}
            spin={exporting === "png"}
          />
          <HudBtn
            onClick={exportGlb}
            label={exporting === "glb" ? "Saving…" : "GLB"}
            icon={exporting === "glb" ? Loader2 : BoxIcon}
            spin={exporting === "glb"}
          />
          <div className="relative">
            <button
              onClick={() => setInsertMenuOpen(o => !o)}
              disabled={exporting === "insert-png" || exporting === "insert-glb"}
              title="Insert into notebook"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-card/90 backdrop-blur border border-border text-xs hover:bg-card text-foreground disabled:opacity-60"
            >
              {exporting === "insert-png" || exporting === "insert-glb" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <NotebookPen className="w-3.5 h-3.5" />
              )}
              Notebook
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {insertMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setInsertMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 mt-1 z-20 w-56 panel bg-card/95 backdrop-blur p-1 shadow-lg">
                  <button
                    onClick={() => insertIntoNotebook("png")}
                    className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded hover:bg-muted text-xs"
                  >
                    <ImageIcon className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">Insert as image (PNG)</span>
                      <span className="block text-muted-foreground text-[11px] leading-snug">
                        Markdown cell with embedded snapshot
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => insertIntoNotebook("glb")}
                    className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded hover:bg-muted text-xs"
                  >
                    <BoxIcon className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">Insert as 3D model (GLB)</span>
                      <span className="block text-muted-foreground text-[11px] leading-snug">
                        Markdown cell with downloadable attachment
                      </span>
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
          <HudBtn onClick={fullscreen} label="Fullscreen" icon={Maximize2} />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none gap-2">
        <div className="pointer-events-auto panel px-3 py-2 bg-card/90 backdrop-blur text-[11px] flex flex-wrap gap-x-3 gap-y-1">
          {[
            ["#94a3b8", "Hydrophobic"],
            ["#60a5fa", "Polar"],
            ["#22d3ee", "Basic"],
            ["#f87171", "Acidic"],
            ["#a78bfa", "Aromatic"],
            ["#fbbf24", "Cys"],
          ].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
        <div className="pointer-events-none text-[10px] text-white/50 font-mono">drag · rotate · scroll · zoom</div>
      </div>
    </div>
  );
}

function SceneBridge({ onReady }: { onReady: (gl: WebGLRenderer, scene: Scene) => void }) {
  const { gl, scene } = useThree();
  useEffect(() => { onReady(gl, scene); }, [gl, scene, onReady]);
  return null;
}

function HudBtn({
  onClick, label, icon: Icon, spin,
}: {
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  spin?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={!!spin}
      className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-card/90 backdrop-blur border border-border text-xs hover:bg-card text-foreground disabled:opacity-60"
    >
      <Icon className={`w-3.5 h-3.5 ${spin ? "animate-spin" : ""}`} /> {label}
    </button>
  );
}

