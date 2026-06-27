import { useState } from "react";
import { Atom, CheckCircle2, XCircle, Loader2, Search, Copy } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import MoleculePreview from "@/components/MoleculePreview";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Molecule() {
  const [smiles, setSmiles] = useState("CC(=O)Oc1ccccc1C(=O)O");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; formula: string; mw: number; image_url?: string } | null>(null);

  async function run() {
    setLoading(true);
    const res = await api.molecule(smiles);
    setLoading(false);
    if (!res.ok && !res.mocked) {
      toast.error(res.error || "Could not render molecule.");
      return;
    }
    setResult(res.data);
    if (res.mocked) toast.warning("Backend unreachable — showing simulated result.");
  }

  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow="Molecule Viewer"
          title="Validate and inspect chemical structures"
          description="Paste a SMILES string to validate it, compute molecular formula and weight, and preview the 2D skeletal structure."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-5">
          <section className="panel-lg p-5">
            <label className="text-xs font-medium block mb-1.5">SMILES</label>
            <div className="flex gap-2">
              <input
                value={smiles} onChange={e => setSmiles(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono rounded border border-input bg-card focus-ring"
                placeholder="e.g. CC(=O)Oc1ccccc1C(=O)O"
              />
              <button
                onClick={run}
                disabled={loading || !smiles.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 focus-ring"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Validate
              </button>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold mb-3">Result</div>
              {!result ? (
                <div className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded">
                  Enter a SMILES string and click Validate.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded border ${
                    result.valid ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"
                  }`}>
                    {result.valid ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="text-sm font-medium">{result.valid ? "Structure is valid" : "Invalid SMILES"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Molecular formula" value={result.formula} mono />
                    <Stat label="Molecular weight" value={`${result.mw} g/mol`} />
                  </div>
                  <div className="panel p-3 flex items-center justify-between">
                    <div className="font-mono text-xs truncate">{smiles}</div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(smiles); toast.success("Copied"); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="panel-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Atom className="w-4 h-4 text-primary" />
                <div className="text-sm font-semibold">2D preview</div>
              </div>
              <MoleculePreview smiles={smiles} imageUrl={result?.image_url} className="h-[320px]" />
            </div>
            <div className="panel p-4 text-xs text-muted-foreground">
              The 2D rendering is approximate. Connect a backend with RDKit to render exact skeletal structures.
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="stat-label">{label}</div>
      <div className={`text-lg font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
