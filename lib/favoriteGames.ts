import { isLeague, type League } from "./config.ts";
import { favoriteTeams, type Game } from "./display.ts";
import { isGameFeed } from "./feeds.ts";
import { normalizeGame } from "./scores.ts";

export type RetainedFinal = { game: Game; observedAt: number };
export type FinalCache = Partial<Record<League, RetainedFinal[]>>;
const WEEK = 7 * 86400000;
const matches = (game: Game, team: string) => game.teams.some((item) => item.abbr.toUpperCase() === team);

export function scheduleFallbacks(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("season" in value) || !value.season || typeof value.season !== "object")
    throw new Error("Invalid schedule season");
  const season = value.season;
  if (
    !("year" in season) ||
    typeof season.year !== "number" ||
    !Number.isInteger(season.year) ||
    season.year < 2000 ||
    season.year > 2200 ||
    !("type" in season) ||
    typeof season.type !== "number" ||
    ![1, 2, 3].includes(season.type)
  )
    throw new Error("Invalid schedule season");
  const { year, type: currentType } = season;
  return [
    ...[1, 2, 3].filter((type) => type > currentType).map((type) => `season=${year}&seasontype=${type}`),
    `season=${year + 1}&seasontype=1`,
    `season=${year + 1}&seasontype=2`,
  ];
}

export function scheduleGames(value: unknown, league: League, team: string, now: number): Game[] {
  if (!value || typeof value !== "object" || !("events" in value) || !Array.isArray(value.events))
    throw new Error("Invalid team schedule");
  const games = value.events.map((event) => normalizeGame(event, league));
  if (!isGameFeed({ games }) || games.some((game) => !game.id || game.teams.length < 2 || !matches(game, team)))
    throw new Error("Invalid games in team schedule");
  return games
    .filter((game) => game.state === "pre" && game.date && Date.parse(game.date) >= now)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!))
    .slice(0, 1);
}

export function restoreFinalCache(value: unknown, now: number): FinalCache {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved final scores");
  const result: FinalCache = {};
  for (const [league, entries] of Object.entries(value)) {
    if (!isLeague(league) || !Array.isArray(entries) || entries.length > 512)
      throw new Error("Invalid saved final scores");
    result[league] = entries
      .map((entry: unknown) => {
        if (
          !entry ||
          typeof entry !== "object" ||
          !("game" in entry) ||
          !("observedAt" in entry) ||
          typeof entry.observedAt !== "number" ||
          !Number.isSafeInteger(entry.observedAt) ||
          entry.observedAt < 0 ||
          entry.observedAt > now + 60000
        )
          throw new Error("Invalid saved final score");
        const feed = { games: [entry.game] };
        if (!isGameFeed(feed)) throw new Error("Invalid saved final score");
        const game = feed.games[0];
        if (game.state !== "post") throw new Error("Invalid saved final score");
        return { game, observedAt: entry.observedAt };
      })
      .filter((entry) => now - entry.observedAt < WEEK);
  }
  return result;
}

export function rememberFinals(
  previous: RetainedFinal[],
  games: Game[],
  favorites: string,
  now: number,
): RetainedFinal[] {
  const teams = favoriteTeams(favorites),
    entries = new Map(previous.filter((entry) => now - entry.observedAt < WEEK).map((entry) => [entry.game.id, entry]));
  for (const game of games) {
    if (game.state === "post" && teams.some((team) => matches(game, team))) {
      const old = entries.get(game.id);
      entries.set(game.id, { game, observedAt: old?.observedAt ?? now });
    } else if (game.state !== "post") entries.delete(game.id);
  }
  return [...entries.values()].sort((a, b) => b.observedAt - a.observedAt).slice(0, 512);
}

export function favoriteAwareGames(
  current: Game[],
  scheduled: Game[],
  finals: RetainedFinal[],
  favorites: string,
  hours: number,
  now: number,
): Game[] {
  const teams = favoriteTeams(favorites),
    retained = new Map(
      finals.filter((entry) => now - entry.observedAt < hours * 3600000).map((entry) => [entry.game.id, entry.game]),
    );
  const favorite = (game: Game) => teams.some((team) => matches(game, team));
  const all = new Map(
    current
      .filter((game) => game.state !== "post" || !favorite(game) || retained.has(game.id))
      .map((game) => [game.id, game]),
  );
  for (const game of retained.values()) if (favorite(game) && !all.has(game.id)) all.set(game.id, game);
  const visible = [...all.values()];
  for (const team of teams) {
    if (visible.some((game) => matches(game, team))) continue;
    const next = scheduled
      .filter((game) => matches(game, team) && game.state === "pre" && game.date && Date.parse(game.date) >= now)
      .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!))[0];
    if (next && !all.has(next.id)) all.set(next.id, next);
  }
  return [...all.values()];
}
