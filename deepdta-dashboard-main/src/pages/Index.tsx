import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FlaskConical, Atom, Dna, NotebookPen, Database, ArrowRight,
  Activity, Cpu, ServerCog, HardDrive, Sparkles, ChevronRight,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { api, type HealthStatus } from "@/lib/api";

const modules = [
  { to: "/predict", icon: FlaskConical, title: "Prediction Lab", desc: "Estimate pKd for any ligand × target pair, or generate candidate molecules conditioned on a desired affinity.", meta: "Real model · Simulation fallback" },
  { to: "/notebook", icon: NotebookPen, title: "Research Notebook", desc: "Interactive cells, dataset uploads, and cloud-saved sessions for reproducible workflows.", meta: "Python sandbox" },
  { to: "/molecule", icon: Atom, title: "Molecule Viewer", desc: "Validate SMILES, inspect molecular formula and weight, and render a 2D skeletal preview.", meta: "RDKit-compatible" },
  { to: "/target", icon: Dna, title: "Target Viewer", desc: "Inspect protein sequences, compute composition metrics, and stage structural visualization.", meta: "Auth required for 3D" },
  { to: "/datasets", icon: Database, title: "Datasets", desc: "Curated Davis & KIBA benchmarks ready to load. BindingDB available on request.", meta: "Davis · KIBA" },
];

type ServiceStatus = "online" | "degraded" | "offline";

function getServices(health: HealthStatus | null, healthReachable: boolean) {
  const backend: ServiceStatus = healthReachable && health?.status === "healthy" ? "online" : "offline";
  const model: ServiceStatus = health?.model_service?.available
    ? "online"
    : "degraded";
  const sandbox: ServiceStatus = health?.sandbox?.available
    ? "online"
    : health?.sandbox?.enabled
      ? "degraded"
      : "offline";
  const database: ServiceStatus = backend === "online" ? "online" : "offline";

  return [
    { name: "Backend", icon: ServerCog, status: backend },
    { name: "Model Service", icon: Cpu, status: model },
    { name: "Sandbox", icon: Activity, status: sandbox },
    { name: "Database", icon: HardDrive, status: database },
  ];
}

const recent = [
  { kind: "Predict", input: "CCN(CC)CCNC(=O)c1ccc(N)cc1 → EGFR", value: "pKd 7.84", time: "2m ago", tone: "primary" as const },
  { kind: "Generate", input: "JAK2 · target 8.2 pKd", value: "Yielded 4 candidates", time: "18m ago", tone: "info" as const },
  { kind: "Notebook", input: "davis-finetune.ipynb · cell 7", value: "Run complete", time: "1h ago", tone: "success" as const },
  { kind: "Visualize", input: "P00533 (1,210 aa)", value: "Metrics computed", time: "3h ago", tone: "muted" as const },
];

const statusColor: Record<string, string> = {
  online: "border-success/30 bg-success/10 text-success",
  degraded: "border-warning/40 bg-warning/10 text-warning",
  offline: "border-destructive/40 bg-destructive/10 text-destructive",
};

export default function Index() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthReachable, setHealthReachable] = useState(false);
  const services = getServices(health, healthReachable);

  useEffect(() => {
    let active = true;
    async function loadHealth() {
      const res = await api.health();
      if (!active) return;
      setHealth(res.data);
      setHealthReachable(res.ok && !res.mocked);
    }

    loadHealth();
    const timer = window.setInterval(loadHealth, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <AppShell>
      <div className="px-4 lg:px-6 py-6 max-w-[1400px] mx-auto">
        <PageHeader
          eyebrow="Drug-Target Affinity"
          title={user ? `Welcome back, ${user.name ?? user.email.split("@")[0]}` : "A scientific workspace for affinity research"}
          description="DeepDTA pairs a neural drug-target affinity predictor with generative molecule design, structural inspection, and an analyst-grade notebook — built for reproducible computational drug discovery."
          actions={
            <>
              <Link to="/predict" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:opacity-95 focus-ring">
                <FlaskConical className="w-4 h-4" /> New prediction
              </Link>
              <Link to="/notebook" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded border border-border bg-card hover:bg-muted focus-ring">
                <NotebookPen className="w-4 h-4" /> Open notebook
              </Link>
            </>
          }
        />

        {/* Status strip */}
        <div className="panel grid grid-cols-2 md:grid-cols-4 gap-px bg-border overflow-hidden mb-6">
          {services.map((s) => (
            <div key={s.name} className="bg-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                <s.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="stat-label">{s.name}</div>
                <div className="text-sm font-medium capitalize">{s.status}</div>
              </div>
              <span className={`chip ${statusColor[s.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.status === "online" ? "bg-success" : s.status === "degraded" ? "bg-warning" : "bg-destructive"} animate-pulse-dot`} />
                {s.status === "online" ? "OK" : s.status}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Modules */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modules.map((m) => (
              <Link
                key={m.to}
                to={m.to}
                className="group panel p-5 hover:border-primary/40 hover:shadow-md transition-all focus-ring"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                    <m.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="font-semibold text-[15px] tracking-tight mb-1">{m.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{m.desc}</p>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{m.meta}</div>
              </Link>
            ))}
          </div>

          {/* Recent activity */}
          <div className="panel-lg flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Recent activity</div>
                <div className="text-xs text-muted-foreground">Latest runs in this workspace</div>
              </div>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <ul className="divide-y divide-border flex-1">
              {recent.map((r, i) => (
                <li key={i} className="px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`chip border-transparent ${
                      r.tone === "primary" ? "bg-primary-soft text-primary" :
                      r.tone === "info" ? "bg-accent text-accent-foreground" :
                      r.tone === "success" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}>{r.kind}</span>
                    <span className="text-[11px] text-muted-foreground">{r.time}</span>
                  </div>
                  <div className="text-sm mt-1.5 font-mono truncate">{r.input}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.value}</div>
                </li>
              ))}
            </ul>
            <Link to="/notebook" className="px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/50 flex items-center justify-between">
              View full history <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
