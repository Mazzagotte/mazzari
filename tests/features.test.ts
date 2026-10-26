import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, restoreSettings } from "../lib/config.ts";
import { exportSettings, importSettings } from "../lib/settingsBackup.ts";
import { returnDeadline, applyMessageReturn } from "../lib/messageReturn.ts";
import {
  favoriteAwareGames,
  rememberFinals,
  restoreFinalCache,
  scheduleFallbacks,
  scheduleGames,
} from "../lib/favoriteGames.ts";
import { favoriteTeams, gamePages, orderGames, type Game } from "../lib/display.ts";
import { parseTeams } from "../lib/espnTeams.ts";
import {
  drawingLayout,
  heartDrawing,
  isDrawing,
  DRAWING_COLUMNS,
  DRAWING_ROWS,
  DRAWING_TEMPLATES,
  outlinePixels,
  occasionLines,
  revealDelay,
} from "../lib/drawing.ts";
import { activeSurprise, rotatingCard, scheduleInstant, scheduleInput, type GestureCard } from "../lib/gestureCards.ts";
import { boardCells } from "../lib/boardLayout.ts";

const now = Date.parse("2026-10-20T18:00:00Z");
const game = (id: string, state: string, team = "NYY", date = "2026-10-20T17:00:00Z"): Game => ({
  id,
  state,
  date,
  status: state === "post" ? "Final" : "Scheduled",
  teams: [
    { abbr: team, score: "4", homeAway: "away" },
    { abbr: "SEA", score: "2", homeAway: "home" },
  ],
});

test("saved cards migrate old settings and round-trip signatures, styles, reveals, dates and schedules", () => {
  const drawing = {
    ...heartDrawing(),
    signature: "JAMES",
    style: "outline",
    reveal: "center",
    occasion: { kind: "countdown", date: "2026-12-25", label: "OUR TRIP" },
  };
  const settings = restoreSettings({
    drawing,
    cards: [{ id: "one", name: "Trip", drawing, enabled: true, schedule: { at: now, minutes: 15 } }],
    playCards: true,
  });
  assert.deepEqual(importSettings(exportSettings(settings)), settings);
  assert.deepEqual(restoreSettings({}).cards, []);
  assert.equal(restoreSettings({}).playCards, false);
  assert.notEqual(settings.cards[0].drawing.pixels, settings.drawing.pixels);
  assert.notEqual(settings.cards[0].drawing.occasion, settings.drawing.occasion);
  const card = settings.cards[0];
  for (const cards of [
    null,
    [{ ...card, name: " " }],
    [{ ...card, enabled: "yes" }],
    [card, card],
    Array.from({ length: 21 }, (_, i) => ({ ...card, id: String(i) })),
    [{ ...card, schedule: { at: now, minutes: 0 } }],
    [{ ...card, schedule: { at: now, minutes: 1441 } }],
    [{ ...card, schedule: { at: now, minutes: 1.5 } }],
    [{ ...card, schedule: { at: 8640000000000000, minutes: 1 } }],
    [{ ...card, schedule: { at: "tomorrow", minutes: 1 } }],
  ]) {
    assert.throws(() => restoreSettings({ cards }));
  }
  for (const patch of [
    { signature: "A".repeat(25) },
    { style: "red" },
    { reveal: "flash" },
    { occasion: { kind: "countdown", date: "2026-02-30", label: "TRIP" } },
    { occasion: { kind: "bad", date: "2026-12-25", label: "TRIP" } },
  ]) {
    assert.throws(() => restoreSettings({ drawing: { ...drawing, ...patch } }));
  }
});

test("outline rendering preserves source artwork, including thin and edge-touching shapes", () => {
  const pixels = ["111", "111", "111"];
  assert.deepEqual(outlinePixels(pixels), ["111", "101", "111"]);
  assert.deepEqual(pixels, ["111", "111", "111"]);
  assert.deepEqual(outlinePixels(["010", "010", "010"]), ["010", "010", "010"]);
  const solid = heartDrawing(),
    outline = { ...solid, style: "outline" as const, signature: "JAMES" };
  const rendered = drawingLayout(outline);
  assert.ok(rendered.pixels.flat().filter(Boolean).length < drawingLayout(solid).pixels.flat().filter(Boolean).length);
  assert.deepEqual(outline.pixels, solid.pixels);
  assert.equal(rendered.lines.at(-1)?.trim(), "- JAMES");
  assert.ok(rendered.lines.every((line) => boardCells(line, 32).length <= 32));
});

