import { NextRequest, NextResponse } from "next/server";
import { getGame, getDrawsAscending } from "@/lib/db";
import { analyzeGame } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId requerido" }, { status: 400 });

  const game = getGame(gameId);
  if (!game) return NextResponse.json({ error: "juego no encontrado" }, { status: 404 });

  const draws = getDrawsAscending(gameId);
  const an = analyzeGame(game, draws);

  const positionStats = an.perPositionStats.map((arr, p) => ({
    position: p + 1,
    numbers: arr
      .map((s) => ({ number: s.number, count: s.count, z: Number(s.z.toFixed(3)), rate: Number(s.frequency.toFixed(4)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
  }));

  return NextResponse.json({
    game: { ...game, layoutJson: undefined },
    totalDraws: an.totalDraws,
    N: an.N,
    K: an.K,
    positional: an.positional,
    observedRange: an.observedRange,
    chiSquare: an.chiSquare,
    entropy: an.entropy,
    maxEntropy: an.maxEntropy,
    stats: an.stats.map((s) => ({
      ...s,
      z: Number(s.z.toFixed(3)),
      recentWeighted: Number(s.recentWeighted.toFixed(3)),
      gapZ: Number(s.gapZ.toFixed(3)),
    })),
    pairs: an.pairs.slice(0, 30),
    positionStats,
  });
}
