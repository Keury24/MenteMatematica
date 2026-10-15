"use client";

import { useEffect, useMemo, useState } from "react";

export interface GameLite {
  id: string;
  companyId: string;
  companyTitle: string;
  title: string;
  kind: string;
  distinct: boolean;
  mainBalls: number | null;
  ballMin: number | null;
  ballMax: number | null;
  hasBonus: boolean;
  isQuiniela: boolean;
}

export interface CompanyLite {
  id: string;
  title: string;
  order: number | null;
}

export function useCatalog() {
  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [games, setGames] = useState<GameLite[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/games")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setCompanies(d.companies ?? []);
        setGames(d.games ?? []);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  return { companies, games, loading };
}

export function GamePicker({
  games,
  value,
  onChange,
  kinds,
}: {
  games: GameLite[];
  value: string;
  onChange: (id: string) => void;
  kinds?: string[];
}) {
  const grouped = useMemo(() => {
    const filtered = kinds && kinds.length ? games.filter((g) => kinds.includes(g.kind)) : games;
    const map = new Map<string, GameLite[]>();
    for (const g of filtered) {
      if (!map.has(g.companyTitle)) map.set(g.companyTitle, []);
      map.get(g.companyTitle)!.push(g);
    }
    return Array.from(map.entries());
  }, [games, kinds]);

  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Selecciona un juego —</option>
      {grouped.map(([company, list]) => (
        <optgroup key={company} label={company}>
          {list.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
