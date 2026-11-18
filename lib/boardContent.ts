import { leagueLabel, weatherDescription, type League, type Settings } from "./config.ts";
import { feedStatus, favoriteTeams, gamePages, orderGames, pages, selectGamePage, type Game } from "./display.ts";
import { favoriteAwareGames, type FinalCache } from "./favoriteGames.ts";
import { boardLayout, MAX_COLUMNS } from "./boardLayout.ts";
import { messagePages } from "./messages.ts";
import { safeTime } from "./clock.ts";
import { lineTones, type ToneKind } from "./tones.ts";
import type { Weather } from "./feeds.ts";
import { emptyFeed, type Feed, type ScheduleFeeds } from "./feedState.ts";

export function buildSportsSections(
  settings: Settings,
  sports: Partial<Record<League, Feed<Game[]>>>,
  schedules: ScheduleFeeds,
  finals: FinalCache,
  nowMs: number,
  width = MAX_COLUMNS,
) {
  // On a narrow board the league keeps a row of its own; there's height to spare but not width.
  const tagged = width >= MAX_COLUMNS;
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
      entries: games.map((game) => {
        const pagesForGame = gamePages(game, settings.timezone, settings.essentialDetails, width);
        // The league rides on the matchup line ("MLB TOR AT NYY") instead of taking a row of its own.
        return tagged
          ? { ...pagesForGame, matchup: pages(`${leagueLabel(league)} ${pagesForGame.matchup.join(" ")}`, width) }
          : pagesForGame;
      }),
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
  /** Board width in columns: 24, or fewer on a portrait phone. */
  width?: number;
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
  width = MAX_COLUMNS,
}: BoardInput) {
  const current = now || new Date(0);
  const rotate = (text: string) => {
    const parts = pages(text, width);
    return parts[tick % parts.length];
  };
  const sectionStarts: number[] = [];
  // Rows that may carry status colors, by index in `lines`. Messages and drawings never do.
  const toneKinds = new Map<number, ToneKind>();
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
  // A bare degree sign: the unit is set in Settings, and "°F" squeezed into one flap reads poorly.
  const unit = "°";
  if (settings.showWeather || settings.showForecast) sectionStarts.push(lines.length);
  if (settings.showWeather) {
    const feels = `FEELS ${Math.round(w?.apparent_temperature ?? 0)}${unit}`,
      humidity = `HUM ${Math.round(w?.relative_humidity_2m ?? 0)}%`,
      feelsHumidity = `${feels} ${humidity}`;
    // Wind and feels-like alternate; feels-like and humidity split when they won't fit on one row.
    const details = w
      ? [
          `WIND ${Math.round(w.wind_speed_10m)} MPH`,
          ...(feelsHumidity.length > width ? [feels, humidity] : [feelsHumidity]),
        ]
      : [];
    if (w)
      rotationLines.push(
        ...pages(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`, width),
        ...details,
      );
    lines.push(
      w
        ? rotate(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`)
        : `WEATHER ${weatherState}`,
      w ? details[(tick + 1) % details.length] : "",
    );
  }
  if (settings.showForecast) {
    if (d) {
      // High, low and rain share one row; when that overflows the board's width, they alternate.
      const temps = `HI ${Math.round(d.temperature_2m_max[0])}${unit} LO ${Math.round(d.temperature_2m_min[0])}${unit}`;
      const rain = `RAIN ${Math.round(d.precipitation_probability_max[0])}%`;
      const parts = `${temps} ${rain}`.length > width ? [temps, rain] : [`${temps} ${rain}`];
      toneKinds.set(lines.length, "forecast");
      lines.push(parts[tick % parts.length]);
      rotationLines.push(...parts);
    } else {
      lines.push(`FORECAST ${weatherState}`);
      rotationLines.push(lines.at(-1)!);
    }
  }
  sportsSections.forEach(({ league, feed, entries, schedule, hasFavorites }, index) => {
    const selection = selectGamePage(entries, tick);
    // A league with nothing to show (off-season, off day) gives its rows back to the rest of the board.
    if (!selection && feed.data && !(settings.favoritesOnly && hasFavorites && !schedule.data)) return;
    sectionStarts.push(lines.length);
    if (selection) {
      rotationLines.push(...entries.flatMap((entry) => [...entry.matchup, ...entry.status]));
      const entry = entries[selection.index];
      if (width < MAX_COLUMNS) lines.push(leagueLabel(league));
      toneKinds.set(lines.length + 1, "sports-status");
      lines.push(
        entry.matchup[selection.page % entry.matchup.length],
        entry.status[selection.page % entry.status.length],
      );
    } else {
      const scheduleState = feedStatus(hasFavorites, schedule.failed, schedule.updated, current.getTime(), 900000);
      const state =
        settings.favoritesOnly && hasFavorites && !schedule.data
          ? `SCHEDULE ${scheduleState}`
          : `SCORES ${sportsStates[index]}`;
      if (width < MAX_COLUMNS) lines.push(leagueLabel(league), state);
      else lines.push(`${leagueLabel(league)} ${state}`);
    }
  });
  if (settings.displayMode === "daily" && message) {
    sectionStarts.push(lines.length);
    lines.push(...message);
  } else if (settings.displayMode === "messages" && message) {
    lines.splice(0, lines.length, ...message);
    toneKinds.clear();
  } else if (settings.displayMode !== "daily") lines.splice(2);
  const messageLines = messages.flatMap((item) => messagePages(item.text, width).flat());
  const sizingLines =
    settings.displayMode === "daily"
      ? [...rotationLines, ...messageLines]
      : settings.displayMode === "messages" && message
        ? messageLines
        : clockLines;
  const layout = boardLayout(lines, sizingLines, settings.displayMode === "daily" ? sectionStarts : [], width);
  const tones = layout.sources.map((source, row) => {
    const kind = toneKinds.get(source);
    return kind ? lineTones(layout.lines[row], kind) : undefined;
  });
  const clockVisible = settings.displayMode !== "messages" || !message;
  const rowCount = layout.lines.length;
  const aspectRatio = (1.75 * 12 * (layout.columns / 24)) / (rowCount + (clockVisible ? 0.35 : 0));
  return { layout, clockVisible, aspectRatio, tones };
}
