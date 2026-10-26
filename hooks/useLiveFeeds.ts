import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { League, Settings } from "../lib/config";
import type { Game } from "../lib/display";
import { isGameFeed, isWeather, type Weather } from "../lib/feeds";
import { emptyFeed, onResume, type Feed } from "./feed";
import { scoresDelay, WEATHER_INTERVAL_MS } from "../lib/pollSchedule";

type SportsFeeds = Partial<Record<League, Feed<Game[]>>>;

// Weather and scores poll on their own schedules (see lib/pollSchedule.ts) while the daily board is
// shown and the page is visible. Manual refresh, wake from sleep and resume refresh everything at once.
export function useLiveFeeds(
  ready: boolean,
  settings: Settings,
  refreshId: number,
  setNow: Dispatch<SetStateAction<Date | null>>,
) {
  const [weather, setWeather] = useState<Feed<Weather>>(emptyFeed);
  const [sports, setSports] = useState<SportsFeeds>({});
  const [refreshing, setRefreshing] = useState(false);
  const weatherKey = `${settings.lat}/${settings.lon}/${settings.unit}`;
  const previousWeatherKey = useRef(weatherKey);
  const sportsRef = useRef(sports);
  sportsRef.current = sports;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

  useEffect(() => {
    if (!ready) return;
    if (settings.displayMode !== "daily") {
      setRefreshing(false);
      return;
    }
    const controller = new AbortController();
    let loading = false;
    let lastWeather = 0;
    let lastScores = 0;
    if (previousWeatherKey.current !== weatherKey) {
      setWeather(emptyFeed());
      previousWeatherKey.current = weatherKey;
    }
    const wantsWeather = settings.showWeather || settings.showForecast;

    async function fetchFeed<T>(
      url: string,
      setter: Dispatch<SetStateAction<Feed<T>>>,
      extract: (value: unknown) => T,
    ) {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
        const data = extract(await response.json());
        if (!controller.signal.aborted) setter({ data, updated: Date.now(), failed: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(`Could not update ${url}`, error);
        setter((old) => ({ ...old, failed: true }));
      }
    }

    const loadWeather = () =>
      fetchFeed<Weather>(
        `/api/weather?lat=${settings.lat}&lon=${settings.lon}&unit=${settings.unit}`,
        setWeather,
        (value) => {
          if (!isWeather(value)) throw new Error("Invalid weather response");
          return value;
        },
      );
    const loadScores = async () => {
      const leagues = settings.leagues;
      try {
        const response = await fetch(`/api/scores?leagues=${leagues.join(",")}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
        const body: unknown = await response.json();
        const results = (body as { leagues?: Record<string, unknown> } | null)?.leagues;
        if (!results || typeof results !== "object") throw new Error("Invalid scores response");
        if (controller.signal.aborted) return;
        const updated = Date.now();
        setSports((previous) => {
          const next = { ...previous };
          for (const league of leagues) {
            const entry = results[league];
            next[league] = isGameFeed(entry)
              ? { data: entry.games, updated, failed: false }
              : { ...(previous[league] || emptyFeed<Game[]>()), failed: true };
          }
          return next;
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Could not update scores", error);
        setSports((previous) => {
          const next = { ...previous };
          for (const league of leagues) next[league] = { ...(previous[league] || emptyFeed<Game[]>()), failed: true };
          return next;
        });
      }
    };

    // Fetches only what is due. `force` ignores the schedule (manual refresh, resume, wake).
    const load = async (force: boolean) => {
      if (loading || controller.signal.aborted) return;
      const now = Date.now();
      const weatherFailed = weatherRef.current.failed || (!weatherRef.current.data && lastWeather > 0);
      const weatherDue = wantsWeather && (force || weatherFailed || now - lastWeather >= WEATHER_INTERVAL_MS - 1000);
      const scoresDue =
        settings.leagues.length > 0 &&
        (force || now - lastScores >= scoresDelay(settings.leagues, sportsRef.current, now) - 1000);
      if (!weatherDue && !scoresDue) return;
      loading = true;
      setRefreshing(true);
      const requests: Promise<void>[] = [];
      if (weatherDue) {
        lastWeather = now;
        requests.push(loadWeather());
      }
      if (scoresDue) {
        lastScores = now;
        requests.push(loadScores());
      }
      await Promise.all(requests);
      loading = false;
      if (!controller.signal.aborted) setRefreshing(false);
    };

    void load(true);
    // The tick is cheap: it only decides whether a fetch is due, and hidden tabs never fetch.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 15000);
    const stopResume = onResume(() => {
      setNow(new Date());
      void load(true);
    });
    return () => {
      controller.abort();
      clearInterval(interval);
      stopResume();
    };
  }, [
    ready,
    weatherKey,
    settings.lat,
    settings.lon,
    settings.unit,
    settings.leagues,
    settings.showWeather,
    settings.showForecast,
    settings.displayMode,
    refreshId,
    setNow,
  ]);

  return { weather, sports, refreshing };
}
