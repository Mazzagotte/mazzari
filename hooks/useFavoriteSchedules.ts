import { useEffect, useState } from "react";
import type { League, Settings } from "../lib/config";
import { favoriteTeams, type Game } from "../lib/display";
import { isGameFeed } from "../lib/feeds";
import { emptyFeed, type ScheduleFeeds } from "../lib/feedState.ts";
import { onResume } from "./feed";

// Fetches each favorite team's next scheduled game every five minutes and on resume.
export function useFavoriteSchedules(ready: boolean, settings: Settings, refreshId: number) {
  const [schedules, setSchedules] = useState<ScheduleFeeds>({});
  const scheduleKey = JSON.stringify(
    settings.leagues
      .map((league) => ({ league, teams: favoriteTeams(settings.favoritesByLeague[league]).sort().join(",") }))
      .filter((item) => item.teams),
  );

  useEffect(() => {
    if (!ready || settings.displayMode !== "daily") return;
    const selected: { league: League; teams: string }[] = JSON.parse(scheduleKey);
    const controller = new AbortController();
    let loading = false;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      await Promise.all(
        selected.map(async ({ league, teams }) => {
          try {
            const response = await fetch(`/api/favorites?league=${league}&teams=${encodeURIComponent(teams)}`, {
              cache: "no-store",
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
            });
            if (!response.ok) throw new Error(`Favorite schedules HTTP ${response.status}`);
            const data: unknown = await response.json();
            if (!isGameFeed(data) || !("errors" in data) || !Array.isArray(data.errors) || data.errors.length)
              throw new Error("Favorite schedules are incomplete or invalid");
            if (!controller.signal.aborted)
              setSchedules((previous) => ({
                ...previous,
                [league]: { key: teams, feed: { data: data.games, updated: Date.now(), failed: false } },
              }));
          } catch (error) {
            if (controller.signal.aborted) return;
            console.error(`Could not update ${league} favorite schedules`, error);
            setSchedules((previous) => ({
              ...previous,
              [league]: {
                key: teams,
                feed: {
                  ...(previous[league]?.key === teams ? previous[league]!.feed : emptyFeed<Game[]>()),
                  failed: true,
                },
              },
            }));
          }
        }),
      );
      loading = false;
    };
    void load();
    const timer = setInterval(() => void load(), 300000);
    const stopResume = onResume(() => void load());
    return () => {
      controller.abort();
      clearInterval(timer);
      stopResume();
    };
  }, [ready, scheduleKey, settings.displayMode, refreshId]);

  return schedules;
}
