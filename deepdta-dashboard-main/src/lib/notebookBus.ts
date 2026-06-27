// Lightweight bridge to hand off artifacts (images, 3D models, snippets)
// from any page (e.g. the protein viewer) into the Research Notebook.
//
// Producers call pushPendingCell(...). The Notebook page drains the queue
// on mount AND subscribes to live events for same-session inserts.

export type PendingCellAttachment = {
  kind: "png" | "glb";
  /** data: URL so the payload survives reloads via localStorage. */
  dataUrl: string;
  filename: string;
  /** Optional size in bytes for UI display. */
  bytes?: number;
};

export type PendingCell = {
  id: string;
  kind: "markdown";
  /** Markdown / code text shown in the cell body. Rendered as text, never as HTML. */
  source: string;
  attachment?: PendingCellAttachment;
  origin?: string;
  createdAt: number;
};

const STORAGE_KEY = "deepdta:pending-cells";
const EVENT_NAME = "deepdta:cell-pushed";

function readQueue(): PendingCell[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingCell[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingCell[]) {
  try {
    if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota — swallow; the live event still delivers in-session.
  }
}

export function pushPendingCell(
  cell: Omit<PendingCell, "id" | "createdAt">
): PendingCell {
  const item: PendingCell = {
    ...cell,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const existing = readQueue();
  existing.push(item);
  writeQueue(existing);
  window.dispatchEvent(new CustomEvent<PendingCell>(EVENT_NAME, { detail: item }));
  return item;
}

export function drainPendingCells(): PendingCell[] {
  const items = readQueue();
  writeQueue([]);
  return items;
}

export function onPendingCell(cb: (cell: PendingCell) => void): () => void {
  const handler = (e: Event) => {
    const ce = e as CustomEvent<PendingCell>;
    if (ce.detail) cb(ce.detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

/** Acknowledge an in-session delivered cell so it isn't re-drained on next mount. */
export function ackPendingCell(id: string) {
  const remaining = readQueue().filter(c => c.id !== id);
  writeQueue(remaining);
}
