import { useState } from "react";
import { FlaskConical, Sparkles, Loader2, Play, Copy, Save, Trash2, Cpu, Beaker } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import MoleculePreview from "@/components/MoleculePreview";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Tab = "predict" | "generate";
interface HistRow { id: string; smiles: string; target: string; pkd: number; conf: number; complexity: string; simulated: boolean; }
const AMINO_ACID_PATTERN = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;
const DEFAULT_PROTEIN_SEQUENCE = "MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWK";

export default function Predict() {
  const [tab, setTab] = useState<Tab>("predict");
  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow="Prediction Lab"
          title="Affinity prediction & molecule design"
          description="Submit a ligand SMILES and a protein sequence to predict pKd, or generate novel molecules conditioned on a target and desired affinity."
        />

        <div className="inline-flex p-1 bg-muted rounded mb-5">
          {([
            { id: "predict", label: "Predict Affinity", icon: FlaskConical },
            { id: "generate", label: "Generate Molecule", icon: Sparkles },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded transition-colors ${
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "predict" ? <PredictPanel /> : <GeneratePanel />}
      </div>
    </AppShell>
  );
}

function PredictPanel() {
  const [smiles, setSmiles] = useState("CC(=O)Oc1ccccc1C(=O)O");
  const [sequence, setSequence] = useState(DEFAULT_PROTEIN_SEQUENCE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pkd: number; confidence: number; complexity: string; simulated: boolean } | null>(null);
  const [history, setHistory] = useState<HistRow[]>([]);

  async function run() {
    const cleanSequence = sequence.toUpperCase().replace(/\s+/g, "");
    if (!AMINO_ACID_PATTERN.test(cleanSequence)) {
      toast.error("Protein sequence contains invalid characters. Use amino acid letters only, without dots or ellipses.");
      return;
    }

    setLoading(true);
    const res = await api.predict(smiles, cleanSequence);
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        toast.error("Please log in before running model predictions.");
        return;
      }
      if (res.status === 503) {
        toast.error("Model service is not running. Start the model service and try again.");
        return;
      }
      if (res.status !== 0) {
        toast.error(res.error || "Prediction failed.");
        return;
      }
    }

    setResult(res.data);
    setHistory(h => [{
      id: crypto.randomUUID(),
      smiles, target: cleanSequence.slice(0, 16) + "...",
      pkd: res.data.pkd, conf: res.data.confidence, complexity: res.data.complexity,
      simulated: res.data.simulated || res.mocked,
    }, ...h].slice(0, 12));
    if (res.mocked) toast.warning("Backend unreachable — showing simulated prediction.");
    else toast.success("Prediction complete.");
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-5">
      <div className="space-y-5">
        <section className="panel-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold">Input</div>
              <div className="text-xs text-muted-foreground">Provide ligand and protein</div>
            </div>
            <button onClick={() => { setSmiles(""); setSequence(""); setResult(null); }}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1.5">Ligand SMILES</label>
              <input
                value={smiles} onChange={e => setSmiles(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring"
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5 flex items-center justify-between">
                <span>Protein sequence (FASTA, single chain)</span>
                <span className="text-muted-foreground font-normal">{sequence.length} aa</span>
              </label>
              <textarea
                value={sequence} onChange={e => setSequence(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring resize-y"
                placeholder="MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAP..."
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                disabled={loading || !smiles.trim() || !sequence.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 focus-ring"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Predict affinity
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border hover:bg-muted">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border hover:bg-muted">
                <Save className="w-4 h-4" /> Save preset
              </button>
            </div>
          </div>
        </section>

        <section className="panel-lg">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">History</div>
            <span className="text-xs text-muted-foreground">{history.length} run{history.length === 1 ? "" : "s"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Ligand</th>
                  <th className="text-left px-4 py-2 font-medium">Target</th>
                  <th className="text-right px-4 py-2 font-medium">pKd</th>
                  <th className="text-right px-4 py-2 font-medium">Conf.</th>
                  <th className="text-left px-4 py-2 font-medium">Complexity</th>
                  <th className="text-left px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No predictions yet.</td></tr>
                )}
                {history.map(r => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-mono text-xs max-w-[220px] truncate">{r.smiles}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.target}</td>
                    <td className="px-4 py-2 text-right font-semibold">{r.pkd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{(r.conf * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2 capitalize">{r.complexity}</td>
                    <td className="px-4 py-2">
                      <span className={`chip ${r.simulated ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>
                        {r.simulated ? <Beaker className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                        {r.simulated ? "Simulated" : "Model"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="panel-lg p-5">
          <div className="text-sm font-semibold mb-3">Prediction result</div>
          {!result ? (
            <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded">
              Run a prediction to see scores here.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="stat-label">Predicted pKd</div>
                  <div className="text-4xl font-semibold tracking-tight font-mono">{result.pkd.toFixed(3)}</div>
                </div>
                <span className={`chip ${result.simulated ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>
                  {result.simulated ? <Beaker className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                  {result.simulated ? "Simulation" : "Real model"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="panel p-3">
                  <div className="stat-label">Confidence</div>
                  <div className="text-lg font-semibold">{(result.confidence * 100).toFixed(0)}%</div>
                  <div className="h-1.5 mt-1.5 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${result.confidence * 100}%` }} />
                  </div>
                </div>
                <div className="panel p-3">
                  <div className="stat-label">Complexity</div>
                  <div className="text-lg font-semibold capitalize">{result.complexity}</div>
                </div>
              </div>
            </div>
          )}
        </section>
        <MoleculePreview smiles={smiles} label={smiles} className="h-[260px]" />
      </aside>
    </div>
  );
}

function GeneratePanel() {
  const [sequence, setSequence] = useState("");
  const [affinity, setAffinity] = useState(7.5);
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ smiles: string; pkd: number; simulated: boolean } | null>(null);

  async function run() {
    const cleanSequence = sequence.toUpperCase().replace(/\s+/g, "");
    if (!AMINO_ACID_PATTERN.test(cleanSequence)) {
      toast.error("Protein sequence contains invalid characters. Use amino acid letters only, without dots or ellipses.");
      return;
    }

    setLoading(true);
    const res = await api.generate(cleanSequence, affinity, seed || undefined);
    setLoading(false);

    if (!res.ok) {
      if (res.status === 401) {
        toast.error("Please log in before generating molecules.");
        return;
      }
      if (res.status === 503) {
        toast.error("Model service is not running. Start the model service and try again.");
        return;
      }
      if (res.status !== 0) {
        toast.error(res.error || "Generation failed.");
        return;
      }
    }

    setResult(res.data);
    if (res.mocked) toast.warning("Backend unreachable — showing simulated candidate.");
    else toast.success("Candidate generated.");
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_460px] gap-5">
      <section className="panel-lg p-5">
        <div className="text-sm font-semibold mb-4">Generation parameters</div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5">Target protein sequence</label>
            <textarea
              value={sequence} onChange={e => setSequence(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring resize-y"
              placeholder="MKTAYIAKQRQISFVK..."
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 flex items-center justify-between">
              <span>Desired affinity (pKd)</span>
              <span className="font-mono text-foreground">{affinity.toFixed(1)}</span>
            </label>
            <input
              type="range" min={4} max={10} step={0.1}
              value={affinity} onChange={e => setAffinity(+e.target.value)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
              <span>4 weak</span><span>7 moderate</span><span>10 strong</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Seed SMILES (optional)</label>
            <input
              value={seed} onChange={e => setSeed(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring"
              placeholder="Start molecule fragment, e.g. c1ccccc1"
            />
          </div>
          <button
            onClick={run}
            disabled={loading || !sequence.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 focus-ring"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate candidate
          </button>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="panel-lg p-5">
          <div className="text-sm font-semibold mb-3">Generated candidate</div>
          {!result ? (
            <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded">
              No candidates yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="stat-label">SMILES</div>
                <div className="font-mono text-sm break-all p-2 mt-1 rounded bg-muted">{result.smiles}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="stat-label">Predicted pKd</div>
                  <div className="text-2xl font-semibold font-mono">{result.pkd.toFixed(2)}</div>
                </div>
                <span className={`chip ${result.simulated ? "border-warning/40 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}`}>
                  {result.simulated ? "Simulation" : "Real model"}
                </span>
              </div>
            </div>
          )}
        </section>
        <MoleculePreview smiles={result?.smiles} label={result?.smiles} className="h-[260px]" />
      </aside>
    </div>
  );
}