test("meaningful dates follow local calendar days across timezones, DST and anniversary boundaries", () => {
  const countdown = { kind: "countdown" as const, date: "2026-03-09", label: "OUR TRIP" };
  assert.deepEqual(occasionLines(countdown, new Date("2026-03-08T06:00:00Z"), "America/Boise"), [
    "2 DAYS UNTIL",
    "OUR TRIP",
  ]);
  assert.deepEqual(occasionLines(countdown, new Date("2026-03-09T18:00:00Z"), "America/Boise"), [
    "TODAY IS THE DAY",
    "OUR TRIP",
  ]);
  assert.deepEqual(occasionLines(countdown, new Date("2026-03-10T18:00:00Z"), "America/Boise"), [
    "1 DAY SINCE",
    "OUR TRIP",
  ]);
  const anniversary = { kind: "anniversary" as const, date: "2023-10-21", label: "" };
  assert.deepEqual(occasionLines(anniversary, new Date("2026-10-21T01:00:00Z"), "America/Boise"), ["2 YEARS TOGETHER"]);
  assert.deepEqual(occasionLines(anniversary, new Date("2026-10-21T01:00:00Z"), "Asia/Tokyo"), ["3 YEARS TOGETHER"]);
  assert.deepEqual(occasionLines({ ...anniversary, date: "2024-02-29" }, new Date("2025-02-28T12:00:00Z"), "UTC"), [
    "0 YEARS TOGETHER",
  ]);
  assert.deepEqual(occasionLines({ ...anniversary, date: "2024-02-29" }, new Date("2025-03-01T12:00:00Z"), "UTC"), [
    "1 YEAR TOGETHER",
  ]);
  assert.deepEqual(occasionLines({ ...anniversary, date: "2027-10-21" }, new Date("2027-10-20T12:00:00Z"), "UTC"), [
    "1 DAY UNTIL",
  ]);
});

test("one-time surprises have inclusive starts, exclusive ends, deterministic overlaps and no replay", () => {
  const card = (id: string, at: number, minutes = 15): GestureCard => ({
    id,
    name: id,
    enabled: false,
    drawing: heartDrawing(),
    schedule: { at, minutes },
  });
  const first = card("first", now),
    later = card("later", now + 60000, 1);
  assert.equal(activeSurprise([first], now - 1), undefined);
  assert.equal(activeSurprise([first], now), first);
  assert.equal(activeSurprise([first], now + 900000), undefined);
  assert.equal(activeSurprise([first, later], now + 60000), later);
  assert.equal(activeSurprise([first, later], now + 120000), first);
  assert.equal(activeSurprise([first, later], now + 900000), undefined);
  assert.equal(activeSurprise([card("b", now), card("a", now)], now)?.id, "a");
  const restored = importSettings(exportSettings(restoreSettings({ cards: [first], displayMode: "clock" })));
  assert.equal(activeSurprise(restored.cards, now + 60000)?.id, "first");
  assert.equal(restored.displayMode, "clock");
  assert.equal(activeSurprise(restored.cards, now + 900000), undefined);
  assert.equal(activeSurprise([{ ...first, schedule: null }], now), undefined);
  assert.equal(rotatingCard([first], 0), undefined);
  const selected = [
    { ...first, enabled: true },
    { ...later, enabled: true },
  ];
  assert.equal(rotatingCard(selected, 0)?.id, "first");
  assert.equal(rotatingCard(selected, 1)?.id, "first");
  assert.equal(rotatingCard(selected, 2)?.id, "later");
  assert.equal(rotatingCard(selected, 4)?.id, "first");
});

test("surprise time input resolves city wall time and rejects nonexistent DST times", () => {
  assert.equal(scheduleInstant("2026-10-21T07:00", "America/Boise"), Date.parse("2026-10-21T13:00:00Z"));
  assert.equal(scheduleInput(Date.parse("2026-10-21T13:00:00Z"), "America/Boise"), "2026-10-21T07:00");
  assert.equal(scheduleInstant("2026-11-01T01:30", "America/Boise"), Date.parse("2026-11-01T07:30:00Z"));
  for (const input of ["", "2026-02-30T07:00", "2026-03-08T02:30", "2026-10-21T25:00"]) {
    assert.throws(() => scheduleInstant(input, "America/Boise"));
  }
});

