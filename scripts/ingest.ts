import {
  fetchSiteJson,
  fetchSessions,
  fetchGameStats,
  type RawScoreLayoutBall,
} from "../src/lib/conectate";
import {
  upsertCompany,
  upsertGame,
  upsertDrawsBatch,
  getGames,
  getStats,
  setMeta,
  getDrawCount,
} from "../src/lib/db";
import { toGameRow } from "../src/lib/gamespec";
import type { DrawRow } from "../src/lib/types";

interface Args {
  days: number;
  start?: string;
  end?: string;
  catalogOnly: boolean;
  delayMs: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { days: 180, catalogOnly: false, delayMs: 120 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--catalog-only") args.catalogOnly = true;
    else if (a === "--days") args.days = Number(argv[++i] ?? 180);
    else if (a === "--start") args.start = argv[++i];
    else if (a === "--end") args.end = argv[++i];
    else if (a === "--delay") args.delayMs = Number(argv[++i] ?? 120);
  }
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function domToday(): string {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

function addDays(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function isoForDate(date: string): string {
  return `${date}T04:00:00.000Z`;
}

function parseLayout(layoutJson: string): RawScoreLayoutBall[][] {
  try {
    const parsed = JSON.parse(layoutJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseScoreRow(
  layout: RawScoreLayoutBall[][],
  rowIndex: number,
  values: (string | number)[]
): { numbers: string[]; bonus: string[] } {
  const layoutRow = layout[rowIndex] ?? layout[0] ?? [];
  const numbers: string[] = [];
  const bonus: string[] = [];
  values.forEach((v, idx) => {
    const ball = layoutRow[idx];
    const s = String(v);
    if (ball?.is_bonus) bonus.push(s);
    else numbers.push(s);
  });
  return { numbers, bonus };
}

async function ingestCatalog(): Promise<Map<string, string>> {
  console.log("→ Descargando catálogo (_site.json)...");
  const site = await fetchSiteJson();
  const layoutById = new Map<string, string>();
  let companies = 0;
  let games = 0;
  for (const c of site.siteCompanies ?? []) {
    upsertCompany({ id: c._id, title: c.title, order: c.order ?? null });
    companies++;
    for (const sg of c.siteGames ?? []) {
      if (!sg.game) continue;
      const row = toGameRow(c._id, c.title, sg);
      upsertGame(row);
      layoutById.set(row.id, row.layoutJson);
      games++;
    }
  }
  console.log(`  ✓ ${companies} compañías, ${games} juegos.`);
  return layoutById;
}

function loadLayouts(): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of getGames()) map.set(g.id, g.layoutJson);
  return map;
}

async function ingestDay(date: string, layouts: Map<string, string>): Promise<number> {
  const items = await fetchSessions(isoForDate(date));
  const rows: DrawRow[] = [];
  for (const item of items) {
    const layout = parseLayout(layouts.get(item.game_id) ?? "[]");
    const sessions = item.sessions ?? (item.lastSession ? [item.lastSession] : []);
    for (const session of sessions) {
      const score = session.score ?? [];
      score.forEach((scoreRow, rowIndex) => {
        if (!Array.isArray(scoreRow) || scoreRow.length === 0) return;
        const { numbers, bonus } = parseScoreRow(layout, rowIndex, scoreRow);
        if (numbers.length === 0 && bonus.length === 0) return;
        rows.push({
          id: `${session._id}:${rowIndex}`,
          gameId: item.game_id,
          drawDate: date,
          rowIndex,
          numbers,
          bonus,
          createdAt: session.createdAt ?? null,
        });
      });
    }
  }
  upsertDrawsBatch(rows);
  return rows.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("=== Ingesta MenteMatemática ===");

  const existing = getDrawCount();
  const layouts = getGames().length > 0 && !args.catalogOnly ? loadLayouts() : await ingestCatalog();
  if (args.catalogOnly) {
    setMeta("last_catalog_ingest", new Date().toISOString());
    console.log("Catálogo actualizado. Listo.");
    return;
  }

  // snapshot de estadísticas de la fuente (informativo)
  try {
    const gs = await fetchGameStats();
    setMeta("game_stats_snapshot", JSON.stringify(gs));
    setMeta("game_stats_snapshot_at", new Date().toISOString());
    console.log("  ✓ snapshot de game-stats guardado.");
  } catch (err) {
    console.warn("  ! no se pudo guardar game-stats:", (err as Error).message);
  }

  const end = args.end ?? domToday();
  const start = args.start ?? addDays(end, -args.days);

  console.log(`Histórico: ${start} → ${end}`);
  let total = 0;
  let days = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    process.stdout.write(`\r  [${d}] ...`);
    try {
      const n = await ingestDay(d, layouts);
      total += n;
      days++;
      process.stdout.write(`\r  [${d}] ${n} sorteos  (acumulado ${total})        `);
    } catch (err) {
      process.stdout.write(`\r  [${d}] ERROR: ${(err as Error).message}            \n`);
    }
    await sleep(args.delayMs);
  }
  console.log("");

  setMeta("last_ingest", new Date().toISOString());
  setMeta("last_ingest_start", start);
  setMeta("last_ingest_end", end);

  const stats = getStats();
  console.log(`✓ Ingesta completa: ${days} días, ${total} sorteos procesados.`);
  console.log(
    `  DB → ${stats.games} juegos · ${stats.draws} sorteos · ${stats.days} días (${stats.oldestDate} → ${stats.newestDate})`
  );
  if (existing === 0) console.log("  (base de datos recién creada)");
}

main().catch((err) => {
  console.error("Ingesta fallida:", err);
  process.exit(1);
});
