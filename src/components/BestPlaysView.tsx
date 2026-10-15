"use client";

import { useEffect, useMemo, useState } from "react";
import type { BestPlaysResult } from "@/lib/types";
import { GamePicker, useCatalog } from "./GamePicker";
import { Balls, KindBadge, Stat } from "./ui";

function pct(x: number, digits = 4) {
  return `${(x * 100).toExponential(digits)}%`;
}

export function BestPlaysView({ initialGameId }: { initialGameId?: string }) {
  const { games } = useCatalog();
  const [gameId, setGameId] = useState(initialGameId ?? "");
  const [maxPlays, setMaxPlays] = useState(8);
  const [iterations, setIterations] = useState(20000);
  const [data, setData] = useState<BestPlaysResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // selecciona automáticamente un juego popular la primera vez
  useEffect(() => {
    if (!gameId && games.length) {
      const preferred =
        games.find((g) => g.title.toLowerCase().includes("quiniela leidsa")) ??
        games.find((g) => g.kind === "quiniela") ??
        games[0];
      setGameId(preferred.id);
    }
  }, [games, gameId]);

  useEffect(() => {
    if (!gameId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/best-plays?gameId=${encodeURIComponent(gameId)}&maxPlays=${maxPlays}&iterations=${iterations}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.error ?? "Error al generar las jugadas"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [gameId, maxPlays, iterations]);

  const current = useMemo(() => games.find((g) => g.id === gameId), [games, gameId]);

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Juego</label>
            <GamePicker games={games} value={gameId} onChange={setGameId} />
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Jugadas</label>
              <select className="select" value={maxPlays} onChange={(e) => setMaxPlays(Number(e.target.value))}>
                {[3, 5, 8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Simulaciones</label>
              <select className="select" value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
                {[5000, 20000, 50000].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString("es-DO")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {loading && <div className="card text-white/60">Calculando modelo…</div>}
      {error && <div className="card border-rose-400/30 text-rose-200">{error}</div>}

      {data && !loading && (
        <>
          <section className="card">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">
                {data.companyTitle} · {data.gameTitle}
              </h2>
              <KindBadge kind={data.kind} />
              <span className="chip text-white/60">{data.totalDraws} sorteos analizados</span>
              {current?.ballMin != null && current?.ballMax != null && (
                <span className="chip text-white/60">
                  rango {current.ballMin}–{current.ballMax}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-white/60">{data.strategy}</p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="χ²" value={data.chiSquare.statistic.toFixed(1)} hint={`gl = ${data.chiSquare.df}`} />
            <Stat
              label="p-valor"
              value={data.chiSquare.pValue.toFixed(4)}
              hint={data.chiSquare.uniform ? "compatible con azar" : "desviación detectada"}
            />
            <Stat
              label="Ajuste aplicado"
              value={`${(data.signal.appliedEdge * 100).toFixed(1)}%`}
              hint="ventaja asumida (≤20%)"
            />
            <Stat
              label="Lift Monte Carlo"
              value={`${data.monteCarlo.lift.toFixed(2)}×`}
              hint={`modelo ${data.monteCarlo.recommendedAvgHits} · azar ${data.monteCarlo.randomAvgHits}`}
            />
          </section>

          <section
            className={`card ${
              data.chiSquare.uniform ? "border-sky-400/20" : "border-amber-400/30"
            }`}
          >
            <div className="text-sm">
              <span className="font-semibold text-white/80">Lectura estadística: </span>
              <span className="text-white/60">{data.signal.note}</span>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-semibold text-white/80">Backtest: </span>
              <span className="text-white/60">{data.backtest.note}</span>
            </div>
          </section>

          <section className="card">
            <h3 className="mb-3 text-lg font-bold">Jugadas recomendadas</h3>
            <div className="space-y-3">
              {data.plays.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-sm font-bold text-cyan-200">
                    {i + 1}
                  </span>
                  <Balls numbers={p.numbers} />
                  <div className="ml-auto text-right text-xs text-white/50">
                    <div className="font-mono">{p.note}</div>
                    <div>score {p.score}</div>
                  </div>
                </div>
              ))}
              {data.plays.length === 0 && <p className="text-white/50">Sin jugadas disponibles.</p>}
            </div>
          </section>

          {data.positionPicks.length > 0 && (
            <section className="card">
              <h3 className="mb-3 text-lg font-bold">Números por posición</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.positionPicks.map((pp) => (
                  <div key={pp.position} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Posición {pp.position}</div>
                    <Balls numbers={pp.picks} size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="card">
              <h4 className="mb-2 text-sm font-bold text-hot">Más calientes (reciente)</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.hottest.map((s) => (
                  <span key={s.number} className="ball-sm border-hot/40 text-hot">
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
            <div className="card">
              <h4 className="mb-2 text-sm font-bold text-cold">Más fríos</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.coldest.map((s) => (
                  <span key={s.number} className="ball-sm border-cold/40 text-cold">
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
            <div className="card">
              <h4 className="mb-2 text-sm font-bold text-white/80">Más atrasados</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.dueNumbers.map((s) => (
                  <span key={s.number} className="ball-sm border-white/20 text-white/70">
                    {s.number}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {data.pairs.length > 0 && (
            <section className="card">
              <h3 className="mb-3 text-lg font-bold">Pares más frecuentes</h3>
              <div className="flex flex-wrap gap-2">
                {data.pairs.map((p, i) => (
                  <span key={i} className="chip text-white/70">
                    {p.pair.join(" · ")} <span className="text-white/40">({p.count})</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="card border-amber-400/20 text-sm text-amber-100/80">
            {data.disclaimer}
          </section>
        </>
      )}
    </div>
  );
}