test("reveals are brief, directional and put outlines before filled interiors", () => {
  const pixels = Array(20).fill("1".repeat(32));
  assert.equal(revealDelay("sweep", 0, 0, pixels), 0);
  assert.equal(revealDelay("sweep", 0, 31, pixels), 744);
  assert.ok(revealDelay("center", 10, 16, pixels) < revealDelay("center", 0, 0, pixels));
  assert.ok(revealDelay("outline", 0, 10, pixels) < revealDelay("outline", 10, 10, pixels));
  for (const reveal of ["sweep", "center", "outline"] as const) {
    for (let r = 0; r < 26; r++) for (let c = 0; c < 32; c++) assert.ok(revealDelay(reveal, r, c, pixels) < 2000);
  }
});

test("drawing defaults migrate old preferences and validate saved artwork", () => {
  const drawing = heartDrawing();
  assert.ok(isDrawing(drawing));
  assert.equal(drawing.pixels.length, DRAWING_ROWS);
  assert.ok(drawing.pixels.every((row) => row.length === DRAWING_COLUMNS));
  assert.deepEqual(restoreSettings({}).drawing, drawing);
  assert.notEqual(restoreSettings({}).drawing.pixels, DEFAULTS.drawing.pixels);
  const settings = restoreSettings({ drawing, displayMode: "drawing" });
  assert.deepEqual(importSettings(exportSettings(settings)), settings);
  const legacy = JSON.parse(exportSettings(DEFAULTS));
  delete legacy.settings.drawing;
  assert.deepEqual(importSettings(JSON.stringify(legacy)).drawing, drawing);
  for (const invalid of [
    null,
    {},
    { ...drawing, pixels: [] },
    { ...drawing, pixels: ["1".repeat(16)] },
    { ...drawing, pixels: Array(10).fill("x".repeat(16)) },
    { ...drawing, caption: "A".repeat(25) },
    { ...drawing, caption: 3 },
  ]) {
    assert.equal(isDrawing(invalid), false);
    assert.throws(() => restoreSettings({ drawing: invalid }));
  }
});

test("drawing layout preserves blank rows, columns and centered captions without cropping art", () => {
  const heart = heartDrawing();
  const layout = drawingLayout(heart);
  assert.equal(layout.columns, 32);
  assert.equal(layout.lines.length, 20);
  assert.ok(layout.lines.every((row) => row === " ".repeat(32)));
  assert.ok(layout.pixels.every((row) => row.length === 32));
  assert.equal(layout.pixels.flat().filter(Boolean).length, heart.pixels.join("").replaceAll("0", "").length);
  const captioned = drawingLayout({ ...heart, caption: "LOVE YOU" });
  assert.equal(captioned.lines.length, 22);
  assert.equal(captioned.lines[21], "            LOVE YOU");
  const wide = drawingLayout({ ...heart, caption: "A".repeat(24) });
  assert.equal(wide.columns, 32);
  assert.deepEqual(boardCells(wide.lines[21], 32), [...("    " + "A".repeat(24))]);
  assert.deepEqual(wide.pixels, layout.pixels);
  assert.equal(wide.pixels.flat().filter(Boolean).length, layout.pixels.flat().filter(Boolean).length);
  assert.deepEqual(boardCells(drawingLayout({ ...heart, caption: "72°F" }).lines[21], 32).slice(-3), ["7", "2", "°F"]);
  const empty = drawingLayout({ ...heart, pixels: Array(20).fill("0".repeat(32)) });
  assert.equal(empty.lines.length, 20);
  assert.equal(empty.pixels.flat().some(Boolean), false);
});

test("heart template has symmetric rounded lobes and a centered narrow tip", () => {
  const { pixels } = heartDrawing();
  assert.ok(pixels.every((row) => row === [...row].reverse().join("")));
  const filled = pixels.filter((row) => row.includes("1"));
  assert.equal(filled.at(-1)?.replaceAll("0", "").length, 2);
  assert.ok(filled.some((row) => /1+0+1+/.test(row)));
  assert.ok(Math.max(...filled.map((row) => row.replaceAll("0", "").length)) >= 24);
});

