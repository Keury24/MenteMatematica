import { NextRequest, NextResponse } from "next/server";
import { getGame, getDrawsAscending } from "@/lib/db";
import { bestPlays } from "@/lib/bestplays";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const gameId = sp.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId requerido" }, { status: 400 });

  const game = getGame(gameId);
  if (!game) return NextResponse.json({ error: "juego no encontrado" }, { status: 404 });

  const maxPlays = Math.min(20, Math.max(1, Number(sp.get("maxPlays") ?? 8)));
  const iterations = Math.min(50000, Math.max(0, Number(sp.get("iterations") ?? 20000)));

  const draws = getDrawsAscending(gameId);
  const result = bestPlays(game, draws, { maxPlays, monteCarloIterations: iterations });

  return NextResponse.json(result);
}
