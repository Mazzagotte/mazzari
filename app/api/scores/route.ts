import { NextRequest, NextResponse } from "next/server";
import { LEAGUES, type League } from "../../../lib/config";
import type { Game } from "../../../lib/display";
import { normalizeGame } from "../../../lib/scores";
import { cached } from "../../../lib/serverCache";
export const runtime = "nodejs";

async function loadScores(league: League): Promise<Game[]> {
  const { sport, code } = LEAGUES[league];
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/scoreboard?limit=100${league === "ncaaf" ? "&groups=80" : ""}`;
  const response = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(String(response.status));
  const json = await response.json();
  if (!Array.isArray(json.events)) throw new Error("Invalid scoreboard response");
  const games: Game[] = json.events.map((event: unknown) => normalizeGame(event, league));
  const summaryBudget = AbortSignal.timeout(5000);
  let next = 0;
  async function enrichLiveGames() {
    while (next < games.length) {
      const index = next++;
      if (games[index].state !== "in") continue;
      try {
        summaryBudget.throwIfAborted();
        const summary = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/summary?event=${encodeURIComponent(games[index].id)}`,
          { next: { revalidate: 30 }, signal: AbortSignal.any([summaryBudget, AbortSignal.timeout(4000)]) },
        );
        if (!summary.ok) throw new Error(`Summary HTTP ${summary.status}`);
        const data = await summary.json();
        if (!data.header) throw new Error("Invalid game summary");
        games[index] = normalizeGame(json.events[index], league, data);
      } catch (error) {
        console.error(`Extra stats unavailable for ${league} game ${games[index].id}`, error);
        games[index].details = [...(games[index].details || []).slice(0, 2), "DETAILS UNAVAILABLE"];
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, games.length) }, () => enrichLiveGames()));
  return games;
}

const cachedScores = (league: League) =>
  cached(`scores:${league}`, { ttlMs: 15000, staleMs: 300000 }, () => loadScores(league));
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" };

export async function GET(request: NextRequest) {
  const multi = request.nextUrl.searchParams.get("leagues");
  if (multi !== null) {
    const leagues = [...new Set(multi.split(",").filter(Boolean))];
    if (!leagues.length || leagues.length > 8 || !leagues.every((league) => Object.hasOwn(LEAGUES, league))) {
      return NextResponse.json({ error: "Invalid leagues" }, { status: 400 });
    }
    const settled = await Promise.allSettled(leagues.map((league) => cachedScores(league as League)));
    const results: Record<string, { league: string; games: Game[] } | { error: string }> = {};
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") results[leagues[index]] = { league: leagues[index], games: result.value };
      else {
        console.error(`Scores unavailable for ${leagues[index]}`, result.reason);
        results[leagues[index]] = { error: "Scores unavailable" };
      }
    });
    const allOk = settled.every((result) => result.status === "fulfilled");
    return NextResponse.json({ leagues: results }, { headers: allOk ? CACHE_HEADERS : undefined });
  }
  const league = request.nextUrl.searchParams.get("league") || "mlb";
  if (!Object.hasOwn(LEAGUES, league)) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
  try {
    const games = await cachedScores(league as League);
    return NextResponse.json({ league, games }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error(`Scores unavailable for ${league}`, error);
    return NextResponse.json({ error: "Scores unavailable", games: [] }, { status: 503 });
  }
}
