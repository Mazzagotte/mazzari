import { NextRequest, NextResponse } from "next/server";
import { LEAGUES, isLeague, type League } from "../../../lib/config";
import { favoriteTeams, type Game } from "../../../lib/display";
import { fetchTeams } from "../../../lib/espnTeams";
import { scheduleFallbacks, scheduleGames } from "../../../lib/favoriteGames";
import { cached } from "../../../lib/serverCache";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get("league"),
    raw = request.nextUrl.searchParams.get("teams") || "";
  if (!isLeague(league)) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
  const favorites = favoriteTeams(raw);
  if (raw.length > 1000 || favorites.length > 32 || favorites.some((team) => !/^[A-Z0-9.-]{1,12}$/.test(team))) {
    return NextResponse.json({ error: "Use up to 32 valid team abbreviations." }, { status: 400 });
  }
  if (!favorites.length) return NextResponse.json({ games: [], errors: [] });
  try {
    const result = await cached(
      `favorites:${league}:${favorites.join(",")}`,
      { ttlMs: 120000, staleMs: 1800000, cacheable: (value) => !value.errors.length },
      () => loadFavorites(league, favorites),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error(`Favorite schedules unavailable for ${league}`, error);
    return NextResponse.json({ error: "Favorite schedules unavailable" }, { status: 503 });
  }
}

async function loadFavorites(league: League, favorites: string[]): Promise<{ games: Game[]; errors: string[] }> {
  const budget = AbortSignal.timeout(12000);
  // Resolve exact abbreviations to IDs: ESPN's abbreviation URLs can point to a different college team.
  const directory = await fetchTeams(league, budget);
  const { sport, code } = LEAGUES[league],
    games: Game[] = [],
    failed = new Set<string>();
  const tasks: { abbr: string; url: string; expand: boolean }[] = [];
  for (const abbr of favorites) {
    const matches = directory.filter((team) => team.abbr.toUpperCase() === abbr);
    if (matches.length !== 1) {
      console.error(`Unknown or ambiguous favorite for ${league}: ${abbr}`);
      failed.add(abbr);
      continue;
    }
    tasks.push({
      abbr,
      url: `https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/teams/${encodeURIComponent(matches[0].id)}/schedule`,
      expand: true,
    });
  }
  let cursor = 0;
  const loadTeam = async () => {
    while (cursor < tasks.length) {
      const { abbr, url, expand } = tasks[cursor++];
      try {
        const response = await fetch(url, {
          next: { revalidate: 300 },
          signal: AbortSignal.any([budget, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error(`Schedule HTTP ${response.status}`);
        const data: unknown = await response.json(),
          nextGames = scheduleGames(data, league, abbr, Date.now());
        games.push(...nextGames);
        if (expand && !nextGames.length) {
          tasks.push(...scheduleFallbacks(data).map((query) => ({ abbr, url: `${url}?${query}`, expand: false })));
        }
      } catch (error) {
        console.error(`Favorite schedule unavailable for ${league} ${abbr}`, error);
        failed.add(abbr);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, favorites.length) }, loadTeam));
  const nextGames = favorites.flatMap((abbr) =>
    games
      .filter((game) => game.teams.some((team) => team.abbr.toUpperCase() === abbr))
      .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!))
      .slice(0, 1),
  );
  if (failed.size === favorites.length) throw new Error("All favorite schedules failed");
  return {
    games: [...new Map(nextGames.map((game) => [game.id, game])).values()],
    errors: [...failed].map((abbr) => `${abbr}: schedule unavailable`),
  };
}
