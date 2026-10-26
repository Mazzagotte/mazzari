import { leagueLabel, weatherDescription, type League, type Settings } from "./config.ts";
import { feedStatus, favoriteTeams, gamePages, orderGames, pages, selectGamePage, type Game } from "./display.ts";
import { favoriteAwareGames, type FinalCache } from "./favoriteGames.ts";
import { boardLayout } from "./boardLayout.ts";
import { messagePages } from "./messages.ts";
import { safeTime } from "./clock.ts";
import type { Weather } from "./feeds.ts";
import { emptyFeed, type Feed, type ScheduleFeeds } from "./feedState.ts";

export function buildSportsSections(
  settings: Settings,
  sports: Partial<Record<League, Feed<Game[]>>>,
  schedules: ScheduleFeeds,
  finals: FinalCache,
  nowMs: number,
) {
  return settings.leagues.map((league) => {
    const feed = sports[league] || emptyFeed<Game[]>();
    const favorites = settings.favoritesByLeague[league];
    const key = favoriteTeams(favorites).sort().join(",");
    const schedule = schedules[league]?.key === key ? schedules[league]!.feed : emptyFeed<Game[]>();
    const games = orderGames(
      favoriteAwareGames(
        feed.data || [],
        schedule.data || [],
        finals[league] || [],
        favorites,
        settings.finalScoreHours,
        nowMs,
      ),
      favorites,
      settings.favoritesOnly,
    );
    return {
      league,
      feed,
      games,
      schedule,
      hasFavorites: !!key,
      entries: games.map((game) => gamePages(game, settings.timezone, settings.essentialDetails)),
    };
  });
}
export type SportsSection = ReturnType<typeof buildSportsSections>[number];

type BoardInput = {
  settings: Settings;
  now: Date | null;
  tick: number;
  weather: Feed<Weather>;
  weatherState: string;
  sportsSections: SportsSection[];
  sportsStates: string[];
  message: string[] | null | undefined;
  messages: { text: string }[];
};

// Builds the visible board lines for the current rotation tick, plus the lines used to size the grid.
export function composeBoard({
  settings,
  now,
  tick,
  weather,
  weatherState,
  sportsSections,
  sportsStates,
  message,
  messages,
}: BoardInput) {
  const current = now || new Date(0);
  const rotate = (text: string) => {
    const parts = pages(text);
    return parts[tick % parts.length];
  };
  const sectionStarts: number[] = [];
  const lines = [
    now
      ? safeTime(current, settings.timezone, {
          hour: "2-digit",
          minute: "2-digit",
          ...(settings.showSeconds ? { second: "2-digit" } : {}),
          hour12: !settings.time24,
        }).toUpperCase()
      : "STARTING CLOCK",
    now ? safeTime(current, settings.timezone, { weekday: "short", month: "short", day: "numeric" }).toUpperCase() : "",
  ];
  const clockLines = [...lines];
  const rotationLines = [...clockLines];
  const w = weather.data?.current;
  const d = weather.data?.daily;
  const unit = settings.unit === "fahrenheit" ? "F" : "C";
  if (settings.showWeather || settings.showForecast) sectionStarts.push(lines.length);
  if (settings.showWeather) {
    if (w)
      rotationLines.push(
        ...pages(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`),
        `WIND ${Math.round(w.wind_speed_10m)} MPH`,
        `FEELS ${Math.round(w.apparent_temperature)}${unit} HUM ${Math.round(w.relative_humidity_2m)}%`,
      );
    lines.push(
      w
        ? rotate(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`)
        : `WEATHER ${weatherState}`,
      w
        ? tick % 2
          ? `WIND ${Math.round(w.wind_speed_10m)} MPH`
          : `FEELS ${Math.round(w.apparent_temperature)}${unit} HUM ${Math.round(w.relative_humidity_2m)}%`
        : "",
    );
  }
  if (settings.showForecast) {
    lines.push(
      d
        ? `HIGH ${Math.round(d.temperature_2m_max[0])}${unit} LOW ${Math.round(d.temperature_2m_min[0])}${unit}`
        : `FORECAST ${weatherState}`,
      d ? `RAIN ${Math.round(d.precipitation_probability_max[0])}%` : "",
    );
    rotationLines.push(...lines.slice(-2));
  }
  sportsSections.forEach(({ league, feed, entries, schedule, hasFavorites }, index) => {
    const selection = selectGamePage(entries, tick);
    sectionStarts.push(lines.length);
    lines.push(leagueLabel(league));
    if (selection) {
      rotationLines.push(leagueLabel(league), ...entries.flatMap((entry) => [...entry.matchup, ...entry.status]));
      const entry = entries[selection.index];
      lines.push(
        entry.matchup[selection.page % entry.matchup.length],
        entry.status[selection.page % entry.status.length],
      );
    } else {
      const scheduleState = feedStatus(hasFavorites, schedule.failed, schedule.updated, current.getTime(), 900000);
      lines.push(
        settings.favoritesOnly && hasFavorites && !schedule.data
          ? `SCHEDULE ${scheduleState}`
          : feed.data
            ? settings.favoritesOnly
              ? "NO FAVORITE GAMES"
              : "NO GAMES"
            : `SCORES ${sportsStates[index]}`,
        "",
      );
    }
  });
  if (settings.displayMode === "daily" && message) {
    sectionStarts.push(lines.length);
    lines.push(...message);
  } else if (settings.displayMode === "messages" && message) lines.splice(0, lines.length, ...message);
  else if (settings.displayMode !== "daily") lines.splice(2);
  const messageLines = messages.flatMap((item) => messagePages(item.text).flat());
  const sizingLines =
    settings.displayMode === "daily"
      ? [...rotationLines, ...messageLines]
      : settings.displayMode === "messages" && message
        ? messageLines
        : clockLines;
  const layout = boardLayout(lines, sizingLines, settings.displayMode === "daily" ? sectionStarts : []);
  const clockVisible = settings.displayMode !== "messages" || !message;
  const rowCount = layout.lines.length;
  const aspectRatio = (1.75 * 12 * (layout.columns / 24)) / (rowCount + (clockVisible ? 0.35 : 0));
  return { layout, clockVisible, aspectRatio };
}
