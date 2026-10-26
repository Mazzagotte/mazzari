import type { Game } from "./display";

export type Weather = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isWeather(value: unknown): value is Weather {
  if (!isRecord(value) || !isRecord(value.current) || !isRecord(value.daily)) return false;
  const current = value.current,
    daily = value.daily;
  return (
    ["temperature_2m", "apparent_temperature", "relative_humidity_2m", "weather_code", "wind_speed_10m"].every(
      (key) => typeof current[key] === "number" && Number.isFinite(current[key]),
    ) &&
    ["temperature_2m_max", "temperature_2m_min", "precipitation_probability_max"].every((key) => {
      const values = daily[key];
      return (
        Array.isArray(values) &&
        values.length > 0 &&
        values.every((item) => typeof item === "number" && Number.isFinite(item))
      );
    })
  );
}

export function isGameFeed(value: unknown): value is { games: Game[] } {
  return (
    isRecord(value) &&
    Array.isArray(value.games) &&
    value.games.every(
      (game) =>
        isRecord(game) &&
        typeof game.id === "string" &&
        typeof game.status === "string" &&
        typeof game.state === "string" &&
        ["pre", "in", "post"].includes(game.state) &&
        (game.startTimeTbd === undefined || typeof game.startTimeTbd === "boolean") &&
        (game.details === undefined ||
          (Array.isArray(game.details) && game.details.every((detail) => typeof detail === "string"))) &&
        (game.essentialDetails === undefined ||
          (Array.isArray(game.essentialDetails) &&
            game.essentialDetails.every((detail) => typeof detail === "string"))) &&
        (game.priorityDetail === undefined ||
          (typeof game.priorityDetail === "string" && game.priorityDetail.length <= 24)) &&
        (game.date === undefined || (typeof game.date === "string" && Number.isFinite(Date.parse(game.date)))) &&
        Array.isArray(game.teams) &&
        game.teams.every(
          (team) =>
            isRecord(team) &&
            typeof team.abbr === "string" &&
            typeof team.score === "string" &&
            typeof team.homeAway === "string",
        ),
    )
  );
}
