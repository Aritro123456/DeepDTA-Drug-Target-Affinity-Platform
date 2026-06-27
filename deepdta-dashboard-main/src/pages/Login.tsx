import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Boxes, LogIn, UserPlus, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const nav = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    const res = mode === "login"
      ? await login(email, password)
      : await register(email, password, name);
    setLoading(false);
    if (res.ok) {
      setSuccess(mode === "login" ? "Signed in successfully." : "Account created. Welcome!");
      setTimeout(() => nav("/"), 600);
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 flex items-center px-6 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Boxes className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">DeepDTA</span>
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="text-center mb-6">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">Affinity Lab</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in to your workspace" : "Create your research account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Heavy visualization and cloud notebooks require an authenticated session.
            </p>
          </div>

          <div className="panel-lg p-1 mb-4 grid grid-cols-2 gap-1 bg-muted">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`py-2 text-sm font-medium rounded transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="panel-lg p-6 space-y-4">
            {mode === "register" && (
              <Field label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@lab.org" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />

            {error && (
              <div className="flex items-start gap-2 text-sm p-2.5 rounded border border-destructive/30 bg-destructive/5 text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 text-sm p-2.5 rounded border border-success/30 bg-success/10 text-success">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-primary text-primary-foreground font-medium hover:opacity-95 disabled:opacity-60 focus-ring"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>

            <div className="text-xs text-muted-foreground text-center pt-1">
              By continuing you agree to the DeepDTA research terms of use.
            </div>
          </form>

          <div className="text-center text-xs text-muted-foreground mt-4">
            <Link to="/" className="hover:text-foreground">← Back to overview</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded border border-input bg-card focus-ring placeholder:text-muted-foreground/70"
      />
    </label>
  );
}