test("legacy 16 by 10 drawings migrate without losing pixels, caption, or timer", () => {
  const pixels = Array.from({ length: 10 }, (_, r) =>
    Array.from({ length: 16 }, (_, c) => ((r + c) % 3 === 0 ? "1" : "0")).join(""),
  );
  const drawing = { pixels, caption: "MY OLD DRAWING" };
  assert.ok(isDrawing(drawing));
  const backup = JSON.stringify({
    app: "mazzari",
    version: 1,
    settings: { ...DEFAULTS, drawing, displayMode: "drawing", returnToDailyAt: now + 1800000 },
  });
  const settings = importSettings(backup);
  assert.equal(settings.drawing.pixels.length, 20);
  assert.equal(settings.drawing.caption, drawing.caption);
  assert.equal(settings.returnToDailyAt, now + 1800000);
  for (let r = 0; r < 20; r++)
    for (let c = 0; c < 32; c++) {
      assert.equal(settings.drawing.pixels[r][c], pixels[Math.floor(r / 2)][Math.floor(c / 2)]);
    }
  assert.deepEqual(importSettings(exportSettings(settings)), settings);
  for (const invalid of [
    Array(20).fill("0".repeat(16)),
    Array(10).fill("0".repeat(32)),
    Array(19).fill("0".repeat(32)),
  ]) {
    assert.throws(() => restoreSettings({ drawing: { pixels: invalid, caption: "" } }));
  }
});

test("drawing templates are distinct editable grids that preserve captions and round-trip in backups", () => {
  assert.deepEqual(
    DRAWING_TEMPLATES.map((template) => template.id),
    [
      "heart",
      "smiley",
      "star",
      "flower",
      "butterfly",
      "coffee",
      "letter",
      "cat",
      "sun",
      "moon",
      "house",
      "tree",
      "rainbow",
      "music",
      "gift",
      "sailboat",
    ],
  );
  assert.equal(new Set(DRAWING_TEMPLATES.map((template) => template.pixels.join(""))).size, DRAWING_TEMPLATES.length);
  for (const template of DRAWING_TEMPLATES) {
    const drawing = { pixels: [...template.pixels], caption: "THINKING OF YOU" };
    assert.ok(isDrawing(drawing), template.label);
    assert.ok(drawing.pixels.join("").includes("1"), template.label);
    const settings = restoreSettings({ drawing, displayMode: "drawing" });
    assert.deepEqual(importSettings(exportSettings(settings)).drawing, drawing);
    drawing.pixels[0] = (drawing.pixels[0][0] === "1" ? "0" : "1") + drawing.pixels[0].slice(1);
    assert.notEqual(drawing.pixels[0], template.pixels[0]);
    assert.equal(drawing.caption, "THINKING OF YOU");
  }
  assert.deepEqual(DRAWING_TEMPLATES[0].pixels, heartDrawing().pixels);
});

test("drawing timed return survives backups and preserves the artwork at the deadline", () => {
  const settings = restoreSettings({
    displayMode: "drawing",
    drawing: { ...heartDrawing(), caption: "LOVE YOU" },
    returnToDailyAt: now,
  });
  const restored = importSettings(exportSettings(settings));
  assert.equal(applyMessageReturn(restored, now - 1), restored);
  const returned = applyMessageReturn(restored, now);
  assert.equal(returned.displayMode, "daily");
  assert.equal(returned.returnToDailyAt, 0);
  assert.deepEqual(returned.drawing, settings.drawing);
  assert.equal(applyMessageReturn({ ...restored, returnToDailyAt: 0 }, now).displayMode, "drawing");
});

test("backup round-trips every preference, message, timer, and per-league favorite", () => {
  const settings = restoreSettings({
    ...DEFAULTS,
    city: "New York",
    timezone: "America/New_York",
    leagues: ["mlb", "nfl"],
    favoritesByLeague: { ...DEFAULTS.favoritesByLeague, nfl: "DAL" },
    returnToDailyAt: now + 3600000,
    displayMode: "messages",
    finalScoreHours: 48,
    messages: [
      { id: "one", text: "WELCOME HOME", enabled: true, scheduled: false, start: "07:00", end: "10:00", expires: "" },
    ],
  });
  const text = exportSettings(settings, new Date(now));
  assert.deepEqual(importSettings(text), settings);
  assert.equal(JSON.parse(text).version, 1);
  for (const invalid of [
    "invalid",
    "{}",
    "[]",
    JSON.stringify({ app: "not-mazzari", version: 1, settings }),
    JSON.stringify({ app: "mazzari", version: 2, settings }),
    JSON.stringify({ app: "mazzari", version: 1, settings: { ...settings, lat: 91 } }),
  ]) {
    assert.throws(() => importSettings(invalid));
  }
});

