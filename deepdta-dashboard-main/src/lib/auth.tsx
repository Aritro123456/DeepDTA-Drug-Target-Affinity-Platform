import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, type User } from "./api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await api.me();
      if (!active) return;
      if (res.ok && res.data) setUser(res.data);
      else {
        setUser(null);
        localStorage.removeItem("deepdta:user");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const login: AuthCtx["login"] = async (email, password) => {
    const res = await api.login(email, password);
    if (res.ok) {
      setUser(res.data.user);
      localStorage.setItem("deepdta:user", JSON.stringify(res.data.user));
      return { ok: true };
    }
    return { ok: false, error: res.error ?? "Login failed" };
  };

  const register: AuthCtx["register"] = async (email, password, name) => {
    const res = await api.register(email, password, name);
    if (res.ok) {
      return login(email, password);
    }
    return { ok: false, error: res.error ?? "Registration failed" };
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    localStorage.removeItem("deepdta:user");
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
