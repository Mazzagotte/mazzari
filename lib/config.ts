import { isPersonalMessage, type PersonalMessage } from "./messages.ts";
export type League = "nfl" | "nba" | "mlb" | "nhl" | "ncaaf" | "ncaab";
export type Settings = {
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  unit: "fahrenheit" | "celsius";
  time24: boolean;
  sound: boolean;
  volume: number;
  speed: number;
  leagues: League[];
  favoritesByLeague: Record<League, string>;
  favoritesOnly: boolean;
  essentialDetails: boolean;
  showWeather: boolean;
  showForecast: boolean;
  showSeconds: boolean;
  reducedMotion: boolean;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  displayMode: "daily" | "messages" | "clock";
  messages: PersonalMessage[];
  eveningDimming: boolean;
  eveningStart: string;
  eveningEnd: string;
  eveningBrightness: number;
  keepAwake: boolean;
  returnToDailyAt: number;
  finalScoreHours: number;
};
export const DEFAULTS: Settings = {
  city: "Boise, Idaho",
  lat: 43.615,
  lon: -116.2023,
  timezone: "America/Boise",
  unit: "fahrenheit",
  time24: false,
  sound: false,
  volume: 0.25,
  speed: 85,
  leagues: ["mlb"],
  favoritesByLeague: { nfl: "", nba: "", mlb: "NYY", nhl: "", ncaaf: "", ncaab: "" },
  favoritesOnly: false,
  essentialDetails: true,
  showWeather: true,
  showForecast: true,
  showSeconds: false,
  reducedMotion: false,
  quietHours: false,
  quietStart: "22:00",
  quietEnd: "07:00",
  displayMode: "daily",
  messages: [],
  eveningDimming: false,
  eveningStart: "21:00",
  eveningEnd: "07:00",
  eveningBrightness: 0.45,
  keepAwake: false,
  returnToDailyAt: 0,
  finalScoreHours: 24,
};
export const LEAGUES: Record<League, { sport: string; code: string; name: string }> = {
  nfl: { sport: "football", code: "nfl", name: "NFL" },
  nba: { sport: "basketball", code: "nba", name: "NBA" },
  mlb: { sport: "baseball", code: "mlb", name: "MLB" },
  nhl: { sport: "hockey", code: "nhl", name: "NHL" },
  ncaaf: { sport: "football", code: "college-football", name: "College Football (CFB)" },
  ncaab: { sport: "basketball", code: "mens-college-basketball", name: "College Basketball" },
};
export const LEAGUE_IDS: League[] = ["mlb", "nfl", "ncaaf", "nba", "nhl", "ncaab"];
export function isLeague(value: unknown): value is League {
  return typeof value === "string" && Object.hasOwn(LEAGUES, value);
}
export function leagueLabel(league: League): string {
  return league === "ncaaf" ? "CFB" : league.toUpperCase();
}
export function restoreSettings(value: unknown): Settings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved settings");
  const saved: Record<string, unknown> = { ...value };
  const result = { ...DEFAULTS, leagues: [...DEFAULTS.leagues], favoritesByLeague: { ...DEFAULTS.favoritesByLeague } };
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (key === "leagues" || key === "favoritesByLeague" || key === "messages") continue;
    if (!(key in saved)) continue;
    const candidate = saved[key];
    if (typeof candidate !== typeof DEFAULTS[key]) throw new Error(`Invalid setting: ${key}`);
    Object.assign(result, { [key]: candidate });
  }
  if ("league" in saved && !isLeague(saved.league)) throw new Error("Invalid legacy league");
  if ("leagues" in saved) {
    if (!Array.isArray(saved.leagues) || !saved.leagues.every(isLeague)) throw new Error("Invalid league selection");
    result.leagues = Array.from(new Set(saved.leagues));
  } else {
    if ("showSports" in saved && typeof saved.showSports !== "boolean") throw new Error("Invalid sports visibility");
    result.leagues = saved.showSports === false ? [] : isLeague(saved.league) ? [saved.league] : result.leagues;
  }
  if ("favorites" in saved) {
    if (typeof saved.favorites !== "string") throw new Error("Invalid legacy favorites");
    result.favoritesByLeague[isLeague(saved.league) ? saved.league : "mlb"] = saved.favorites;
  }
  if ("favoritesByLeague" in saved) {
    if (
      !saved.favoritesByLeague ||
      typeof saved.favoritesByLeague !== "object" ||
      Array.isArray(saved.favoritesByLeague)
    )
      throw new Error("Invalid team preferences");
    for (const [league, favorites] of Object.entries(saved.favoritesByLeague)) {
      if (!isLeague(league) || typeof favorites !== "string") throw new Error("Invalid team preferences");
      result.favoritesByLeague[league] = favorites;
    }
  }
  if ("messages" in saved) {
    if (
      !Array.isArray(saved.messages) ||
      saved.messages.length > 20 ||
      !saved.messages.every(isPersonalMessage) ||
      new Set(saved.messages.map((message) => message.id)).size !== saved.messages.length
    )
      throw new Error("Invalid personal messages");
    result.messages = saved.messages.map((message) => ({ ...message }));
  }
  if (
    !["daily", "messages", "clock"].includes(result.displayMode) ||
    !["fahrenheit", "celsius"].includes(result.unit) ||
    !Number.isFinite(result.lat) ||
    result.lat < -90 ||
    result.lat > 90 ||
    !Number.isFinite(result.lon) ||
    result.lon < -180 ||
    result.lon > 180 ||
    !Number.isFinite(result.volume) ||
    result.volume < 0 ||
    result.volume > 1 ||
    !Number.isFinite(result.speed) ||
    result.speed < 40 ||
    result.speed > 180 ||
    !Number.isSafeInteger(result.returnToDailyAt) ||
    result.returnToDailyAt < 0 ||
    result.returnToDailyAt > 8640000000000000 ||
    ![0, 6, 12, 24, 48].includes(result.finalScoreHours) ||
    !Number.isFinite(result.eveningBrightness) ||
    result.eveningBrightness < 0.2 ||
    result.eveningBrightness > 0.8 ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.eveningStart) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.eveningEnd) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.quietStart) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.quietEnd)
  )
    throw new Error("Saved settings are outside the allowed range");
  new Intl.DateTimeFormat("en-US", { timeZone: result.timezone }).format();
  return result;
}
export const SYMBOLS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/+!?%°";
export function weatherDescription(code: number) {
  if (code === 0) return "CLEAR";
  if (code <= 3) return "PARTLY CLOUDY";
  if (code <= 48) return "FOGGY";
  if (code <= 57) return "DRIZZLE";
  if (code <= 67) return "RAIN";
  if (code <= 77) return "SNOW";
  if (code <= 82) return "SHOWERS";
  if (code <= 86) return "SNOW SHOWERS";
  if (code <= 99) return "THUNDERSTORM";
  return "UNAVAILABLE";
}
