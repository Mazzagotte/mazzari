import type { League } from "./config.ts";
import type { Feed } from "./feedState.ts";
import type { Game } from "./display.ts";

export const WEATHER_INTERVAL_MS = 10 * 60 * 1000;
const LIVE_SCORES_MS = 30 * 1000;
const IDLE_SCORES_MS = 5 * 60 * 1000;
const SOON_MS = 20 * 60 * 1000;

// Scores poll quickly only while a game is live or about to start. Otherwise a slow poll is enough
// to notice new games. Missing or failed feeds retry quickly.
export function scoresDelay(leagues: League[], feeds: Partial<Record<League, Feed<Game[]>>>, now: number): number {
  for (const league of leagues) {
    const feed = feeds[league];
    if (!feed || feed.failed || !feed.data) return LIVE_SCORES_MS;
    for (const game of feed.data) {
      if (game.state === "in") return LIVE_SCORES_MS;
      if (game.state === "pre" && game.date) {
        const start = Date.parse(game.date);
        if (Number.isFinite(start) && start - now <= SOON_MS) return LIVE_SCORES_MS;
      }
    }
  }
  return IDLE_SCORES_MS;
}
