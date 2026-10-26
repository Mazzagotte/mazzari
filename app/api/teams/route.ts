import { NextRequest, NextResponse } from "next/server";
import { LEAGUES, League } from "../../../lib/config";
import { fetchTeams } from "../../../lib/espnTeams";

export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get("league") || "mlb";
  if (!Object.hasOwn(LEAGUES, league)) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
  try {
    const teams = (await fetchTeams(league as League, request.signal)).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Team lookup failed", error);
    return NextResponse.json({ error: "Team list is unavailable. Enter abbreviations manually." }, { status: 503 });
  }
}
