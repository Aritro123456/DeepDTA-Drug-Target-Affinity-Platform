import { useRef, useState } from "react";
import { Dna, Loader2, Lock, Play, Box, BarChart3, Download, Upload, X, Server } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import ProteinViewer3D from "@/components/ProteinViewer3D";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { fetchPdbById, parsePdb, type PdbStructure } from "@/lib/pdb";

const SAMPLE = "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGVGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL";

export default function Target() {
  const { user } = useAuth();
  const [sequence, setSequence] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"metrics" | "pdb">("pdb");
  const [result, setResult] = useState<{ pdb?: string; metrics: { length: number; mw: number; hydrophobic: number } } | null>(null);

  const [structure, setStructure] = useState<PdbStructure | null>(null);
  const [activeChain, setActiveChain] = useState<string | undefined>(undefined);
  const [pdbId, setPdbId] = useState("1CRN");
  const [pdbLoading, setPdbLoading] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    setLoading(true);
    // Request a PDB blob from the backend alongside metrics when possible.
    const res = await api.visualizeProtein(sequence, { includePdb: true });
    setLoading(false);
    if (!res.ok && !res.mocked) {
      if (res.status === 401) toast.error("Please log in to visualize protein structures.");
      else toast.error(res.error || "Protein visualization failed.");
      return;
    }
    setResult(res.data);
    if (res.mocked) {
      toast.warning("Backend unreachable — showing simulated metrics.");
      return;
    }
    // If the backend returned a PDB payload, parse + render it automatically.
    if (res.data?.pdb && typeof res.data.pdb === "string") {
      try {
        const s = parsePdb(res.data.pdb, "rcsb");
        s.id = res.data.pdb_id ?? s.id ?? "BACKEND";
        s.title = res.data.title ?? s.title;
        if (s.chains.length > 0) applyStructure(s);
      } catch {
        toast.error("Backend returned an unreadable PDB payload.");
      }
    }
  }

  async function loadFromBackend() {
    if (!sequence.trim() && !pdbId.trim()) return;
    setBackendLoading(true);
    const res = await api.visualizeProtein(sequence, {
      includePdb: true,
      pdbId: pdbId.trim() || undefined,
    });
    setBackendLoading(false);
    if (!res.ok && !res.mocked) {
      if (res.status === 401) toast.error("Please log in to fetch structures from the backend.");
      else toast.error(res.error || "Backend structure fetch failed.");
      return;
    }
    if (res.mocked) {
      toast.error("Backend unreachable — cannot fetch structure.");
      return;
    }
    if (!res.data?.pdb) {
      toast.warning("Backend did not return a PDB payload for this sequence.");
      return;
    }
    try {
      const s = parsePdb(res.data.pdb, "rcsb");
      s.id = res.data.pdb_id ?? s.id ?? "BACKEND";
      s.title = res.data.title ?? s.title;
      if (s.chains.length === 0) {
        toast.error("Backend PDB had no CA atoms.");
        return;
      }
      applyStructure(s);
      setResult({
        pdb: res.data.pdb,
        metrics: res.data.metrics,
      });
    } catch {
      toast.error("Failed to parse backend PDB.");
    }
  }

  function applyStructure(s: PdbStructure) {
    setStructure(s);
    const first = s.chains[0];
    setActiveChain(first?.id);
    if (first?.sequence && first.sequence.length > 0) {
      setSequence(first.sequence);
    }
    toast.success(
      `Loaded ${s.id ?? "structure"} · ${s.chains.length} chain${s.chains.length === 1 ? "" : "s"} · ${s.chains.reduce((n, c) => n + c.atoms.length, 0)} CA atoms`
    );
  }

  async function loadById() {
    if (!pdbId.trim()) return;
    setPdbLoading(true);
    try {
      const s = await fetchPdbById(pdbId);
      applyStructure(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch PDB");
    } finally {
      setPdbLoading(false);
    }
  }

  async function onUpload(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25 MB).");
      return;
    }
    try {
      const text = await file.text();
      const s = parsePdb(text, "upload");
      if (s.chains.length === 0) {
        toast.error("No CA atoms found — is this a valid PDB file?");
        return;
      }
      s.id = s.id ?? file.name.replace(/\.pdb$/i, "").toUpperCase();
      applyStructure(s);
    } catch {
      toast.error("Could not read file.");
    }
  }

  function clearStructure() {
    setStructure(null);
    setActiveChain(undefined);
  }

  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow="Target Viewer"
          title="Protein sequence inspection"
          description="Paste a sequence to compute composition metrics, or load a PDB structure to render the real CA backbone. 3D viewing requires sign-in."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-5">
          <section className="panel-lg p-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center justify-between">
                <span>Protein sequence</span>
                <span className="text-muted-foreground font-normal">{sequence.length} residues</span>
              </label>
              <textarea
                value={sequence} onChange={e => setSequence(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 text-xs font-mono rounded border border-input bg-card focus-ring resize-y leading-relaxed tracking-wide"
                placeholder="MKTAYIAKQRQISFVK..."
              />
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={run}
                  disabled={loading || !sequence.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 focus-ring"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Visualize
                </button>
                <button
                  onClick={() => setSequence(SAMPLE)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border hover:bg-muted"
                >
                  Use sample
                </button>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-xs font-medium mb-2">Load PDB structure</div>
              <div className="flex gap-2">
                <input
                  value={pdbId}
                  onChange={e => setPdbId(e.target.value.toUpperCase().slice(0, 4))}
                  placeholder="PDB ID (e.g. 1CRN)"
                  className="flex-1 min-w-0 px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring uppercase"
                  onKeyDown={e => { if (e.key === "Enter") loadById(); }}
                />
                <button
                  onClick={loadById}
                  disabled={pdbLoading || !pdbId.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded bg-secondary text-secondary-foreground hover:opacity-95 disabled:opacity-50 focus-ring whitespace-nowrap"
                  title="Fetch directly from RCSB"
                >
                  {pdbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  RCSB
                </button>
                <button
                  onClick={loadFromBackend}
                  disabled={backendLoading || (!sequence.trim() && !pdbId.trim())}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded border border-border hover:bg-muted disabled:opacity-50 focus-ring whitespace-nowrap"
                  title="Ask the DeepDTA backend to resolve a structure for this sequence / PDB ID"
                >
                  {backendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  Backend
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                <span className="font-mono">RCSB</span> streams from files.rcsb.org ·{" "}
                <span className="font-mono">Backend</span> calls <span className="font-mono">/visualize/protein</span> with the current sequence.
              </div>


              <div className="mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdb,.ent,chemical/x-pdb,text/plain"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded border border-dashed border-border hover:bg-muted"
                >
                  <Upload className="w-4 h-4" /> Upload .pdb file
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {["1CRN", "4HHB", "1UBQ", "2HHB", "3PQR"].map(id => (
                  <button
                    key={id}
                    onClick={() => { setPdbId(id); }}
                    className="chip border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 font-mono"
                  >
                    {id}
                  </button>
                ))}
              </div>

              {structure && (
                <div className="mt-3 panel p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold font-mono">{structure.id ?? "structure"}</div>
                    <button
                      onClick={clearStructure}
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      title="Remove loaded structure"
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                  {structure.title && (
                    <div className="text-muted-foreground line-clamp-2">{structure.title}</div>
                  )}
                  <div className="text-muted-foreground">
                    {structure.chains.length} chain{structure.chains.length === 1 ? "" : "s"} ·{" "}
                    {structure.chains.reduce((n, c) => n + c.atoms.length, 0)} CA atoms ·{" "}
                    source: {structure.source}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel-lg flex flex-col min-h-[500px]">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex p-1 bg-muted rounded">
                {([
                  { id: "pdb", label: "Structure (PDB)", icon: Box },
                  { id: "metrics", label: "Metrics", icon: BarChart3 },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>
              {!user && (
                <span className="chip border-warning/40 bg-warning/10 text-warning">
                  <Lock className="w-3 h-3" /> 3D requires sign-in
                </span>
              )}
            </div>

            <div className="flex-1 p-5">
              {tab === "metrics" ? (
                <MetricsView result={result} />
              ) : (
                <PdbView
                  authed={!!user}
                  sequence={sequence}
                  structure={structure}
                  activeChain={activeChain}
                  onChainChange={setActiveChain}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function MetricsView({ result }: { result: { metrics: { length: number; mw: number; hydrophobic: number } } | null }) {
  if (!result) return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded">
      Click Visualize to compute metrics.
    </div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Stat label="Length" value={`${result.metrics.length} aa`} />
      <Stat label="Est. weight" value={`${result.metrics.mw.toLocaleString()} Da`} />
      <Stat label="Hydrophobic ratio" value={`${(result.metrics.hydrophobic * 100).toFixed(1)}%`} />
      <div className="sm:col-span-3 panel p-4">
        <div className="stat-label mb-2">Composition</div>
        <div className="h-32 grid gap-0.5 font-mono text-[10px]" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
          {Array.from({ length: 20 }).map((_, i) => {
            const h = 30 + ((i * 17) % 70);
            return (
              <div key={i} className="flex flex-col items-center justify-end">
                <div className="w-full bg-primary/70 rounded-sm" style={{ height: `${h}%` }} />
                <div className="mt-1 text-muted-foreground">{"ACDEFGHIKLMNPQRSTVWY"[i]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PdbView({
  authed, sequence, structure, activeChain, onChainChange,
}: {
  authed: boolean;
  sequence: string;
  structure: PdbStructure | null;
  activeChain?: string;
  onChainChange: (id: string) => void;
}) {
  if (!authed) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-6 panel bg-muted/30">
        <Lock className="w-10 h-10 text-muted-foreground mb-3" />
        <div className="font-semibold mb-1">Sign in to load structural data</div>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          PDB fetching and the interactive 3D viewer are reserved for authenticated researchers due to compute cost.
        </p>
        <Link to="/login" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded bg-primary text-primary-foreground">
          Sign in to continue
        </Link>
      </div>
    );
  }
  if (!structure && !sequence.trim()) {
    return (
      <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-6 panel bg-muted/30">
        <Dna className="w-10 h-10 text-muted-foreground mb-3" />
        <div className="font-semibold mb-1">No structure or sequence</div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Fetch a PDB ID, upload a .pdb file, or paste a sequence to render a backbone.
        </p>
      </div>
    );
  }
  return (
    <div className="h-[520px]">
      <ProteinViewer3D
        sequence={sequence}
        structure={structure}
        activeChainId={activeChain}
        onChainChange={onChainChange}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-3">
      <div className="stat-label">{label}</div>
      <div className="text-lg font-semibold font-mono">{value}</div>
    </div>
  );
}
