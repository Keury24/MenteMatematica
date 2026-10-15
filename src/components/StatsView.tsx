"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GamePicker, useCatalog } from "./GamePicker";
import { Balls, KindBadge, Stat } from "./ui";

interface StatNumber {
  number: string;
  value: number;
  count: number;
  expected: number;
  z: number;
  recentWeighted: number;
  gap: number;
  avgGap: number;
  gapZ: number;
  markov: number;
  perPosition: number[];
  positionRate: number[];
}

interface StatsResponse {
  game: { id: string; companyTitle: string; title: string; kind: string; ballMin: number | null; ballMax: number | null };
  totalDraws: number;
  N: number;
  K: number;
  positional: boolean;
  chiSquare: { statistic: number; df: number; pValue: number; uniform: boolean };
  entropy: number;
  maxEntropy: number;
  stats: StatNumber[];
  pairs: { pair: number[]; count: number }[];
  positionStats: { position: number; numbers: { number: string; count: number; z: number }[] }[];
}

export function StatsView({ initialGameId }: { initialGameId?: string }) {
  const { games } = useCatalog();
  const [gameId, setGameId] = useState(initialGameId ?? "");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gameId && games.length) {
      const preferred = games.find((g) => g.kind === "quiniela") ?? games[0];
      setGameId(preferred.id);
    }
  }, [games, gameId]);

  useEffect(() => {
    if (!gameId) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/stats?gameId=${encodeURIComponent(gameId)}`)
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [gameId]);

  const topByCount = useMemo(() => data?.stats.slice().sort((a, b) => b.count - a.count).slice(0, 20) ?? [], [data]);
  const byDue = useMemo(() => data?.stats.slice().sort((a, b) => b.gapZ - a.gapZ).slice(0, 20) ?? [], [data]);
  const chartData = useMemo(
    () =>
      (data?.stats ?? []).map((s) => ({
        number: s.number,
        count: s.count,
        z: Number(s.z.toFixed(2)),
        gap: s.gap,
      })),
    [data]
  );

  return (
    <div className="space-y-5">
      <section className="card">
        <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Juego</label>
        <GamePicker games={games} value={gameId} onChange={setGameId} />
      </section>

      {loading && <div className="card text-white/60">Cargando estadísticas…</div>}

      {data && !loading && (
        <>
          <section className="card">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">
                {data.game.companyTitle} · {data.game.title}
              </h2>
              <KindBadge kind={data.game.kind} />
              <span className="chip text-white/60">
                {data.totalDraws} sorteos · {data.positional ? `${data.K} posiciones` : `${data.K} de ${data.N}`}
              </span>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="χ²" value={data.chiSquare.statistic.toFixed(1)} hint={`gl = ${data.chiSquare.df}`} />
            <Stat
              label="p-valor"
              value={data.chiSquare.pValue.toFixed(4)}
              hint={data.chiSquare.uniform ? "≈ uniforme (azar)" : "desviación"}
            />
            <Stat
              label="Entropía"
              value={`${data.entropy.toFixed(2)} / ${data.maxEntropy.toFixed(2)}`}
              hint="observada / máxima"
            />
            <Stat label="Universo N" value={data.N} hint={`K = ${data.K}`} />
          </section>

          <section className={`card ${data.chiSquare.uniform ? "border-sky-400/20" : "border-amber-400/30"}`}>
            <h3 className="mb-1 text-sm font-bold">Prueba de uniformidad (chi-cuadrado)</h3>
            <p className="text-sm text-white/60">
              {data.chiSquare.uniform
                ? "No se rechaza la hipótesis de equiprobabilidad: cada número tiene la misma probabilidad. Las frecuencias observadas caben dentro de la variación aleatoria esperada."
                : "Se detecta una desviación respecto a la uniformidad (p < 0.05). Puede deberse a sesgo real o a azar por comparaciones múltiples."}
            </p>
          </section>

          <section className="card">
            <h3 className="mb-3 text-lg font-bold">Frecuencia por número</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="number" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
                  <Tooltip
                    contentStyle={{ background: "#0f1524", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <ReferenceLine
                    y={(data.stats[0]?.expected ?? 0)}
                    stroke="rgba(34,211,238,0.6)"
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.count >= (data.stats[0]?.expected ?? 0) ? "#22d3ee" : "#60a5fa"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-white/40">
              Línea punteada = frecuencia esperada si el sorteo fuese uniforme.
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 text-lg font-bold">Top números por frecuencia</h3>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase text-white/40">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Cuenta</th>
                      <th className="px-3 py-2">z</th>
                      <th className="px-3 py-2">Atraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topByCount.map((s) => (
                      <tr key={s.number} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono font-bold">{s.number}</td>
                        <td className="px-3 py-2 font-mono">{s.count}</td>
                        <td className={`px-3 py-2 font-mono ${s.z > 1 ? "text-hot" : s.z < -1 ? "text-cold" : ""}`}>
                          {s.z.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 font-mono">{s.gap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 className="mb-3 text-lg font-bold">Más atrasados (gap relativo)</h3>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-left text-xs uppercase text-white/40">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Atraso</th>
                      <th className="px-3 py-2">Prom.</th>
                      <th className="px-3 py-2">gapZ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDue.map((s) => (
                      <tr key={s.number} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono font-bold">{s.number}</td>
                        <td className="px-3 py-2 font-mono">{s.gap}</td>
                        <td className="px-3 py-2 font-mono">{s.avgGap.toFixed(1)}</td>
                        <td className="px-3 py-2 font-mono text-amber-200">{s.gapZ.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {data.positional && data.positionStats.length > 0 && (
            <section className="card">
              <h3 className="mb-3 text-lg font-bold">Top por posición</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.positionStats.map((p) => (
                  <div key={p.position} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Posición {p.position}</div>
                    <Balls numbers={p.numbers.slice(0, 6).map((n) => n.number)} size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!data.positional && data.pairs.length > 0 && (
            <section className="card">
              <h3 className="mb-3 text-lg font-bold">Pares más frecuentes</h3>
              <div className="flex flex-wrap gap-2">
                {data.pairs.slice(0, 20).map((p, i) => (
                  <span key={i} className="chip text-white/70">
                    {p.pair.join(" · ")} <span className="text-white/40">({p.count})</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
