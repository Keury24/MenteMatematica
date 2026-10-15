import type { RawGame, RawSiteGame, RawScoreLayoutBall } from "./conectate";
import type { GameKind, GameRow } from "./types";

export function layoutRows(game: RawGame | undefined): RawScoreLayoutBall[][] {
  const layout = game?.score_layout;
  if (!Array.isArray(layout) || layout.length === 0) return [];
  return layout;
}

export function mainBallCount(game: RawGame | undefined): number | null {
  const rows = layoutRows(game);
  if (rows.length === 0) return null;
  const first = rows[0] ?? [];
  const nonBonus = first.filter((b) => !b?.is_bonus).length;
  return nonBonus > 0 ? nonBonus : first.length;
}

export function hasBonusBall(game: RawGame | undefined): boolean {
  const rows = layoutRows(game);
  const flagged = rows.some((row) => row.some((b) => b?.is_bonus));
  if (flagged) return true;
  const st = game?.statistics;
  const display = game?.display;
  return Boolean(display?.bonus_ball) && st?.bonus_ball_max != null;
}

export function detectKind(
  isQuiniela: boolean,
  mainBalls: number | null,
  ballMin: number | null,
  ballMax: number | null
): GameKind {
  if (isQuiniela) return "quiniela";
  // juegos posicionales de 3 posiciones con rango amplio (p.ej. Pega 3 Más)
  if (mainBalls === 3 && ballMax != null && ballMax > 9) return "quiniela";
  // dígitos por posición (Pick 3/4, Toca 3)
  if (ballMax != null && ballMax <= 9 && (mainBalls ?? 0) >= 3) return "digits";
  if (ballMin != null && ballMin >= 1 && ballMax != null) {
    if (ballMax >= 80) return "kino"; // Super Kino TV (1-84)
    if (ballMax >= 60) return "americanas"; // Powerball / Mega Millions
    if (ballMax <= 50 && (mainBalls ?? 0) >= 5) return "loto"; // Loto / Loto Pool
  }
  if (mainBalls === 4) return "pool";
  if (mainBalls === 2) return "pale";
  if (mainBalls === 1) return "single";
  if (mainBalls === 3) return "quiniela";
  if (ballMax != null && ballMax > 9) return "pool";
  return "other";
}

export function isDistinctKind(kind: GameKind): boolean {
  return kind === "kino" || kind === "americanas" || kind === "loto" || kind === "pool";
}

export function toGameRow(companyId: string, companyTitle: string, sg: RawSiteGame): GameRow {
  const game = sg.game;
  const st = game?.statistics;
  const isQuiniela = Boolean(game?.is_quiniela);
  const mainBalls = mainBallCount(game);
  const ballMin = st?.ball_min ?? null;
  const ballMax = st?.ball_max ?? null;
  const hasBonus = hasBonusBall(game);
  const rows = Math.max(1, layoutRows(game).length);
  const kind = detectKind(isQuiniela, mainBalls, ballMin, ballMax);
  const distinct = isDistinctKind(kind) || (kind === "other" && (mainBalls ?? 0) >= 4);

  return {
    id: sg.game_id,
    companyId,
    companyTitle,
    title: sg.title,
    isQuiniela,
    positions: st?.positions ?? null,
    ballMin,
    ballMax,
    bonusMin: st?.bonus_ball_min ?? null,
    bonusMax: st?.bonus_ball_max ?? null,
    hasBonus,
    mainBalls,
    rows,
    kind,
    distinct,
    layoutJson: JSON.stringify(game?.score_layout ?? []),
    updatedAt: game?.updatedAt ?? null,
  };
}

export function numberWidth(game: GameRow): number {
  const max = game.ballMax ?? 99;
  return max > 9 ? 2 : 1;
}

export function padNumber(value: number | string, width: number): string {
  const s = String(value);
  if (s.length >= width) return s;
  return s.padStart(width, "0");
}
