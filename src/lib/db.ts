import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { CompanyRow, DrawRow, GameRow, GameKind } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "mentematica.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  "order" INTEGER
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  company_title TEXT NOT NULL,
  title TEXT NOT NULL,
  is_quiniela INTEGER NOT NULL DEFAULT 0,
  positions INTEGER,
  ball_min INTEGER,
  ball_max INTEGER,
  bonus_min INTEGER,
  bonus_max INTEGER,
  has_bonus INTEGER NOT NULL DEFAULT 0,
  main_balls INTEGER,
  row_count INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'other',
  is_distinct INTEGER NOT NULL DEFAULT 0,
  layout_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS draws (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  draw_date TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  numbers_json TEXT NOT NULL,
  bonus_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_draws_game_date ON draws (game_id, draw_date);
CREATE INDEX IF NOT EXISTS idx_draws_game ON draws (game_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

let globalDb: DatabaseSync | null = null;

function create(): DatabaseSync {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(SCHEMA);
  return db;
}

export function getDb(): DatabaseSync {
  const g = globalThis as unknown as { __mmDb?: DatabaseSync };
  if (!g.__mmDb) g.__mmDb = create();
  return g.__mmDb;
}

type SqlValue = string | number | null;

export function upsertCompany(c: CompanyRow): void {
  getDb()
    .prepare(
      `INSERT INTO companies (id, title, "order") VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, "order"=excluded."order"`
    )
    .run(c.id, c.title, c.order ?? null);
}

export function upsertGame(g: GameRow): void {
  getDb()
    .prepare(
      `INSERT INTO games (id, company_id, company_title, title, is_quiniela, positions,
         ball_min, ball_max, bonus_min, bonus_max, has_bonus, main_balls, row_count, kind, is_distinct, layout_json, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         company_id=excluded.company_id, company_title=excluded.company_title, title=excluded.title,
         is_quiniela=excluded.is_quiniela, positions=excluded.positions, ball_min=excluded.ball_min,
         ball_max=excluded.ball_max, bonus_min=excluded.bonus_min, bonus_max=excluded.bonus_max,
         has_bonus=excluded.has_bonus, main_balls=excluded.main_balls, row_count=excluded.row_count,
         kind=excluded.kind, is_distinct=excluded.is_distinct, layout_json=excluded.layout_json,
         updated_at=excluded.updated_at`
    )
    .run(
      g.id,
      g.companyId,
      g.companyTitle,
      g.title,
      g.isQuiniela ? 1 : 0,
      g.positions ?? null,
      g.ballMin ?? null,
      g.ballMax ?? null,
      g.bonusMin ?? null,
      g.bonusMax ?? null,
      g.hasBonus ? 1 : 0,
      g.mainBalls ?? null,
      g.rows,
      g.kind,
      g.distinct ? 1 : 0,
      g.layoutJson,
      g.updatedAt ?? null
    );
}

const insertDrawStmt = () =>
  getDb().prepare(
    `INSERT INTO draws (id, game_id, draw_date, row_index, numbers_json, bonus_json, created_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       draw_date=excluded.draw_date, numbers_json=excluded.numbers_json,
       bonus_json=excluded.bonus_json, created_at=excluded.created_at`
  );

export function upsertDraw(d: DrawRow): void {
  insertDrawStmt().run(
    d.id,
    d.gameId,
    d.drawDate,
    d.rowIndex,
    JSON.stringify(d.numbers),
    JSON.stringify(d.bonus),
    d.createdAt ?? null
  );
}

export function upsertDrawsBatch(rows: DrawRow[]): number {
  if (rows.length === 0) return 0;
  const db = getDb();
  const stmt = insertDrawStmt();
  db.exec("BEGIN");
  try {
    for (const d of rows) {
      stmt.run(
        d.id,
        d.gameId,
        d.drawDate,
        d.rowIndex,
        JSON.stringify(d.numbers),
        JSON.stringify(d.bonus),
        d.createdAt ?? null
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return rows.length;
}

function mapGame(r: Record<string, SqlValue>): GameRow {
  return {
    id: String(r.id),
    companyId: String(r.company_id),
    companyTitle: String(r.company_title),
    title: String(r.title),
    isQuiniela: Number(r.is_quiniela) === 1,
    positions: r.positions == null ? null : Number(r.positions),
    ballMin: r.ball_min == null ? null : Number(r.ball_min),
    ballMax: r.ball_max == null ? null : Number(r.ball_max),
    bonusMin: r.bonus_min == null ? null : Number(r.bonus_min),
    bonusMax: r.bonus_max == null ? null : Number(r.bonus_max),
    hasBonus: Number(r.has_bonus) === 1,
    mainBalls: r.main_balls == null ? null : Number(r.main_balls),
    rows: Number(r.row_count),
    kind: r.kind as GameKind,
    distinct: Number(r.is_distinct) === 1,
    layoutJson: String(r.layout_json),
    updatedAt: r.updated_at == null ? null : String(r.updated_at),
  };
}

export function getCompanies(): CompanyRow[] {
  const rows = getDb().prepare(`SELECT id, title, "order" FROM companies ORDER BY "order" IS NULL, "order", title`).all();
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    order: r.order == null ? null : Number(r.order),
  }));
}

export function getGames(): GameRow[] {
  const rows = getDb().prepare(`SELECT * FROM games ORDER BY company_title, title`).all();
  return rows.map((r) => mapGame(r as Record<string, SqlValue>));
}

export function getGame(id: string): GameRow | null {
  const r = getDb().prepare(`SELECT * FROM games WHERE id = ?`).get(id);
  return r ? mapGame(r as Record<string, SqlValue>) : null;
}

export function getDrawCount(gameId?: string): number {
  if (gameId) {
    const r = getDb().prepare(`SELECT COUNT(*) AS n FROM draws WHERE game_id = ?`).get(gameId);
    return Number(r?.n ?? 0);
  }
  const r = getDb().prepare(`SELECT COUNT(*) AS n FROM draws`).get();
  return Number(r?.n ?? 0);
}

export function getDraws(gameId: string, limit?: number): DrawRow[] {
  const sql = limit
    ? `SELECT * FROM draws WHERE game_id = ? ORDER BY draw_date DESC, row_index DESC LIMIT ?`
    : `SELECT * FROM draws WHERE game_id = ? ORDER BY draw_date DESC, row_index DESC`;
  const rows = limit
    ? getDb().prepare(sql).all(gameId, limit)
    : getDb().prepare(sql).all(gameId);
  return rows.map((r) => ({
    id: String(r.id),
    gameId: String(r.game_id),
    drawDate: String(r.draw_date),
    rowIndex: Number(r.row_index),
    numbers: JSON.parse(String(r.numbers_json)),
    bonus: JSON.parse(String(r.bonus_json)),
    createdAt: r.created_at == null ? null : String(r.created_at),
  }));
}

export function getDrawsAscending(gameId: string, limit?: number): DrawRow[] {
  const sql = limit
    ? `SELECT * FROM (SELECT * FROM draws WHERE game_id = ? ORDER BY draw_date DESC, row_index DESC LIMIT ?) ORDER BY draw_date ASC, row_index ASC`
    : `SELECT * FROM draws WHERE game_id = ? ORDER BY draw_date ASC, row_index ASC`;
  const rows = limit ? getDb().prepare(sql).all(gameId, limit) : getDb().prepare(sql).all(gameId);
  return rows.map((r) => ({
    id: String(r.id),
    gameId: String(r.game_id),
    drawDate: String(r.draw_date),
    rowIndex: Number(r.row_index),
    numbers: JSON.parse(String(r.numbers_json)),
    bonus: JSON.parse(String(r.bonus_json)),
    createdAt: r.created_at == null ? null : String(r.created_at),
  }));
}

export function getMeta(key: string): string | null {
  const r = getDb().prepare(`SELECT value FROM meta WHERE key = ?`).get(key);
  return r ? String(r.value) : null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .run(key, value);
}

export function getStats(): {
  companies: number;
  games: number;
  draws: number;
  days: number;
  oldestDate: string | null;
  newestDate: string | null;
} {
  const db = getDb();
  const companies = Number(db.prepare(`SELECT COUNT(*) AS n FROM companies`).get()?.n ?? 0);
  const games = Number(db.prepare(`SELECT COUNT(*) AS n FROM games`).get()?.n ?? 0);
  const draws = Number(db.prepare(`SELECT COUNT(*) AS n FROM draws`).get()?.n ?? 0);
  const dmin = db.prepare(`SELECT MIN(draw_date) AS d FROM draws`).get()?.d;
  const dmax = db.prepare(`SELECT MAX(draw_date) AS d FROM draws`).get()?.d;
  const days = Number(db.prepare(`SELECT COUNT(DISTINCT draw_date) AS n FROM draws`).get()?.n ?? 0);
  return {
    companies,
    games,
    draws,
    days,
    oldestDate: dmin == null ? null : String(dmin),
    newestDate: dmax == null ? null : String(dmax),
  };
}
