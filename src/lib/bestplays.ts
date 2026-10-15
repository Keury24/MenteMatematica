import type { DrawRow, GameRow, BestPlaysResult, Play, PlaySignal } from "./types";
import { analyzeGame, mean, stdDev, clamp, type GameAnalytics } from "./analytics";
import { DISCLAIMER } from "./constants";

export interface BestPlaysOptions {
  maxPlays?: number;
  perPosition?: number;
  monteCarloIterations?: number;
}

const DEFAULTS: Required<BestPlaysOptions> = {
  maxPlays: 8,
  perPosition: 6,
  monteCarloIterations: 20000,
};

/* --------------------------- utilidades --------------------------- */

function standardize(xs: number[]): number[] {
  const m = mean(xs);
  const s = stdDev(xs);
  if (s === 0) return xs.map(() => 0);
  return xs.map((x) => (x - m) / s);
}

function softmax(xs: number[], temperature: number): number[] {
  const t = Math.max(temperature, 1e-6);
  const maxX = Math.max(...xs);
  const exps = xs.map((x) => Math.exp((x - maxX) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/**
 * Encogimiento honesto: si el chi-cuadrado es compatible con azar uniforme
 * (p >= 0.05) no aplicamos NINGUNA ventaja (edge = 0) y la probabilidad del
 * modelo coincide con la del azar. Solo permitimos un ajuste acotado cuando hay
 * una desviación estadísticamente significativa y suficiente muestra.
 */
function computeEdge(an: GameAnalytics): number {
  const p = an.chiSquare.pValue;
  if (!(p < 0.05)) return 0;
  const sampleFactor = clamp(an.totalDraws / 200, 0, 1);
  return clamp(((0.05 - p) / 0.05) * 0.2 * sampleFactor, 0, 0.2);
}

function shrunkDist(scores: number[], N: number, edge: number): number[] {
  const temp = Math.max(stdDev(scores), 0.35);
  const sm = softmax(scores, temp);
  return sm.map((x) => (1 - edge) / N + edge * x);
}

const WEIGHTS_POSITIONAL = { frequency: 1, recent: 1.2, due: 0.8, position: 1.6, markov: 0.7 };
const WEIGHTS_COMBO = { frequency: 1, recent: 1.1, due: 0.9, pair: 1.4, balance: 0.7 };

/* ------------------------------ motor ----------------------------- */

export function bestPlays(
  game: GameRow,
  drawsAscending: DrawRow[],
  options: BestPlaysOptions = {}
): BestPlaysResult {
  const opts = { ...DEFAULTS, ...options };
  const an = analyzeGame(game, drawsAscending);
  if (an.totalDraws === 0) return emptyResult(game, an);
  return an.positional ? positionalEngine(game, an, opts) : comboEngine(game, an, opts);
}

function baseResult(
  game: GameRow,
  an: GameAnalytics
): Omit<
  BestPlaysResult,
  | "strategy"
  | "positionPicks"
  | "plays"
  | "topNumbers"
  | "hottest"
  | "coldest"
  | "dueNumbers"
  | "pairs"
  | "monteCarlo"
  | "weights"
  | "kind"
  | "signal"
  | "backtest"
> {
  return {
    gameId: game.id,
    gameTitle: game.title,
    companyTitle: game.companyTitle,
    generatedAt: new Date().toISOString(),
    totalDraws: an.totalDraws,
    observedRange: an.observedRange,
    chiSquare: an.chiSquare,
    entropy: an.entropy,
    maxEntropy: an.maxEntropy,
    disclaimer: DISCLAIMER,
  };
}

function signalBlock(an: GameAnalytics) {
  const edge = computeEdge(an);
  const strength = clamp(1 - an.chiSquare.pValue, 0, 1);
  return {
    edge,
    signal: {
      pValue: an.chiSquare.pValue,
      strength,
      appliedEdge: edge,
      note: an.chiSquare.uniform
        ? "El histórico es estadísticamente compatible con un sorteo justo: no se aplica ventaja; las jugadas son una priorización, no una predicción con ventaja comprobada."
        : "Se detectó una desviación significativa (p<0.05); se aplica un ajuste acotado que puede deberse a azar por múltiples comparaciones.",
    },
  };
}

function emptyResult(game: GameRow, an: GameAnalytics): BestPlaysResult {
  const { edge, signal } = signalBlock(an);
  void edge;
  return {
    ...baseResult(game, an),
    kind: game.kind,
    strategy: "Sin datos suficientes",
    weights: {},
    signal,
    backtest: { hits: 0, expected: 0, played: 0, note: "Sin datos." },
    positionPicks: [],
    plays: [],
    topNumbers: [],
    hottest: [],
    coldest: [],
    dueNumbers: [],
    pairs: [],
    monteCarlo: { iterations: 0, recommendedAvgHits: 0, randomAvgHits: 0, lift: 1 },
  };
}

/* -------------------- juegos posicionales ------------------------- */
/* Quinielas, Pick 3/4, Pega 3, Toca 3: cada posición es una categoría independiente */

function positionalEngine(game: GameRow, an: GameAnalytics, opts: Required<BestPlaysOptions>): BestPlaysResult {
  const W = WEIGHTS_POSITIONAL;
  const { K, N, width } = an;
  const { edge, signal } = signalBlock(an);

  const posScores: number[][] = [];
  const posDists: number[][] = [];
  const posOrder: number[][] = [];

  for (let p = 0; p < K; p++) {
    const arr = an.perPositionStats[p];
    const zRecent = standardize(arr.map((s) => s.recentWeighted));
    const zMarkov = standardize(arr.map((s) => s.markov));
    const comp = arr.map((s, i) =>
      W.frequency * s.z + W.recent * zRecent[i] + W.due * s.gapZ + W.position * s.z + W.markov * zMarkov[i]
    );
    posScores.push(comp);
    posDists.push(shrunkDist(comp, N, edge));
    posOrder.push(comp.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c).map((x) => x.i));
  }

  const positionPicks = posScores.map((_, p) => {
    const idxs = posOrder[p].slice(0, opts.perPosition);
    return {
      position: p + 1,
      picks: idxs.map((i) => an.stats[i].number),
      stats: idxs.map((i) => an.perPositionStats[p][i]),
    };
  });

  const topIdxPerPos = posOrder.map((o) => o.slice(0, Math.min(3, o.length)));
  const cartesian: number[][] = [];
  const rec = (p: number, acc: number[]) => {
    if (p === K) {
      cartesian.push(acc.slice());
      return;
    }
    for (const i of topIdxPerPos[p]) {
      acc.push(i);
      rec(p + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);

  const baseline = Math.pow(1 / N, K);
  const plays: Play[] = cartesian.map((combo) => {
    let logProb = 0;
    const signals: PlaySignal[] = [];
    const numbers = combo.map((idx, p) => {
      const s = an.perPositionStats[p][idx];
      const prob = posDists[p][idx];
      logProb += Math.log(prob);
      signals.push({
        label: `Pos ${p + 1} · ${s.number}`,
        value: Number(s.z.toFixed(2)),
        weight: W.frequency,
        contribution: Number((prob * 100).toFixed(4)),
      });
      return s.number;
    });
    const modelProb = Math.exp(logProb);
    const score = combo.reduce((acc, idx, p) => acc + posScores[p][idx], 0);
    return {
      numbers,
      score: Number(score.toFixed(3)),
      signals,
      hitProb: modelProb,
      baselineProb: baseline,
      note: `P(modelo) ${(modelProb * 100).toExponential(3)}% · P(azar) ${(baseline * 100).toExponential(3)}%`,
    };
  });
  plays.sort((a, b) => b.score - a.score);

  const monteCarlo = simulatePositional(an, plays[0]?.numbers, opts.monteCarloIterations, edge);
  const backtest = backtestPositional(an, plays[0]?.numbers, width);

  return {
    ...baseResult(game, an),
    kind: game.kind,
    strategy:
      "Modelo posicional (categoría por posición): puntaje por frecuencia z, recencia (decaimiento exponencial), " +
      "atraso relativo, frecuencia posicional y transición de Markov; probabilidades encogidas hacia uniforme según evidencia.",
    weights: W,
    signal,
    backtest,
    positionPicks,
    plays: plays.slice(0, opts.maxPlays),
    topNumbers: an.stats.slice().sort((a, b) => b.z - a.z).slice(0, 25),
    hottest: an.stats.slice().sort((a, b) => b.recentWeighted - a.recentWeighted).slice(0, 15),
    coldest: an.stats.slice().sort((a, b) => a.recentWeighted - b.recentWeighted).slice(0, 15),
    dueNumbers: an.stats.slice().sort((a, b) => b.gapZ - a.gapZ).slice(0, 15),
    pairs: [],
    monteCarlo,
  };
}

function simulatePositional(
  an: GameAnalytics,
  recommended: string[] | undefined,
  iterations: number,
  edge: number
) {
  const { K, N } = an;
  if (!recommended || iterations <= 0) return { iterations: 0, recommendedAvgHits: 0, randomAvgHits: 0, lift: 1 };

  const recIdx = recommended.map((n, p) => an.perPositionStats[p].findIndex((s) => s.number === n));
  const dists: number[][] = [];
  const cdfs: number[][] = [];
  for (let p = 0; p < K; p++) {
    const counts = an.perPositionStats[p].map((s) => s.count);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const emp = counts.map((c) => c / total);
    const dist = emp.map((e) => (1 - edge) / N + edge * e);
    dists.push(dist);
    let acc = 0;
    cdfs.push(dist.map((d) => (acc += d)));
  }
  const sample = (p: number): number => {
    const r = Math.random();
    const arr = cdfs[p];
    for (let i = 0; i < arr.length; i++) if (r <= arr[i]) return i;
    return arr.length - 1;
  };

  let recHits = 0;
  let randHits = 0;
  for (let it = 0; it < iterations; it++) {
    for (let p = 0; p < K; p++) {
      if (sample(p) === recIdx[p]) recHits++;
      if (Math.floor(Math.random() * N) === recIdx[p]) randHits++;
    }
  }
  const rec = recHits / iterations;
  const rand = randHits / iterations;
  return {
    iterations,
    recommendedAvgHits: Number(rec.toFixed(5)),
    randomAvgHits: Number(rand.toFixed(5)),
    lift: rand > 0 ? Number((rec / rand).toFixed(3)) : 1,
  };
}

function backtestPositional(an: GameAnalytics, recommended: string[] | undefined, width: number) {
  const { K, N } = an;
  const played = an.positionSeq.length;
  if (!recommended || played === 0) return { hits: 0, expected: 0, played: 0, note: "Sin datos." };
  const expected = played * Math.pow(1 / N, K);
  let hits = 0;
  for (const row of an.positionSeq) {
    let match = true;
    for (let p = 0; p < K; p++) {
      if (pad(row[p], width) !== recommended[p]) {
        match = false;
        break;
      }
    }
    if (match) hits++;
  }
  return {
    hits,
    expected: Number(expected.toFixed(6)),
    played,
    note: `La jugada principal acertó completo ${hits} de ${played} sorteos históricos (esperado por azar ≈ ${expected.toFixed(4)}).`,
  };
}

/* --------------------- juegos de combinación ---------------------- */
/* Loto, Kino, Loto Pool, Powerball, Mega Millions: K de N sin reemplazo */

function comboEngine(game: GameRow, an: GameAnalytics, opts: Required<BestPlaysOptions>): BestPlaysResult {
  const W = WEIGHTS_COMBO;
  const { K, N, width } = an;
  const { edge, signal } = signalBlock(an);
  const s = an.stats;

  const zRecent = standardize(s.map((x) => x.recentWeighted));
  const baseScore = s.map((x, i) => W.frequency * x.z + W.recent * zRecent[i] + W.due * x.gapZ);
  const scoreByValue = new Map<number, number>();
  s.forEach((x, i) => scoreByValue.set(x.value, baseScore[i]));

  const pairMap = new Map<string, number>();
  for (const p of an.pairs) {
    const key = p.pair[0] < p.pair[1] ? `${p.pair[0]}-${p.pair[1]}` : `${p.pair[1]}-${p.pair[0]}`;
    pairMap.set(key, p.count);
  }
  const maxPair = an.pairs.length ? an.pairs[0].count : 1;
  const pairAffinity = (a: number, b: number): number => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    return ((pairMap.get(key) ?? 0) / maxPair) * 2;
  };

  const sums = an.comboSeq.map((row) => row.reduce((a, b) => a + b, 0));
  const sumSorted = sums.slice().sort((a, b) => a - b);
  const sumLo = quantile(sumSorted, 0.25);
  const sumHi = quantile(sumSorted, 0.75);
  const sumSpan = Math.max(1, sumHi - sumLo);
  const targetEven = K / 2;

  const balanceScore = (nums: number[]): { score: number; sum: number; evens: number; decades: number } => {
    const sum = nums.reduce((a, b) => a + b, 0);
    const sScore = sum >= sumLo && sum <= sumHi ? 1 : Math.max(0, 1 - Math.abs(sum - (sumLo + sumHi) / 2) / (sumSpan * 2));
    const evens = nums.filter((n) => n % 2 === 0).length;
    const pScore = 1 - Math.abs(evens - targetEven) / Math.max(1, K);
    const decs = new Set(nums.map((n) => Math.floor(n / 10))).size;
    const dScore = decs / Math.min(K, Math.ceil(N / 10));
    return { score: (sScore + pScore + dScore) / 3, sum, evens, decades: decs };
  };

  const ticketScore = (nums: number[]) => {
    const sc = nums.reduce((a, n) => a + (scoreByValue.get(n) ?? 0), 0) / K;
    let pairSum = 0;
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) pairSum += pairAffinity(nums[i], nums[j]);
    pairSum /= Math.max(1, comb(nums.length, 2));
    const bal = balanceScore(nums);
    const total = sc + W.pair * pairSum + W.balance * (bal.score * 2 - 1);
    return { sc, pairSum, bal, total };
  };

  const candidates = new Map<string, Play>();
  const valueList = an.values;
  for (let r = 0; r < 400; r++) {
    const chosen: number[] = [];
    const pool = valueList.slice();
    for (let step = 0; step < K && pool.length > 0; step++) {
      pool.sort((x, y) => {
        const ax = (scoreByValue.get(x) ?? 0) + W.pair * avgPair(x, chosen, pairAffinity) + Math.random() * 1.2;
        const ay = (scoreByValue.get(y) ?? 0) + W.pair * avgPair(y, chosen, pairAffinity) + Math.random() * 1.2;
        return ay - ax;
      });
      chosen.push(pool.shift()!);
    }
    if (chosen.length < K) continue;
    chosen.sort((a, b) => a - b);
    const key = chosen.join("-");
    if (candidates.has(key)) continue;
    const { total, sc, pairSum, bal } = ticketScore(chosen);
    candidates.set(key, {
      numbers: chosen.map((n) => pad(n, width)),
      score: Number(total.toFixed(3)),
      signals: [
        { label: "Frecuencia/recencia/atraso", value: Number(sc.toFixed(2)), weight: 1, contribution: Number(sc.toFixed(2)) },
        { label: "Coocurrencia de pares", value: Number(pairSum.toFixed(2)), weight: W.pair, contribution: Number((W.pair * pairSum).toFixed(2)) },
        { label: "Balance suma/paridad/décadas", value: Number(bal.score.toFixed(2)), weight: W.balance, contribution: Number((W.balance * bal.score).toFixed(2)) },
      ],
      hitProb: 1 / comb(N, K),
      baselineProb: 1 / comb(N, K),
      note: `suma ${bal.sum} · ${bal.evens} pares · ${bal.decades} décadas`,
    });
  }

  const plays = Array.from(candidates.values()).sort((a, b) => b.score - a.score).slice(0, opts.maxPlays);
  const monteCarlo = simulateCombo(an, plays, opts.monteCarloIterations, edge);
  const backtest = backtestCombo(an, plays, width);

  return {
    ...baseResult(game, an),
    kind: game.kind,
    strategy:
      `Modelo combinatorio (${K} de ${N} sin reemplazo): puntúa cada número (frecuencia z, recencia, atraso), ` +
      "coocurrencia de pares y balance geométrico (suma, paridad, cobertura de décadas).",
    weights: W,
    signal,
    backtest,
    positionPicks: [],
    plays,
    topNumbers: an.stats.slice().sort((a, b) => b.z - a.z).slice(0, 25),
    hottest: an.stats.slice().sort((a, b) => b.recentWeighted - a.recentWeighted).slice(0, 15),
    coldest: an.stats.slice().sort((a, b) => a.recentWeighted - b.recentWeighted).slice(0, 15),
    dueNumbers: an.stats.slice().sort((a, b) => b.gapZ - a.gapZ).slice(0, 15),
    pairs: an.pairs.slice(0, 15).map((p) => ({ pair: p.pair.map((n) => pad(n, width)), count: p.count })),
    monteCarlo,
  };
}

function simulateCombo(an: GameAnalytics, plays: Play[], iterations: number, edge: number) {
  const { K, N } = an;
  if (plays.length === 0 || iterations <= 0) return { iterations: 0, recommendedAvgHits: 0, randomAvgHits: 0, lift: 1 };

  const scores = an.stats.map((s) => s.z);
  const sm = softmax(scores, Math.max(stdDev(scores), 0.35));
  const w = sm.map((x) => (1 - edge) / N + edge * x);

  const sampleSet = (weighted: boolean, pick: number): Set<number> => {
    const remaining = an.values.map((_, i) => i);
    const set = new Set<number>();
    const nPick = Math.min(pick, remaining.length);
    for (let step = 0; step < nPick; step++) {
      let pos: number;
      if (weighted) {
        let total = 0;
        for (const i of remaining) total += w[i];
        const r = Math.random() * total;
        let acc = 0;
        pos = remaining.length - 1;
        for (let k = 0; k < remaining.length; k++) {
          acc += w[remaining[k]];
          if (r <= acc) {
            pos = k;
            break;
          }
        }
      } else {
        pos = Math.floor(Math.random() * remaining.length);
      }
      const idx = remaining[pos];
      remaining.splice(pos, 1);
      set.add(an.values[idx]);
    }
    return set;
  };

  const primary = new Set(plays[0].numbers.map(Number));
  let recHits = 0;
  let randHits = 0;
  for (let it = 0; it < iterations; it++) {
    const recDraw = sampleSet(true, K);
    let h = 0;
    for (const n of primary) if (recDraw.has(n)) h++;
    recHits += h;
    const randSet = sampleSet(false, K);
    let rh = 0;
    for (const n of randSet) if (recDraw.has(n)) rh++;
    randHits += rh;
  }
  const rec = recHits / iterations;
  const rand = randHits / iterations;
  return {
    iterations,
    recommendedAvgHits: Number(rec.toFixed(4)),
    randomAvgHits: Number(rand.toFixed(4)),
    lift: rand > 0 ? Number((rec / rand).toFixed(3)) : 1,
  };
}

function backtestCombo(an: GameAnalytics, plays: Play[], width: number) {
  const played = an.comboSeq.length;
  const { K, N } = an;
  const expected = (K * K) / N;
  if (plays.length === 0 || played === 0) return { hits: 0, expected: 0, played: 0, note: "Sin datos." };
  const sets = plays.map((p) => new Set(p.numbers));
  let total = 0;
  for (const row of an.comboSeq) {
    const drawn = new Set(row.map((n) => pad(n, width)));
    for (const set of sets) {
      for (const n of set) if (drawn.has(n)) total++;
    }
  }
  const denom = Math.max(1, plays.length * played);
  return {
    hits: Number((total / denom).toFixed(3)),
    expected: Number(expected.toFixed(3)),
    played,
    note: `Aciertos promedio por jugada/sorteo en el histórico: ${(total / denom).toFixed(3)} (esperado por azar ≈ ${expected.toFixed(3)}). Nota: el backtest es dentro de muestra (las jugadas se eligieron con estos mismos datos), por lo que sobreestima.`,
  };
}

function avgPair(v: number, chosen: number[], aff: (a: number, b: number) => number): number {
  if (chosen.length === 0) return 0;
  let s = 0;
  for (const c of chosen) s += aff(v, c);
  return s / chosen.length;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - pos) + sorted[hi] * (pos - lo);
}
