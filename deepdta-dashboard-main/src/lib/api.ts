// DeepDTA API client. Configurable base URL via VITE_API_BASE_URL.
// Falls back to mocked responses when backend is unreachable so the UI is always usable.

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:5000";

let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/api/csrf-token`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    csrfToken = data.csrf_token ?? data.token ?? null;
    return csrfToken;
  } catch {
    return null;
  }
}

function resetCsrf() {
  csrfToken = null;
}

type Json = Record<string, unknown>;

export interface ApiResult<T> {
  ok: boolean;
  data: T;
  mocked: boolean;
  status: number;
  error?: string;
}

export interface HealthStatus {
  status?: string;
  model_loaded?: boolean;
  model_service?: { available?: boolean; model_loaded?: boolean };
  sandbox?: { available?: boolean; enabled?: boolean; status?: string };
}

async function request<T>(
  path: string,
  init: RequestInit & { mock: () => T; csrf?: boolean } = { mock: () => ({} as T) },
): Promise<ApiResult<T>> {
  const { mock, csrf, ...rest } = init;
  async function sendWithCurrentCsrf() {
    const headers = new Headers(rest.headers);
    if (rest.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (csrf) {
      const t = await ensureCsrf();
      if (t) headers.set("X-CSRF-Token", t);
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      credentials: "include",
    });
    const text = await res.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok) {
      return { ok: false, data: mock(), mocked: false, status: res.status, error: typeof data === "string" ? data : (data as Json).error as string };
    }
    return { ok: true, data: data as T, mocked: false, status: res.status };
  }

  try {
    let result = await sendWithCurrentCsrf();
    if (csrf && result.status === 403) {
      resetCsrf();
      result = await sendWithCurrentCsrf();
    }
    return result;
  } catch (e) {
    return { ok: false, data: mock(), mocked: true, status: 0, error: (e as Error).message };
  }
}

async function requestBlob(
  path: string,
  init: RequestInit & { mock: () => { valid: boolean; formula: string; mw: number; image_url?: string } },
): Promise<ApiResult<{ valid: boolean; formula: string; mw: number; image_url?: string }>> {
  const { mock, ...rest } = init;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      credentials: "include",
    });
    if (!res.ok) {
      return { ok: false, data: mock(), mocked: false, status: res.status };
    }
    const blob = await res.blob();
    return {
      ok: true,
      data: { valid: true, formula: "", mw: 0, image_url: URL.createObjectURL(blob) },
      mocked: false,
      status: res.status,
    };
  } catch (e) {
    return { ok: false, data: mock(), mocked: true, status: 0, error: (e as Error).message };
  }
}

function query(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  return `${path}?${search.toString()}`;
}

// ----------- Auth -----------
export interface User { id?: string; email: string; name?: string; }

export const api = {
  health: () => request<HealthStatus>("/health", {
    method: "GET",
    mock: () => ({
      status: "offline",
      model_service: { available: false, model_loaded: false },
      sandbox: { available: false, enabled: false },
    }),
  }),
  me: () =>
    request<User | { user?: User } | null>("/api/me", { method: "GET", mock: () => null })
      .then((res) => ({
        ...res,
        data: res.data && "user" in res.data ? res.data.user ?? null : res.data,
      })),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/login", {
      method: "POST", csrf: true,
      body: JSON.stringify({ email, password }),
      mock: () => ({ user: { email, name: email.split("@")[0] } }),
    }).then((res) => {
      if (res.ok) resetCsrf();
      return res;
    }),
  register: (email: string, password: string, name?: string) =>
    request<{ user: User }>("/api/register", {
      method: "POST", csrf: true,
      body: JSON.stringify({ email, password, name }),
      mock: () => ({ user: { email, name: name ?? email.split("@")[0] } }),
    }).then((res) => ({
      ...res,
      data: res.data?.user ? res.data : { user: { email, name: name ?? email.split("@")[0] } },
    })).then((res) => {
      if (res.ok) resetCsrf();
      return res;
    }),
  logout: () => request("/api/logout", { method: "POST", csrf: true, mock: () => ({ ok: true }) })
    .then((res) => {
      resetCsrf();
      return res;
    }),

  // ----------- Prediction -----------
  predict: (smiles: string, sequence: string) =>
    request<{ success?: boolean; score?: number; confidence: number; complexity: string; real_model?: boolean; pkd?: number; simulated?: boolean }>(
      query("/predict", { smiles, sequence }),
      {
      method: "GET",
      mock: () => ({
        pkd: +(5 + Math.random() * 4).toFixed(3),
        confidence: +(0.6 + Math.random() * 0.35).toFixed(3),
        complexity: smiles.length > 40 ? "high" : smiles.length > 20 ? "medium" : "low",
        simulated: true,
      }),
    }).then((res) => ({
      ...res,
      data: {
        pkd: Number(res.data.score ?? res.data.pkd ?? 0),
        confidence: Number(res.data.confidence ?? 0),
        complexity: String(res.data.complexity ?? "Medium"),
        simulated: res.data.real_model === undefined ? Boolean(res.data.simulated ?? res.mocked) : !res.data.real_model,
      },
    })),
  generate: (sequence: string, desiredAffinity: number, seed?: string) =>
    request<{ smiles: string; predicted_affinity?: number; pkd?: number; real_model?: boolean; simulated?: boolean }>(
      query("/generate", { sequence, affinity: desiredAffinity, smiles: seed }),
      {
      method: "GET",
      mock: () => ({
        smiles: seed ? `${seed}C(=O)N` : "CC(=O)Nc1ccc(O)cc1",
        pkd: desiredAffinity,
        simulated: true,
      }),
    }).then((res) => ({
      ...res,
      data: {
        smiles: String(res.data.smiles ?? ""),
        pkd: Number(res.data.predicted_affinity ?? res.data.pkd ?? desiredAffinity),
        simulated: res.data.real_model === undefined ? Boolean(res.data.simulated ?? res.mocked) : !res.data.real_model,
      },
    })),

  molecule: (smiles: string) =>
    requestBlob(query("/molecule", { smiles }), {
      method: "GET",
      mock: () => ({ valid: !!smiles.trim(), formula: "C8H9NO2", mw: 151.16 }),
    }),
  check: (smiles: string) =>
    request<{ success?: boolean; exists?: boolean; formula?: string; weight?: number; valid?: boolean; mw?: number }>(
      query("/check", { smiles }),
      {
      method: "GET",
      mock: () => ({ valid: !!smiles.trim(), formula: "C8H9NO2", mw: 151.16 }),
    }).then((res) => ({
      ...res,
      data: {
        valid: Boolean(res.data.exists ?? res.data.valid),
        formula: String(res.data.formula ?? ""),
        mw: Number(res.data.weight ?? res.data.mw ?? 0),
      },
    })),

  visualizeProtein: (
    sequence: string,
    opts: { includePdb?: boolean; pdbId?: string } = {},
  ) =>
    request<{
      pdb?: string;
      pdb_id?: string;
      pdb_url?: string;
      title?: string;
      source?: string;
      metrics: { length?: number; mw?: number; hydrophobic?: number; plddt?: number; ptm?: number };
      plots?: Record<string, string>;
    }>(query("/visualize/protein", { sequence, pdb_id: opts.pdbId }), {
      method: "GET",
      mock: () => ({
        metrics: {
          length: sequence.length,
          mw: +(sequence.length * 110).toFixed(1),
          hydrophobic: +((sequence.match(/[AVILMFWY]/g)?.length ?? 0) / Math.max(1, sequence.length)).toFixed(3),
        },
      }),
    }),

  // ----------- Notebook & datasets -----------
  uploadDataset: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ dataset?: { name: string; size_bytes?: number }; name?: string; rows?: number }>("/api/upload_dataset", {
      method: "POST", csrf: true, body: fd,
      mock: () => ({ name: file.name, rows: Math.floor(Math.random() * 5000) + 100 }),
    }).then((res) => ({
      ...res,
      data: {
        name: res.data.dataset?.name ?? res.data.name ?? file.name,
        rows: res.data.rows ?? 0,
      },
    }));
  },
  uploadNotebook: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ name: string }>("/upload_notebook", {
      method: "POST", csrf: true, body: fd, mock: () => ({ name: file.name }),
    });
  },
  execute: (code: string) =>
    request<{ output: string; error?: string }>("/api/execute", {
      method: "POST", csrf: true,
      body: JSON.stringify({ code }),
      mock: () => ({ output: "", error: "Backend unreachable. Notebook code was not executed." }),
    }),
  saveNotebook: (name: string, cells: unknown) =>
    request<{ ok: true }>("/api/save_notebook", {
      method: "POST", csrf: true,
      body: JSON.stringify({ name, content: { cells } }),
      mock: () => ({ ok: true }),
    }),
  listNotebooks: () =>
    request<{ notebooks: { id?: string | number; name: string; last_modified?: string; updated_at?: string }[] }>("/api/list_notebooks", {
      method: "GET",
      mock: () => ({ notebooks: [
        { id: "kiba-baseline.ipynb", name: "kiba-baseline.ipynb", updated_at: "2026-06-22" },
        { id: "davis-finetune.ipynb", name: "davis-finetune.ipynb", updated_at: "2026-06-25" },
      ]}),
    }).then((res) => ({
      ...res,
      data: {
        notebooks: res.data.notebooks.map((notebook) => ({
          ...notebook,
          id: notebook.id ?? notebook.name,
          updated_at: notebook.updated_at ?? notebook.last_modified ?? "",
        })),
      },
    })),
  loadNotebook: (idOrName: string | number) =>
    request<{ name: string; content?: { cells?: { id?: string; cell_type?: string; type?: string; source: string }[] }; cells?: { id: string; type: string; source: string }[] }>(
      query("/api/load_notebook", { id: idOrName }),
      {
      method: "GET",
      mock: () => ({ name: String(idOrName), cells: [
        { id: "c1", type: "code", source: "import deepdta\nmodel = deepdta.load('kiba')" },
      ]}),
    }).then((res) => ({
      ...res,
      data: {
        name: res.data.name,
        cells: (res.data.content?.cells ?? res.data.cells ?? []).map((cell, index) => ({
          id: String(cell.id ?? `cell-${index + 1}`),
          type: String(cell.type ?? cell.cell_type ?? "code"),
          source: cell.source,
        })),
      },
    })),
  unloadModel: () => request("/api/unload_model", { method: "POST", csrf: true, mock: () => ({ ok: true }) }),
};
