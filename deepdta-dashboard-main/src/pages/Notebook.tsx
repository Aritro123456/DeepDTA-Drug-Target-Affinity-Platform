import { useEffect, useState } from "react";
import {
  Plus, Play, Save, Cloud, FolderOpen, Eraser, Upload, Trash2, Loader2, FileText, Download, Image as ImageIcon, Box as BoxIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { drainPendingCells, onPendingCell, type PendingCell, type PendingCellAttachment } from "@/lib/notebookBus";

interface Cell {
  id: string;
  kind: "code" | "markdown";
  code: string;
  output?: string;
  error?: string;
  running?: boolean;
  attachment?: PendingCellAttachment;
  origin?: string;
}
interface Dataset { id: string; name: string; rows: number; }

export default function Notebook() {
  const [name, setName] = useState("untitled-notebook");
  const [cells, setCells] = useState<Cell[]>([
    { id: crypto.randomUUID(), kind: "code", code: "import deepdta as dd\nmodel = dd.load('kiba')\nmodel.summary()" },
    { id: crypto.randomUUID(), kind: "code", code: "preds = model.predict(smiles='CCO', sequence=seq)\npreds.head()" },
  ]);
  const [datasets, setDatasets] = useState<Dataset[]>([
    { id: "d1", name: "kiba_small.csv", rows: 2480 },
  ]);
  const [confirmClear, setConfirmClear] = useState(false);

  function addCell() {
    setCells(c => [...c, { id: crypto.randomUUID(), kind: "code", code: "" }]);
  }
  function updateCell(id: string, code: string) {
    setCells(c => c.map(x => x.id === id ? { ...x, code } : x));
  }
  function deleteCell(id: string) {
    setCells(c => c.filter(x => x.id !== id));
  }
  async function runCell(id: string) {
    setCells(c => c.map(x => x.id === id ? { ...x, running: true, output: undefined, error: undefined } : x));
    const cell = cells.find(x => x.id === id);
    if (!cell) return;
    const res = await api.execute(cell.code);
    if (!res.ok) {
      const error =
        res.status === 401
          ? "Please log in before running notebook cells."
          : res.status === 403
            ? res.error || "Your session/CSRF token is invalid. Refresh the page and log in again."
            : res.error || res.data.error || "Notebook code was not executed.";
      setCells(c => c.map(x => x.id === id ? { ...x, running: false, output: undefined, error } : x));
      toast.error(error);
      return;
    }
    setCells(c => c.map(x => x.id === id ? { ...x, running: false, output: res.data.output, error: res.data.error } : x));
  }
  async function runAll() {
    for (const cell of cells) await runCell(cell.id);
    toast.success("All cells executed.");
  }
  async function saveCloud() {
    const res = await api.saveNotebook(name, cells);
    if (res.ok || res.mocked) toast.success(res.mocked ? "Saved (simulated)" : "Saved to cloud");
    else if (res.status === 401) toast.error("Please log in before saving notebooks to cloud.");
    else toast.error(res.error || "Could not save notebook.");
  }
  function saveLocal() {
    const blob = new Blob([JSON.stringify({ name, cells }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Saved locally");
  }
  async function openCloud() {
    const res = await api.listNotebooks();
    if (!res.ok && !res.mocked) {
      if (res.status === 401) toast.error("Please log in before opening cloud notebooks.");
      else toast.error(res.error || "Could not list cloud notebooks.");
      return;
    }
    const first = res.data.notebooks[0];
    if (!first) return toast.info("No cloud notebooks");
    const loaded = await api.loadNotebook(first.id ?? first.name);
    setName(loaded.data.name);
    setCells(loaded.data.cells.map(c => ({ id: c.id, kind: "code" as const, code: c.source })));
    toast.success(`Loaded ${first.name}`);
  }
  function clearAll() {
    setCells([]); setConfirmClear(false); toast.success("Notebook cleared");
  }
  async function uploadDataset(file: File) {
    const res = await api.uploadDataset(file);
    if (!res.ok && !res.mocked) {
      if (res.status === 401) toast.error("Please log in before uploading datasets.");
      else toast.error(res.error || "Dataset upload failed.");
      return;
    }
    setDatasets(d => [...d, { id: crypto.randomUUID(), name: res.data.name, rows: res.data.rows }]);
    toast.success(`Uploaded ${res.data.name}`);
  }
  // Receive cells handed off from other pages (e.g. Target Viewer exports).
  function acceptIncoming(item: PendingCell) {
    setCells(c => [
      ...c,
      {
        id: item.id,
        kind: "markdown",
        code: item.source,
        attachment: item.attachment,
        origin: item.origin,
      },
    ]);
    toast.success(
      item.attachment?.kind === "glb"
        ? "3D model attached to notebook"
        : "Snapshot attached to notebook",
      { description: item.attachment?.filename }
    );
  }
  useEffect(() => {
    const pending = drainPendingCells();
    if (pending.length > 0) {
      setCells(c => [
        ...c,
        ...pending.map(p => ({
          id: p.id,
          kind: "markdown" as const,
          code: p.source,
          attachment: p.attachment,
          origin: p.origin,
        })),
      ]);
    }
    const off = onPendingCell(acceptIncoming);
    return off;
  }, []);

  function downloadAttachment(att: PendingCellAttachment) {
    const a = document.createElement("a");
    a.href = att.dataUrl;
    a.download = att.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1500px] mx-auto">
        <PageHeader
          eyebrow="Research Notebook"
          title="Interactive workspace"
          description="Run code, manage datasets, and save reproducible notebook sessions backed by your account's sandbox."
          actions={
            <>
              <button onClick={saveLocal} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-border bg-card hover:bg-muted">
                <Save className="w-4 h-4" /> Save local
              </button>
              <button onClick={saveCloud} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-95">
                <Cloud className="w-4 h-4" /> Save cloud
              </button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-5">
          <div className="space-y-5 min-w-0">
            {/* Toolbar */}
            <div className="panel p-3 flex flex-wrap items-center gap-2">
              <input
                value={name} onChange={e => setName(e.target.value)}
                className="px-2.5 py-1.5 text-sm font-medium rounded border border-input bg-card focus-ring min-w-[200px]"
              />
              <div className="h-5 w-px bg-border mx-1" />
              <ToolBtn icon={Plus} label="Add cell" onClick={addCell} />
              <ToolBtn icon={Play} label="Run all" onClick={runAll} primary />
              <ToolBtn icon={FolderOpen} label="Open cloud" onClick={openCloud} />
              <ToolBtn icon={Eraser} label="Clear" onClick={() => setConfirmClear(true)} tone="destructive" />
            </div>

            {/* Datasets */}
            <section className="panel-lg">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Datasets</div>
                  <div className="text-xs text-muted-foreground">CSV files available to this notebook</div>
                </div>
              </div>
              <div className="p-4">
                <label className="block border-2 border-dashed border-border rounded-md p-5 text-center text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 mx-auto mb-1.5" />
                  <div className="font-medium text-foreground">Drop a CSV or click to upload</div>
                  <div className="text-xs mt-0.5">Max 50MB — parsed and indexed automatically</div>
                  <input type="file" accept=".csv,.tsv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDataset(f); }} />
                </label>
                {datasets.length > 0 && (
                  <ul className="mt-3 divide-y divide-border border border-border rounded">
                    {datasets.map(d => (
                      <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.rows.toLocaleString()} rows</div>
                        </div>
                        <button onClick={() => setDatasets(x => x.filter(y => y.id !== d.id))}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Cells */}
            <div className="space-y-3">
              {cells.map((cell, i) => (
                <div key={cell.id} className="panel-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2 text-xs">
                    {cell.kind === "markdown" ? (
                      <span className="chip border-primary/30 bg-primary-soft text-primary text-[10px]">
                        {cell.attachment?.kind === "glb" ? (
                          <><BoxIcon className="w-3 h-3" /> 3D model</>
                        ) : cell.attachment?.kind === "png" ? (
                          <><ImageIcon className="w-3 h-3" /> Snapshot</>
                        ) : (
                          <>Markdown</>
                        )}
                      </span>
                    ) : (
                      <span className="font-mono text-muted-foreground">In [{i + 1}]</span>
                    )}
                    {cell.origin && (
                      <span className="text-[10px] text-muted-foreground truncate">from {cell.origin}</span>
                    )}
                    <span className="flex-1" />
                    {cell.kind === "code" && (
                      <button onClick={() => runCell(cell.id)} disabled={cell.running}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs hover:opacity-95 disabled:opacity-50">
                        {cell.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Run
                      </button>
                    )}
                    {cell.kind === "markdown" && cell.attachment && (
                      <button onClick={() => downloadAttachment(cell.attachment!)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-card text-xs hover:bg-muted">
                        <Download className="w-3 h-3" /> {cell.attachment.kind.toUpperCase()}
                      </button>
                    )}
                    <button onClick={() => deleteCell(cell.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {cell.kind === "markdown" ? (
                    <div className="bg-card">
                      {cell.attachment?.kind === "png" && (
                        <div className="p-3 bg-[hsl(215_32%_10%)] flex items-center justify-center border-b border-border">
                          {/* Rendered as <img>, never via innerHTML. */}
                          <img
                            src={cell.attachment.dataUrl}
                            alt={cell.attachment.filename}
                            className="max-h-80 max-w-full rounded shadow"
                          />
                        </div>
                      )}
                      {cell.attachment?.kind === "glb" && (
                        <div className="p-4 border-b border-border flex items-center gap-3 bg-muted/30">
                          <div className="w-10 h-10 rounded bg-primary-soft text-primary flex items-center justify-center shrink-0">
                            <BoxIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate font-mono">{cell.attachment.filename}</div>
                            <div className="text-xs text-muted-foreground">
                              Binary glTF{cell.attachment.bytes ? ` · ${(cell.attachment.bytes / 1024).toFixed(1)} KB` : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => downloadAttachment(cell.attachment!)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-border bg-card hover:bg-muted"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </div>
                      )}
                      <textarea
                        value={cell.code}
                        onChange={e => updateCell(cell.id, e.target.value)}
                        rows={Math.max(3, cell.code.split("\n").length)}
                        className="w-full px-3 py-2.5 text-xs font-mono bg-card focus:outline-none resize-none text-muted-foreground"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={cell.code}
                        onChange={e => updateCell(cell.id, e.target.value)}
                        rows={Math.max(3, cell.code.split("\n").length)}
                        className="w-full px-3 py-2.5 text-sm font-mono bg-card focus:outline-none resize-none"
                        placeholder="# write Python here"
                        spellCheck={false}
                      />
                      {(cell.output || cell.error) && (
                        <div className={`px-3 py-2 border-t border-border text-xs font-mono whitespace-pre-wrap ${
                          cell.error ? "bg-destructive/5 text-destructive" : "bg-muted/40 text-foreground"
                        }`}>
                          {cell.error ?? cell.output}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              {cells.length === 0 && (
                <div className="panel-lg p-10 text-center text-sm text-muted-foreground">
                  No cells yet — click <span className="font-medium text-foreground">Add cell</span> to start.
                </div>
              )}
            </div>
          </div>

        </div>

        {confirmClear && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmClear(false)}>
            <div className="panel-lg max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
              <div className="text-base font-semibold mb-1">Clear notebook?</div>
              <p className="text-sm text-muted-foreground mb-4">
                This removes all cells from the current session. Saved cloud copies stay intact.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted">Cancel</button>
                <button onClick={clearAll} className="px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:opacity-95">Clear</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ToolBtn({
  icon: Icon, label, onClick, primary, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; primary?: boolean; tone?: "destructive" }) {
  const cls = primary
    ? "bg-primary text-primary-foreground hover:opacity-95"
    : tone === "destructive"
    ? "border border-border text-destructive hover:bg-destructive/10"
    : "border border-border bg-card hover:bg-muted";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded ${cls}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
