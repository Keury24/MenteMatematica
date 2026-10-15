import { NextRequest, NextResponse } from "next/server";
import { getGame, getDraws } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const gameId = sp.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId requerido" }, { status: 400 });

  const game = getGame(gameId);
  if (!game) return NextResponse.json({ error: "juego no encontrado" }, { status: 404 });

  const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? 60)));
  const draws = getDraws(gameId, limit);

  return NextResponse.json({
    game: { ...game, layoutJson: undefined },
    draws,
  });
}