test("message return uses exact durations, inclusive expiry and leaves messages untouched", () => {
  assert.equal(returnDeadline("30m", new Date(now), "UTC"), now + 1800000);
  assert.equal(returnDeadline("2h", new Date(now), "UTC"), now + 7200000);
  const settings = restoreSettings({ displayMode: "messages", returnToDailyAt: now });
  assert.equal(applyMessageReturn(settings, now - 1), settings);
  assert.equal(applyMessageReturn(settings, now).displayMode, "daily");
  assert.equal(applyMessageReturn(settings, now).returnToDailyAt, 0);
  assert.equal(applyMessageReturn(settings, now).messages, settings.messages);
  assert.equal(applyMessageReturn({ ...settings, displayMode: "clock" }, now).displayMode, "clock");
  assert.equal(applyMessageReturn({ ...settings, returnToDailyAt: 0 }, now).displayMode, "messages");
});

test("tomorrow morning follows city calendar dates across midnight, DST and year boundaries", () => {
  for (const [instant, zone, expected] of [
    ["2026-10-20T18:00:00Z", "America/Boise", "2026-10-21T13:00:00Z"],
    ["2026-03-07T20:00:00Z", "America/Boise", "2026-03-08T13:00:00Z"],
    ["2026-10-31T20:00:00Z", "America/Boise", "2026-11-01T14:00:00Z"],
    ["2026-12-31T23:00:00Z", "Asia/Tokyo", "2027-01-01T22:00:00Z"],
    ["2026-10-20T18:00:00Z", "Pacific/Kiritimati", "2026-10-21T17:00:00Z"],
  ])
    assert.equal(returnDeadline("morning", new Date(instant), zone), Date.parse(expected));
});

test("new settings migrate safely and reject invalid timer or retention values", () => {
  assert.equal(restoreSettings({}).returnToDailyAt, 0);
  assert.equal(restoreSettings({}).finalScoreHours, 24);
  for (const value of [-1, NaN, Infinity, 1.5, "tomorrow", 8640000000000001])
    assert.throws(() => restoreSettings({ returnToDailyAt: value }));
  for (const value of [-1, 1, 25, Infinity, "24"]) assert.throws(() => restoreSettings({ finalScoreHours: value }));
});

test("team directory resolves IDs rather than ESPN's ambiguous abbreviation aliases", () => {
  assert.deepEqual(
    parseTeams({
      sports: [{ leagues: [{ teams: [{ team: { id: "68", abbreviation: "BOIS", displayName: "Boise State" } }] }] }],
    }),
    [{ id: "68", abbr: "BOIS", name: "Boise State" }],
  );
  assert.throws(() => parseTeams({ sports: [] }));
  assert.throws(() => parseTeams({ sports: [{ leagues: [{ teams: [{ team: { abbreviation: "BOIS" } }] }] }] }));
});

test("team schedule normalization handles nested scores and finds the next future matchup", () => {
  const event = (id: string, date: string, state = "pre") => ({
    id,
    date,
    competitions: [
      {
        status: { type: { state, shortDetail: state === "post" ? "Final" : "Scheduled" } },
        competitors: [
          { team: { abbreviation: "NYY" }, score: { value: 0, displayValue: "0" }, homeAway: "away" },
          { team: { abbreviation: "SEA" }, score: { value: 2, displayValue: "2" }, homeAway: "home" },
        ],
      },
    ],
  });
  const games = scheduleGames(
    {
      events: [
        event("old", "2026-10-19T17:00:00Z", "post"),
        event("later", "2026-10-24T17:00:00Z"),
        event("next", "2026-10-21T17:00:00Z"),
      ],
    },
    "mlb",
    "NYY",
    now,
  );
  assert.deepEqual(
    games.map((game) => game.id),
    ["next"],
  );
  assert.equal(games[0].teams[1].score, "2");
  assert.deepEqual(scheduleGames({ events: [] }, "mlb", "NYY", now), []);
  assert.throws(() => scheduleGames({}, "mlb", "NYY", now));
  assert.throws(() => scheduleGames({ events: [event("wrong", "2026-10-21T17:00:00Z")] }, "mlb", "DAL", now));
  assert.ok(gamePages(games[0], "America/Boise").status.join(" ").includes("OCT 21"));
});

