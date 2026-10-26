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
  assert.ok(layout.lines.includes("MLB"));
  assert.ok(layout.lines.some((line) => line.startsWith("71°F")));
  assert.ok(layout.lines.some((line) => line.startsWith("HIGH 80°F LOW 55°F")));
  assert.ok(layout.lines.includes("SCORES OFFLINE"));
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
