import { Database, Download, ExternalLink, Info } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api";

const datasets = [
  {
    name: "Davis",
    desc: "Kinase inhibitor selectivity assay — 442 proteins × 68 ligands. Standard DTA benchmark.",
    license: "CC-BY 4.0",
    rows: "30,056 interactions",
    size: "8.5 MB",
    status: "available",
    file: "davis-filter.txt",
  },
  {
    name: "KIBA",
    desc: "Kinase Inhibitor BioActivity — integrated Ki, Kd, and IC50 measurements normalized into KIBA scores.",
    license: "Research use",
    rows: "118,254 interactions",
    size: "97.1 MB",
    status: "available",
    file: "kiba.txt",
  },
  {
    name: "BindingDB (subset)",
    desc: "Curated subset for transfer learning. The full BindingDB archive is not redistributed — request access for the complete release.",
    license: "On request",
    rows: "~2.4M total (subset 50K)",
    size: "Request only",
    status: "request",
  },
];

export default function Datasets() {
  const downloadDataset = (dataset: (typeof datasets)[number]) => {
    if (!("file" in dataset) || !dataset.file) {
      toast.error("This dataset is not available for direct download.");
      return;
    }

    const url = `${API_BASE}/data/raw/${encodeURIComponent(dataset.file)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = dataset.file;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(`${dataset.name} download started.`);
  };

  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow="Datasets"
          title="Curated affinity benchmarks"
          description="Standard benchmarks for drug-target affinity modeling. Each dataset comes preprocessed with valid SMILES and canonical protein sequences."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {datasets.map(d => (
            <div key={d.name} className="panel-lg p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <span className={`chip ${d.status === "available" ? "border-success/30 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
                  {d.status === "available" ? "Available" : "On request"}
                </span>
              </div>
              <div className="text-lg font-semibold tracking-tight">{d.name}</div>
              <p className="text-sm text-muted-foreground mt-1 mb-4 flex-1">{d.desc}</p>

              <dl className="grid grid-cols-3 gap-2 text-xs mb-4">
                <div>
                  <dt className="stat-label">Rows</dt>
                  <dd className="font-mono mt-0.5">{d.rows}</dd>
                </div>
                <div>
                  <dt className="stat-label">Size</dt>
                  <dd className="font-mono mt-0.5">{d.size}</dd>
                </div>
                <div>
                  <dt className="stat-label">License</dt>
                  <dd className="mt-0.5">{d.license}</dd>
                </div>
              </dl>

              <div className="flex items-center gap-2">
                {d.status === "available" ? (
                  <button
                    onClick={() => downloadDataset(d)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                ) : (
                  <button
                    onClick={() => toast.info("Request submitted. We'll email you within 48h.")}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded bg-card border border-border hover:bg-muted"
                  >
                    Request access
                  </button>
                )}
                <button className="inline-flex items-center justify-center w-9 h-9 rounded border border-border hover:bg-muted text-muted-foreground" aria-label="Docs">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel mt-6 p-4 flex items-start gap-3 text-sm">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <div className="text-muted-foreground">
            DeepDTA does not redistribute the full BindingDB archive. Use the subset for reproducible benchmarking and request the canonical release directly from BindingDB.org for production work.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
