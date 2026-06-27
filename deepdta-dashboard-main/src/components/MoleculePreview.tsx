import { Atom } from "lucide-react";

interface Props {
  smiles?: string;
  imageUrl?: string;
  label?: string;
  className?: string;
}

// Lightweight visual placeholder for a 2D molecule rendering. Renders an SVG
// generated deterministically from the SMILES so previews vary visibly.
export default function MoleculePreview({ smiles, imageUrl, label, className }: Props) {
  if (imageUrl) {
    return (
      <div className={`panel-lg flex items-center justify-center p-4 bg-muted/30 ${className ?? ""}`}>
        <img src={imageUrl} alt={label ?? "Molecule"} className="max-h-full max-w-full" />
      </div>
    );
  }
  const s = smiles ?? "";
  if (!s.trim()) {
    return (
      <div className={`panel-lg flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/30 ${className ?? ""}`}>
        <Atom className="w-10 h-10 mb-2 opacity-40" />
        <div className="text-xs">No molecule loaded</div>
      </div>
    );
  }
  // Deterministic pseudo-skeleton
  const atoms = s.replace(/[^A-Za-z]/g, "").slice(0, 14).split("");
  const cx = 160, cy = 120, r = 70;
  const pts = atoms.map((a, i) => {
    const ang = (i / atoms.length) * Math.PI * 2;
    return { a, x: cx + Math.cos(ang) * (r - (i % 3) * 8), y: cy + Math.sin(ang) * (r - (i % 3) * 8) };
  });
  return (
    <div className={`panel-lg p-4 bg-muted/30 ${className ?? ""}`}>
      <svg viewBox="0 0 320 240" className="w-full h-full">
        {pts.map((p, i) => {
          const n = pts[(i + 1) % pts.length];
          return <line key={`l${i}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke="hsl(var(--foreground))" strokeWidth="1.2" opacity="0.55" />;
        })}
        {pts.map((p, i) => (
          <g key={`a${i}`}>
            <circle cx={p.x} cy={p.y} r={p.a === "C" ? 3 : 9} fill={p.a === "C" ? "hsl(var(--foreground))" : "hsl(var(--card))"} stroke="hsl(var(--primary))" strokeWidth="1.4" />
            {p.a !== "C" && (
              <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--primary))" className="font-mono">{p.a}</text>
            )}
          </g>
        ))}
      </svg>
      {label && <div className="text-center text-xs text-muted-foreground mt-1 font-mono truncate">{label}</div>}
    </div>
  );
}
