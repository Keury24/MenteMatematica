import { getGames, getGame, getDrawsAscending, getStats } from "../src/lib/db";
import { bestPlays } from "../src/lib/bestplays";

function main() {
  const query = process.argv.slice(2).join(" ").toLowerCase();
  const stats = getStats();
  console.log("=== Estado de la base ===");
  console.log(
    `${stats.games} juegos · ${stats.draws} sorteos · ${stats.days} días (${stats.oldestDate} → ${stats.newestDate})\n`
  );

  const games = getGames();
  if (!query) {
    console.log("Juegos disponibles:");
    for (const g of games) {
      console.log(`  [${g.kind.padEnd(10)}] ${g.companyTitle} · ${g.title}  (${g.id})`);
    }
    console.log("\nUso: npm run explore -- <texto del título>");
    return;
  }

  const matches = games.filter(
    (g) => g.title.toLowerCase().includes(query) || g.companyTitle.toLowerCase().includes(query)
  );
  if (matches.length === 0) {
    console.log(`Sin resultados para "${query}".`);
    return;
  }

  for (const g of matches.slice(0, 6)) {
    const draws = getDrawsAscending(g.id);
    const result = bestPlays(g, draws, { maxPlays: 5, monteCarloIterations: 3000 });
    console.log("──────────────────────────────────────────────────────────");
    console.log(`${g.companyTitle} · ${g.title}  [${g.kind}]  K=${g.mainBalls} rango=${g.ballMin}-${g.ballMax}`);
    console.log(`Sorteos analizados: ${result.totalDraws}`);
    console.log(
      `χ²=${result.chiSquare.statistic.toFixed(1)} df=${result.chiSquare.df} p=${result.chiSquare.pValue.toFixed(3)} ` +
        `→ ${result.chiSquare.uniform ? "compatible con azar uniforme" : "desviación detectada"}`
    );
    console.log(`Entropía=${result.entropy.toFixed(3)} / max=${result.maxEntropy.toFixed(3)}`);
    console.log(`Señal: ${result.signal.note}`);
    console.log(`Backtest: ${result.backtest.note}`);
    console.log(`Jugadas (${result.strategy.slice(0, 60)}...):`);
    for (const p of result.plays) {
      console.log(`   → ${p.numbers.join(" ")}   score=${p.score}   ${p.note}`);
    }
    console.log(
      `MonteCarlo: jugada modelo ${result.monteCarlo.recommendedAvgHits} aciertos vs azar ${result.monteCarlo.randomAvgHits} (lift ${result.monteCarlo.lift})`
    );
    console.log(`Más calientes: ${result.hottest.slice(0, 8).map((s) => s.number).join(" ")}`);
    console.log(`Más atrasados: ${result.dueNumbers.slice(0, 8).map((s) => `${s.number}(g${s.gap})`).join(" ")}`);
  }
}

main();
