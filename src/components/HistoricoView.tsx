"use client";

import { useEffect, useState } from "react";
import { GamePicker, useCatalog } from "./GamePicker";
import { Balls, KindBadge } from "./ui";

interface Draw {
  id: string;
  drawDate: string;
  numbers: string[];
  bonus: string[];
  createdAt: string | null;
}

export function HistoricoView({ initialGameId }: { initialGameId?: string }) {
  const { games } = useCatalog();
  const [gameId, setGameId] = useState(initialGameId ?? "");
  const [limit, setLimit] = useState(60);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [meta, setMeta] = useState<{ companyTitle: string; title: string; kind: string } | null>(null);
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
    fetch(`/api/draws?gameId=${encodeURIComponent(gameId)}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setDraws(d.draws ?? []);
        setMeta(d.game ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [gameId, limit]);

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Juego</label>
            <GamePicker games={games} value={gameId} onChange={setGameId} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/40">Registros</label>
            <select className="select" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[30, 60, 120, 300].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading && <div className="card text-white/60">Cargando histórico…</div>}

      {meta && !loading && (
        <section className="card">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">
              {meta.companyTitle} · {meta.title}
            </h2>
            <KindBadge kind={meta.kind} />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-white/40">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Bonus</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-white/60">{d.drawDate}</td>
                    <td className="px-3 py-2">
                      <Balls numbers={d.numbers} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      {d.bonus.length ? <Balls numbers={d.bonus} size="sm" /> : <span className="text-white/30">—</span>}
                    </td>
                  </tr>
                ))}
                {draws.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-white/40">
                      Sin resultados. Ejecuta la ingesta para poblar el histórico.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
