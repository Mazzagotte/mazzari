import { test } from "node:test";
import assert from "node:assert/strict";
import { cached } from "../lib/serverCache.ts";
import { DEFAULTS, restoreSettings } from "../lib/config.ts";
import { buildSportsSections, composeBoard } from "../lib/boardContent.ts";
import { emptyFeed } from "../lib/feedState.ts";
import type { Weather } from "../lib/feeds.ts";
import { scoresDelay } from "../lib/pollSchedule.ts";

test("scores poll slowly when idle and quickly when a game is live, soon or data is missing", () => {
  const now = Date.parse("2025-01-01T12:00:00Z");
  const feed = (games: object[]) => ({ data: games as never, updated: now, failed: false });
  assert.equal(scoresDelay(["mlb"], {}, now), 30_000);
  assert.equal(scoresDelay(["mlb"], { mlb: feed([]) }, now), 300_000);
  assert.equal(scoresDelay(["mlb"], { mlb: feed([{ state: "in" }]) }, now), 30_000);
  assert.equal(scoresDelay(["mlb"], { mlb: feed([{ state: "pre", date: "2025-01-01T12:10:00Z" }]) }, now), 30_000);
  assert.equal(scoresDelay(["mlb"], { mlb: feed([{ state: "pre", date: "2025-01-01T18:00:00Z" }]) }, now), 300_000);
  assert.equal(scoresDelay(["mlb"], { mlb: { ...feed([]), failed: true } }, now), 30_000);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("cache shares one in-flight load between concurrent callers", async () => {
  let calls = 0;
  const load = async () => {
    calls++;
    await sleep(10);
    return "value";
  };
  const results = await Promise.all([
    cached("dedupe", { ttlMs: 1000, staleMs: 1000 }, load),
    cached("dedupe", { ttlMs: 1000, staleMs: 1000 }, load),
  ]);
  assert.deepEqual(results, ["value", "value"]);
  assert.equal(calls, 1);
});

test("cache serves fresh values without reloading", async () => {
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cached("fresh", { ttlMs: 1000, staleMs: 1000 }, load), 1);
  assert.equal(await cached("fresh", { ttlMs: 1000, staleMs: 1000 }, load), 1);
});

test("cache serves stale data when a refresh fails, within the stale window only", async () => {
  await cached("stale", { ttlMs: 1, staleMs: 60, cacheable: () => true }, async () => "old");
  await sleep(5);
  const failing = async () => {
    throw new Error("upstream down");
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(await cached("stale", { ttlMs: 1, staleMs: 60 }, failing), "old");
    await sleep(80);
    await assert.rejects(cached("stale", { ttlMs: 1, staleMs: 60 }, failing), /upstream down/);
  } finally {
    console.error = originalError;
  }
});

test("cache skips values that are not cacheable", async () => {
  let calls = 0;
  const options = { ttlMs: 1000, staleMs: 1000, cacheable: () => false };
  await cached("skip", options, async () => ++calls);
  assert.equal(await cached("skip", options, async () => ++calls), 2);
});

const weather: Weather = {
  current: {
    temperature_2m: 71.4,
    apparent_temperature: 70,
    relative_humidity_2m: 40,
    weather_code: 0,
    wind_speed_10m: 5,
  },
  daily: { temperature_2m_max: [80], temperature_2m_min: [55], precipitation_probability_max: [10] },
};
const compose = (settings = DEFAULTS, withWeather = true) =>
  composeBoard({
    settings,
    now: new Date("2026-10-20T18:00:00Z"),
    tick: 0,
    weather: withWeather ? { data: weather, updated: 1, failed: false } : emptyFeed<Weather>(),
    weatherState: "OFFLINE",
    sportsSections: buildSportsSections(settings, {}, {}, {}, 0),
    sportsStates: settings.leagues.map(() => "OFFLINE"),
    message: null,
    messages: [],
  });

test("daily board shows clock, weather, forecast and an offline league", () => {
  const { layout } = compose();
  assert.ok(layout.lines[0].includes(":"));
  assert.ok(layout.lines.some((line) => line.startsWith("71° ")));
  assert.ok(layout.lines.includes("HI 80° LO 55° RAIN 10%"));
  assert.ok(layout.lines.includes("MLB SCORES OFFLINE"));
  assert.ok(!layout.lines.includes("MLB"));
});

test("forecast splits across rotations only when it would overflow the board", () => {
  const extreme = {
    ...weather,
    daily: { temperature_2m_max: [-10], temperature_2m_min: [-20], precipitation_probability_max: [100] },
  };
  const at = (tick: number) =>
    composeBoard({
      settings: DEFAULTS,
      now: new Date("2026-10-20T18:00:00Z"),
      tick,
      weather: { data: extreme, updated: 1, failed: false },
      weatherState: "LIVE",
      sportsSections: [],
      sportsStates: [],
      message: null,
      messages: [],
    }).layout.lines;
  assert.ok(at(0).includes("HI -10° LO -20°"));
  assert.ok(at(1).includes("RAIN 100%"));
  assert.ok(at(0).every((line) => line.length <= 24));
});

const game = (id: string, state: string, date: string, away = "TOR", home = "NYY") => ({
  id,
  date,
  state,
  status: state === "post" ? "FINAL" : "SCHEDULED",
  teams: [
    { abbr: away, score: "4", homeAway: "away" },
    { abbr: home, score: "1", homeAway: "home" },
  ],
});
const sportsBoard = (games: object[], favorites = "", schedule: object[] = []) => {
  const now = Date.parse("2026-11-18T17:00:00Z");
  const settings = {
    ...DEFAULTS,
    leagues: ["mlb" as const],
    favoritesByLeague: { ...DEFAULTS.favoritesByLeague, mlb: favorites },
  };
  const feed = { data: games as never, updated: now, failed: false };
  const schedules = favorites
    ? { mlb: { key: favorites, feed: { data: schedule as never, updated: now, failed: false } } }
    : {};
  return composeBoard({
    settings,
    now: new Date(now),
    tick: 0,
    weather: emptyFeed<Weather>(),
    weatherState: "OFF",
    sportsSections: buildSportsSections(settings, { mlb: feed }, schedules, {}, now),
    sportsStates: ["LIVE"],
    message: null,
    messages: [],
  }).layout.lines;
};

test("the league rides on the matchup line instead of its own row", () => {
  const lines = sportsBoard([game("1", "pre", "2026-11-18T23:00:00Z")]);
  assert.ok(lines.includes("MLB TOR AT NYY"));
  assert.ok(!lines.includes("MLB"));
});

test("off-season: weeks-old finals are dropped and the favorite's next game shows", () => {
  const worldSeries = game("ws", "post", "2026-11-01T00:00:00Z", "MIL", "TB");
  const opener = game("open", "pre", "2027-03-25T17:35:00Z");
  assert.ok(!sportsBoard([worldSeries]).some((line) => line.includes("MIL")));
  const lines = sportsBoard([worldSeries], "NYY", [opener]);
  assert.ok(lines.includes("MLB TOR AT NYY"));
  assert.ok(!lines.some((line) => line.includes("MIL")));
});

test("yesterday's finals of other teams still show", () => {
  const lines = sportsBoard([game("y", "post", "2026-11-18T01:00:00Z", "MIL", "TB")]);
  assert.ok(lines.includes("MLB MIL 4 - TB 1"));
});

test("a league with no games gives its rows back to the board", () => {
  const lines = sportsBoard([]);
  assert.ok(!lines.some((line) => line.startsWith("MLB") || line.includes("NO GAMES")));
});

test("weather without data falls back to its feed state", () => {
  const { layout } = compose(DEFAULTS, false);
  assert.ok(layout.lines.includes("WEATHER OFFLINE"));
  assert.ok(layout.lines.includes("FORECAST OFFLINE"));
});

test("clock-only mode keeps just the clock and date", () => {
  const { layout, clockVisible } = compose({ ...DEFAULTS, displayMode: "clock" });
  assert.equal(layout.lines.length, 2);
  assert.equal(clockVisible, true);
});

test("burn-in protection defaults off and validates as a boolean", () => {
  assert.equal(DEFAULTS.burnInProtection, false);
  assert.equal(restoreSettings({ burnInProtection: true }).burnInProtection, true);
  assert.throws(() => restoreSettings({ burnInProtection: "yes" }));
});
