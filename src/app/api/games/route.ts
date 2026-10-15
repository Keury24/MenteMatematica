import { NextResponse } from "next/server";
import { getCompanies, getGames, getStats, getMeta } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    companies: getCompanies(),
    games: getGames().map((g) => ({ ...g, layoutJson: undefined })),
    stats: getStats(),
    lastIngest: getMeta("last_ingest"),
    lastIngestRange: [getMeta("last_ingest_start"), getMeta("last_ingest_end")],
  });
}
