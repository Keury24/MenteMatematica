export type GameKind =
  | "quiniela"
  | "digits"
  | "kino"
  | "americanas"
  | "loto"
  | "pool"
  | "pale"
  | "single"
  | "other";

export interface CompanyRow {
  id: string;
  title: string;
  order: number | null;
}

export interface GameRow {
  id: string;
  companyId: string;
  companyTitle: string;
  title: string;
  isQuiniela: boolean;
  positions: number | null;
  ballMin: number | null;
  ballMax: number | null;
  bonusMin: number | null;
  bonusMax: number | null;
  hasBonus: boolean;
  mainBalls: number | null;
  rows: number;
  kind: GameKind;
  distinct: boolean;
  layoutJson: string;
  updatedAt: string | null;
}

export interface DrawRow {
  id: string;
  gameId: string;
  drawDate: string;
  rowIndex: number;
  numbers: string[];
  bonus: string[];
  createdAt: string | null;
}

export interface NumberStat {
  number: string;
  value: number;
  count: number;
  frequency: number;
  expected: number;
  z: number;
  recentWeighted: number;
  gap: number;
  avgGap: number;
  maxGap: number;
  gapZ: number;
  lastSeen: string | null;
  perPosition: number[];
  positionRate: number[];
  markov: number;
}

export interface PlaySignal {
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface Play {
  numbers: string[];
  bonus?: string[];
  score: number;
  signals: PlaySignal[];
  hitProb: number;
  baselineProb: number;
  note: string;
}

export interface BestPlaysResult {
  gameId: string;
  gameTitle: string;
  companyTitle: string;
  kind: GameKind;
  strategy: string;
  generatedAt: string;
  totalDraws: number;
  observedRange: { min: number; max: number };
  chiSquare: { statistic: number; df: number; pValue: number; uniform: boolean };
  entropy: number;
  maxEntropy: number;
  weights: Record<string, number>;
  signal: { pValue: number; strength: number; appliedEdge: number; note: string };
  backtest: { hits: number; expected: number; played: number; note: string };
  positionPicks: { position: number; picks: string[]; stats: NumberStat[] }[];
  plays: Play[];
  topNumbers: NumberStat[];
  hottest: NumberStat[];
  coldest: NumberStat[];
  dueNumbers: NumberStat[];
  pairs: { pair: string[]; count: number }[];
  monteCarlo: {
    iterations: number;
    recommendedAvgHits: number;
    randomAvgHits: number;
    lift: number;
  };
  disclaimer: string;
}