test("off-season fallback checks remaining season phases and next-season preseason/regular games", () => {
  assert.deepEqual(scheduleFallbacks({ season: { year: 2026, type: 2 } }), [
    "season=2026&seasontype=3",
    "season=2027&seasontype=1",
    "season=2027&seasontype=2",
  ]);
  assert.deepEqual(scheduleFallbacks({ season: { year: 2026, type: 3 } }), [
    "season=2027&seasontype=1",
    "season=2027&seasontype=2",
  ]);
  assert.throws(() => scheduleFallbacks({}));
  assert.throws(() => scheduleFallbacks({ season: { year: "2026", type: 3 } }));
});

test("unannounced start times stay TBD without inventing midnight or shifting the calendar day", () => {
  const scheduled = game("tbd", "pre", "NYY", "2027-02-19T05:00:00Z");
  const entry = gamePages({ ...scheduled, startTimeTbd: true }, "America/Boise");
  assert.deepEqual(entry.status, ["NEXT FEB 19 TIME TBD"]);
  const status = entry.status.join(" ");
  assert.ok(status.includes("FEB 19"));
  assert.ok(status.includes("TIME TBD"));
  assert.ok(!status.includes("PM") && !status.includes("AM"));
});

test("upcoming game date and complete local start time fit together on one rotation page", () => {
  const scheduled = game("start", "pre", "NYY", "2026-10-24T00:00:00Z");
  assert.deepEqual(gamePages(scheduled, "America/Boise").status, ["NEXT OCT 23 6:00 PM"]);
  for (const timezone of ["America/Boise", "America/New_York", "Europe/London", "Asia/Kolkata", "Pacific/Auckland"]) {
    for (const date of ["2026-09-30T00:59:00Z", "2026-12-31T12:59:00Z", "2027-01-01T07:05:00Z"]) {
      const entry = gamePages({ ...scheduled, date }, timezone);
      assert.equal(entry.status.length, 1);
      assert.ok(entry.status[0].length <= 24);
      assert.match(entry.status[0], /^NEXT [A-Z]{3} \d{1,2} \d{1,2}:\d{2} [AP]M$/);
    }
  }
});

test("favorite fallback is per-team, deduplicated, local-date aware and never overrides live matchups", () => {
  const upcoming = game("next", "pre", "NYY", "2026-10-24T17:00:00Z"),
    dal = game("dal", "pre", "DAL", "2026-10-25T17:00:00Z");
  assert.deepEqual(favoriteTeams(" nyy ,NYY, dal "), ["NYY", "DAL"]);
  const merged = favoriteAwareGames([game("live", "in")], [upcoming, dal], [], "NYY,DAL", 24, now);
  assert.deepEqual(
    orderGames(merged, "NYY,DAL", true).map((game) => game.id),
    ["live", "dal"],
  );
  assert.deepEqual(
    favoriteAwareGames([], [upcoming, upcoming], [], "NYY,SEA", 24, now).map((game) => game.id),
    ["next"],
  );
  assert.equal(favoriteAwareGames([], [game("past", "pre")], [], "NYY", 24, now).length, 0);
  assert.deepEqual(
    favoriteAwareGames([game("other", "in", "BOS")], [upcoming], [], "", 24, now).map((game) => game.id),
    ["other"],
  );
});

test("finals survive reloads, do not restart on polls, expire exactly and reveal the next game", () => {
  const final = game("final", "post"),
    next = game("next", "pre", "NYY", "2026-10-24T17:00:00Z");
  const saved = rememberFinals([], [final], "NYY", now);
  const restored = restoreFinalCache(JSON.parse(JSON.stringify({ mlb: saved })), now).mlb!;
  const repolled = rememberFinals(restored, [final], "NYY", now + 10000);
  assert.equal(repolled[0].observedAt, now);
  assert.deepEqual(
    favoriteAwareGames([], [next], repolled, "NYY", 24, now + 86400000 - 1).map((game) => game.id),
    ["final"],
  );
  assert.deepEqual(
    favoriteAwareGames([final], [next], repolled, "NYY", 24, now + 86400000).map((game) => game.id),
    ["next"],
  );
  assert.equal(favoriteAwareGames([final], [], repolled, "NYY", 0, now).length, 0);
  assert.equal(favoriteAwareGames([], [], repolled, "DAL", 24, now).length, 0);
  assert.equal(rememberFinals(repolled, [game("final", "in")], "NYY", now).length, 0);
  assert.throws(() => restoreFinalCache({ mlb: [{ game: final, observedAt: "invalid" }] }, now));
  assert.throws(() => restoreFinalCache({ mlb: [{ game: final, observedAt: now + 86400000 }] }, now));
});
