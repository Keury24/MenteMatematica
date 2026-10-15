export const KIND_LABEL: Record<string, string> = {
  quiniela: "Quiniela",
  digits: "Dígitos",
  kino: "Kino",
  americanas: "Americana",
  loto: "Loto",
  pool: "Pool / Combo",
  pale: "Palé",
  single: "Número único",
  other: "Otro",
};

export const KIND_COLOR: Record<string, string> = {
  quiniela: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
  digits: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  kino: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  americanas: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  loto: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  pool: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  pale: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  single: "border-white/20 bg-white/5 text-white/70",
  other: "border-white/20 bg-white/5 text-white/70",
};

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`chip ${KIND_COLOR[kind] ?? KIND_COLOR.other}`}>{KIND_LABEL[kind] ?? kind}</span>
  );
}

export function Balls({ numbers, size = "md" }: { numbers: string[]; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {numbers.map((n, i) => (
        <span key={`${n}-${i}`} className={size === "sm" ? "ball-sm" : "ball"}>
          {n}
        </span>
      ))}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="font-mono text-lg font-bold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-white/40">{hint}</div> : null}
    </div>
  );
}
