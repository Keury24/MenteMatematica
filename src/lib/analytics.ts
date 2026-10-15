import type { DrawRow, GameRow, NumberStat } from "./types";
import { padNumber, numberWidth } from "./gamespec";

/* ------------------------------------------------------------------ */
/* Estadística base                                                    */
/* ------------------------------------------------------------------ */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
}

export function stdDev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/* Lanczos log-gamma */
function gammaln(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x)
    );
  }
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/* Regularized lower incomplete gamma P(a,x) via series */
function gammaLower(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = gammaln(a);
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= 300; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

/* Regularized upper incomplete gamma Q(a,x) via continued fraction */
function gammaUpper(a: number, x: number): number {
  if (x <= 0) return 1;
  const gln = gammaln(a);
  const FPMIN = 1e-300;
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** p-valor de cola superior para chi-cuadrado con df grados de libertad. */
export function chiSquarePValue(statistic: number, df: number): number {
  if (df <= 0) return 1;
  if (statistic <= 0) return 1;
  const a = df / 2;
  const x = statistic / 2;
  if (x < a + 1) return 1 - gammaLower(a, x);
  return gammaUpper(a, x);
}

/* erf / normal CDF (Abramowitz & Stegun 7.1.26) */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function shannonEntropy(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/* ------------------------------------------------------------------ */
/* Construcción de la serie y estadísticas por juego                   */
/* ------------------------------------------------------------------ */

export interface GameAnalytics {
  game: GameRow;
  totalDraws: number;
  values: number[];
  width: number;
  N: number;
  K: number;
  distinct: boolean;
  positional: boolean;
  stats: NumberStat[];
  byValue: Map<number, NumberStat>;
  perPositionStats: NumberStat[][];
  lastByPosition: number[];
  chiSquare: { statistic: number; df: number; pValue: number; uniform: boolean };
  entropy: number;
  maxEntropy: number;
  pairs: { pair: number[]; count: number }[];
  observedRange: { min: number; max: number };
  totalNumbersSeen: number;
  positionSeq: number[][];
  comboSeq: number[][];
}

interface Accum {
  count: number;
  perPos: number[];
  positions: number[];
  recent: number;
  lastIndex: number;
  gaps: number[];
}

const DECAY_HALF_LIFE = 25;

function numericValues(nums: string[]): number[] {
  const out: number[] = [];
  for (const n of nums) {
    const v = Number(n);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

export function buildSeries(game: GameRow, drawsAscending: DrawRow[]): { positionSeq: number[][]; comboSeq: number[][] } {
  const positional = !game.distinct;
  const positionSeq: number[][] = [];
  const comboSeq: number[][] = [];
  for (const d of drawsAscending) {
    const vals = numericValues(d.numbers);
    if (vals.length === 0) continue;
    comboSeq.push(vals);
    if (positional) positionSeq.push(vals);
  }
  return { positionSeq, comboSeq };
}

export function analyzeGame(game: GameRow, drawsAscending: DrawRow[]): GameAnalytics {
  const width = numberWidth(game);
  const positional = !game.distinct;
  const { positionSeq, comboSeq } = buildSeries(game, drawsAscending);
  const totalDraws = comboSeq.length;

  const observedMin = comboSeq.length ? Math.min(...comboSeq.map((c) => Math.min(...c))) : 0;
  const observedMax = comboSeq.length ? Math.max(...comboSeq.map((c) => Math.max(...c))) : 0;

  let min = game.ballMin;
  let max = game.ballMax;
  if (min == null || max == null) {
    min = observedMin;
    max = observedMax;
  }
  const values: number[] = [];
  for (let v = min; v <= max; v++) values.push(v);
  const N = values.length || 1;

  let K = game.mainBalls ?? (positionSeq[0]?.length ?? 0);
  if (!K) K = 1;

  const acc = new Map<number, Accum>();
  for (const v of values) {
    acc.set(v, { count: 0, perPos: new Array(K).fill(0), positions: [], recent: 0, lastIndex: -1, gaps: [] });
  }
  const getAcc = (v: number): Accum => {
    let a = acc.get(v);
    if (!a) {
      a = { count: 0, perPos: new Array(K).fill(0), positions: [], recent: 0, lastIndex: -1, gaps: [] };
      acc.set(v, a);
    }
    return a;
  };

  const T = totalDraws;
  const decay = Math.log(2) / DECAY_HALF_LIFE;
  const lastByPosition = new Array(K).fill(-1);

  const posCounts: number[][] = Array.from({ length: K }, () => new Array(N).fill(0));

  for (let i = 0; i < T; i++) {
    const row = positional ? positionSeq[i] : comboSeq[i];
    const w = Math.exp(-decay * (T - 1 - i));
    row.forEach((v, pos) => {
      const a = getAcc(v);
      a.count += 1;
      if (pos < K) a.perPos[pos] += 1;
      a.positions.push(i);
      a.recent += w;
      if (pos < K) {
        lastByPosition[pos] = v;
        const idx = v - min;
        if (idx >= 0 && idx < N) posCounts[pos][idx] += 1;
      }
    });
  }

  const perPositionStats: NumberStat[][] = Array.from({ length: K }, () => []);

  const stats: NumberStat[] = values.map((v) => {
    const a = getAcc(v);
    const expected = positional ? totalDraws / N : (totalDraws * K) / N;
    const z = expected > 0 ? (a.count - expected) / Math.sqrt(expected * (1 - 1 / N)) : 0;
    const gaps: number[] = [];
    for (let g = 1; g < a.positions.length; g++) gaps.push(a.positions[g] - a.positions[g - 1]);
    const currentGap = a.positions.length ? T - 1 - a.positions[a.positions.length - 1] : T;
    if (a.positions.length) gaps.push(currentGap);
    const avgGap = gaps.length ? mean(gaps) : totalDraws / (positional ? 1 : K);
    const sd = stdDev(gaps);
    const gapZ = sd > 0 ? (currentGap - avgGap) / sd : 0;
    const maxGap = gaps.length ? Math.max(...gaps) : currentGap;
    const lastSeen = a.positions.length ? undefined : null;
    const lastDate = lastSeen === null ? null : null;
    const positionRate = a.perPos.map((c) => (totalDraws ? c / totalDraws : 0));
    void lastDate;
    return {
      number: padNumber(v, width),
      value: v,
      count: a.count,
      frequency: totalDraws ? a.count / (positional ? totalDraws : totalDraws) : 0,
      expected,
      z,
      recentWeighted: a.recent,
      gap: currentGap,
      avgGap,
      maxGap,
      gapZ,
      lastSeen: a.positions.length ? String(a.positions[a.positions.length - 1]) : null,
      perPosition: a.perPos.slice(),
      positionRate,
      markov: 0,
    };
  });

  // Posiciones: construir NumberStat por posición
  for (let pos = 0; pos < K; pos++) {
    perPositionStats[pos] = values.map((v) => {
      const base = stats[v - (values[0] ?? 0)];
      const cnt = posCounts[pos][v - min] ?? 0;
      const exp = totalDraws / N;
      const zz = exp > 0 ? (cnt - exp) / Math.sqrt(exp * (1 - 1 / N)) : 0;
      return {
        ...base,
        count: cnt,
        frequency: totalDraws ? cnt / totalDraws : 0,
        expected: exp,
        z: zz,
      };
    });
  }

  // Chi-cuadrado (bondad de ajuste a uniforme)
  let chi = 0;
  let df = 0;
  if (positional) {
    for (let pos = 0; pos < K; pos++) {
      const exp = totalDraws / N;
      if (exp <= 0) continue;
      for (let i = 0; i < N; i++) {
        const o = posCounts[pos][i];
        chi += ((o - exp) * (o - exp)) / exp;
      }
      df += N - 1;
    }
  } else {
    const exp = (totalDraws * K) / N;
    if (exp > 0) {
      for (const v of values) {
        const a = getAcc(v);
        chi += ((a.count - exp) * (a.count - exp)) / exp;
      }
      df = N - 1;
    }
  }
  const pValue = chiSquarePValue(chi, df);

  // Entropía de la distribución observada
  const countsArr = values.map((v) => getAcc(v).count);
  const totalCount = countsArr.reduce((a, b) => a + b, 0) || 1;
  const probs = countsArr.map((c) => c / totalCount);
  const entropy = shannonEntropy(probs);
  const maxEntropy = Math.log2(N);

  // Markov: para juegos posicionales, P(actual = n | anterior = último)
  if (positional) {
    const trans: Map<number, Map<number, number>>[] = Array.from({ length: K }, () => new Map());
    for (let i = 1; i < T; i++) {
      const prev = positionSeq[i - 1];
      const cur = positionSeq[i];
      for (let pos = 0; pos < K; pos++) {
        const from = prev[pos];
        const to = cur[pos];
        if (from == null || to == null) continue;
        const m = trans[pos];
        if (!m.has(from)) m.set(from, new Map());
        const mm = m.get(from)!;
        mm.set(to, (mm.get(to) ?? 0) + 1);
      }
    }
    stats.forEach((s) => (s.markov = 0));
    for (let pos = 0; pos < K; pos++) {
      const from = lastByPosition[pos];
      if (from == null || from < 0) continue;
      const m = trans[pos].get(from);
      if (!m) continue;
      const sum = Array.from(m.values()).reduce((a, b) => a + b, 0) + N; // Laplace
      for (const s of stats) {
        const c = m.get(s.value) ?? 0;
        perPositionStats[pos].find((p) => p.value === s.value)!.markov = (c + 1) / sum;
      }
    }
    // agregar markov a stats (max sobre posiciones)
    for (const s of stats) {
      s.markov = Math.max(...perPositionStats.map((pp) => pp.find((p) => p.value === s.value)?.markov ?? 0));
    }
  }

  // Pares (coocurrencia) sólo para combos
  const pairs: { pair: number[]; count: number }[] = [];
  if (!positional && T > 0) {
    const pairMap = new Map<string, number>();
    for (const row of comboSeq) {
      const uniq = Array.from(new Set(row)).sort((a, b) => a - b);
      for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
          const key = `${uniq[i]}-${uniq[j]}`;
          pairMap.set(key, (pairMap.get(key) ?? 0) + 1);
        }
      }
    }
    for (const [key, count] of pairMap) {
      const [a, b] = key.split("-").map(Number);
      pairs.push({ pair: [a, b], count });
    }
    pairs.sort((a, b) => b.count - a.count);
  }

  const totalNumbersSeen = countsArr.reduce((a, b) => a + b, 0);

  return {
    game,
    totalDraws,
    values,
    width,
    N,
    K,
    distinct: game.distinct,
    positional,
    stats,
    byValue: new Map(stats.map((s) => [s.value, s])),
    perPositionStats,
    lastByPosition,
    chiSquare: { statistic: chi, df, pValue, uniform: pValue >= 0.05 },
    entropy,
    maxEntropy,
    pairs: pairs.slice(0, 50),
    observedRange: { min: observedMin, max: observedMax },
    totalNumbersSeen,
    positionSeq,
    comboSeq,
  };
}
