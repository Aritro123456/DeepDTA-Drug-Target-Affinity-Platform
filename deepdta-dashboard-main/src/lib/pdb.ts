// Minimal PDB parser — extracts CA atoms per chain. Enough to draw a backbone
// trace and color by residue. Not a full structural parser.

export interface PdbAtom {
  serial: number;
  name: string;
  resName: string;
  chain: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
}

export interface PdbChain {
  id: string;
  atoms: PdbAtom[]; // CA only
  sequence: string;
}

export interface PdbStructure {
  id?: string;
  title?: string;
  chains: PdbChain[];
  atomCount: number;
  source: "rcsb" | "upload" | "text";
}

const AA3to1: Record<string, string> = {
  ALA: "A", ARG: "R", ASN: "N", ASP: "D", CYS: "C", GLU: "E", GLN: "Q",
  GLY: "G", HIS: "H", ILE: "I", LEU: "L", LYS: "K", MET: "M", PHE: "F",
  PRO: "P", SER: "S", THR: "T", TRP: "W", TYR: "Y", VAL: "V", SEC: "U",
  PYL: "O", MSE: "M",
};

export function parsePdb(text: string, source: PdbStructure["source"] = "text"): PdbStructure {
  const chainsMap = new Map<string, PdbAtom[]>();
  let title = "";
  let id: string | undefined;
  let atomCount = 0;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const rec = line.slice(0, 6);
    if (rec === "HEADER") {
      id = line.slice(62, 66).trim() || undefined;
    } else if (rec === "TITLE ") {
      title += " " + line.slice(10, 80).trim();
    } else if (rec === "ATOM  " || rec === "HETATM") {
      atomCount++;
      const name = line.slice(12, 16).trim();
      if (name !== "CA") continue;
      const altLoc = line.slice(16, 17).trim();
      if (altLoc && altLoc !== "A") continue;
      const resName = line.slice(17, 20).trim();
      // Only standard amino acids (and MSE selenomethionine)
      if (!(resName in AA3to1)) continue;
      const chain = line.slice(21, 22).trim() || "A";
      const resSeq = parseInt(line.slice(22, 26).trim(), 10);
      const x = parseFloat(line.slice(30, 38));
      const y = parseFloat(line.slice(38, 46));
      const z = parseFloat(line.slice(46, 54));
      if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
      const serial = parseInt(line.slice(6, 11).trim(), 10) || atomCount;
      const list = chainsMap.get(chain) ?? [];
      list.push({ serial, name, resName, chain, resSeq, x, y, z });
      chainsMap.set(chain, list);
    } else if (rec === "ENDMDL") {
      // Only first model
      break;
    }
  }

  const chains: PdbChain[] = Array.from(chainsMap.entries()).map(([cid, atoms]) => {
    atoms.sort((a, b) => a.resSeq - b.resSeq);
    const sequence = atoms.map(a => AA3to1[a.resName] ?? "X").join("");
    return { id: cid, atoms, sequence };
  });

  return {
    id,
    title: title.trim() || undefined,
    chains,
    atomCount,
    source,
  };
}

export async function fetchPdbById(pdbId: string): Promise<PdbStructure> {
  const id = pdbId.trim().toLowerCase();
  if (!/^[a-z0-9]{4}$/.test(id)) {
    throw new Error("PDB ID must be 4 characters (e.g. 1CRN, 4HHB).");
  }
  const url = `https://files.rcsb.org/download/${id.toUpperCase()}.pdb`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`RCSB returned ${r.status} for ${id.toUpperCase()}`);
  const text = await r.text();
  const s = parsePdb(text, "rcsb");
  s.id = s.id ?? id.toUpperCase();
  return s;
}
