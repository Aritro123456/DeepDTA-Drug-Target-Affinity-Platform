import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Atom, FlaskConical, NotebookPen, Boxes, Dna, Database, Home, LogOut, LogIn, Menu, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/predict", label: "Prediction Lab", icon: FlaskConical },
  { to: "/molecule", label: "Molecule Viewer", icon: Atom },
  { to: "/target", label: "Target Viewer", icon: Dna },
  { to: "/notebook", label: "Research Notebook", icon: NotebookPen },
  { to: "/datasets", label: "Datasets", icon: Database },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const crumb = nav.find(n => n.to === loc.pathname)?.label ?? "Workspace";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Boxes className="w-4.5 h-4.5 text-sidebar-primary-foreground" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">DeepDTA</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Affinity Lab</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">Workspace</div>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2.5 px-2.5 py-2 rounded text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 text-xs">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-semibold">
                {(user.name ?? user.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sidebar-accent-foreground font-medium">{user.name ?? user.email}</div>
                <div className="truncate text-sidebar-foreground/60 text-[11px]">{user.email}</div>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center justify-center gap-2 w-full py-2 rounded bg-sidebar-primary text-sidebar-primary-foreground font-medium hover:opacity-95"
            >
              <LogIn className="w-4 h-4" /> Sign in
            </NavLink>
          )}
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-14 bg-background/85 backdrop-blur border-b border-border flex items-center gap-3 px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 rounded hover:bg-muted"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">DeepDTA</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            <span className="font-medium">{crumb}</span>
          </div>
          <div className="ml-auto" />
        </header>
        <main className="flex-1 min-w-0 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
