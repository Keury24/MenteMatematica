import { API_BASE, SITE_JSON_URL } from "./constants";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
        cache: "no-store",
      });
      if (res.ok || res.status === 400 || res.status === 404) return res;
      lastErr = new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(250 * (attempt + 1) + Math.random() * 150);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface RawScoreLayoutBall {
  label?: string;
  mask?: string;
  is_bonus?: boolean;
  include_in_ball_statistics?: boolean;
  shape?: string;
  color?: string;
}

export interface RawGame {
  _id: string;
  is_quiniela?: boolean;
  statistics?: {
    enabled?: boolean;
    positions?: number;
    ball_min?: number | null;
    ball_max?: number | null;
    bonus_ball_min?: number | null;
    bonus_ball_max?: number | null;
    ball_stats_interval?: number;
  };
  display?: { bonus_ball?: boolean; view_mode?: string };
  score_layout?: RawScoreLayoutBall[][];
  updatedAt?: string;
  last_session_date?: string;
}

export interface RawSiteGame {
  _id: string;
  title: string;
  mobile_title?: string;
  game_id: string;
  game?: RawGame;
}

export interface RawSiteCompany {
  _id: string;
  title: string;
  order?: number;
  siteGames?: RawSiteGame[];
}

export interface RawSite {
  _id: string;
  title: string;
  feed_limit?: number;
  last_session_date?: string;
  siteCompanies?: RawSiteCompany[];
}

export interface RawSession {
  _id: string;
  game_id: string;
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  score?: (string | number)[][];
}

export interface RawSessionItem {
  game_id: string;
  sessions?: RawSession[];
  lastSession?: RawSession | null;
  delays?: unknown[];
  skips?: unknown[];
}

export async function fetchSiteJson(): Promise<RawSite> {
  // La API expone el catálogo en sites/env (fiable). _site.json en www suele
  // estar detrás de un WAF con respuestas 403 intermitentes; se usa solo como respaldo.
  try {
    const res = await request(`${API_BASE}/sites/env`);
    if (res.ok) return (await res.json()) as RawSite;
  } catch {
    /* fallback abajo */
  }
  const res = await request(SITE_JSON_URL);
  if (!res.ok) throw new Error(`No se pudo cargar el catálogo: HTTP ${res.status}`);
  return (await res.json()) as RawSite;
}

export async function fetchSessions(dateIso: string): Promise<RawSessionItem[]> {
  const url = `${API_BASE}/sessions?date=${encodeURIComponent(dateIso)}`;
  const res = await request(url);
  if (res.status === 400) return [];
  if (!res.ok) throw new Error(`sessions HTTP ${res.status}`);
  const data = (await res.json()) as RawSessionItem[];
  return Array.isArray(data) ? data : [];
}

export interface RawGameStats {
  firstPosStats?: unknown[];
  gameStats?: unknown[];
  hotNumbers?: unknown[];
  coldNumbers?: unknown[];
  feed?: unknown[];
}

export async function fetchGameStats(): Promise<RawGameStats> {
  const res = await request(`${API_BASE}/feed/game-stats`);
  if (!res.ok) throw new Error(`game-stats HTTP ${res.status}`);
  return (await res.json()) as RawGameStats;
}

export async function fetchSiteEnv(): Promise<RawSite> {
  const res = await request(`${API_BASE}/sites/env`);
  if (!res.ok) throw new Error(`sites/env HTTP ${res.status}`);
  return (await res.json()) as RawSite;
}
