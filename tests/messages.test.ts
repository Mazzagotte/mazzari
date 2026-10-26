import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeMessages,
  isPersonalMessage,
  messageLines,
  messagePages,
  rotatingMessage,
  validExpiration,
  type PersonalMessage,
} from "../lib/messages.ts";
import { restoreSettings } from "../lib/config.ts";
import { eveningActive } from "../lib/evening.ts";

const message: PersonalMessage = {
  id: "1",
  text: "Good morning James",
  enabled: true,
  scheduled: true,
  start: "07:00",
  end: "10:00",
  expires: "",
};

test("daily windows use the selected timezone and exclude end boundary", () => {
  const items = [message];
  assert.equal(activeMessages(items, new Date("2026-10-20T13:00:00Z"), "America/Boise").length, 1);
  assert.equal(activeMessages(items, new Date("2026-10-20T16:00:00Z"), "America/Boise").length, 0);
  assert.equal(activeMessages(items, new Date("2026-10-20T13:00:00Z"), "Asia/Tokyo").length, 0);
});
test("overnight and equal-time windows work including DST repeats", () => {
  const overnight = { ...message, start: "22:00", end: "07:00" };
  for (const time of ["2026-10-20T23:00:00Z", "2026-10-21T06:59:00Z"]) {
    assert.equal(activeMessages([overnight], new Date(time), "UTC").length, 1);
  }
  assert.equal(activeMessages([overnight], new Date("2026-10-21T07:00:00Z"), "UTC").length, 0);
  assert.equal(activeMessages([{ ...message, start: "07:00", end: "07:00" }], new Date(), "UTC").length, 1);
  for (const time of ["2026-11-01T07:30:00Z", "2026-11-01T08:30:00Z"]) {
    assert.equal(
      activeMessages([{ ...message, start: "01:00", end: "02:00" }], new Date(time), "America/Boise").length,
      1,
    );
  }
});
test("expiration lasts through selected local date; disabled and empty text stay hidden", () => {
  const expiring = { ...message, scheduled: false, expires: "2026-10-20" };
  assert.equal(activeMessages([expiring], new Date("2026-10-21T05:59:00Z"), "America/Boise").length, 1);
  assert.equal(activeMessages([expiring], new Date("2026-10-21T06:00:00Z"), "America/Boise").length, 0);
  assert.equal(
    activeMessages(
      [
        { ...expiring, enabled: false },
        { ...expiring, text: "  \n " },
        { ...expiring, text: "💛" },
      ],
      new Date("2026-10-20T12:00:00Z"),
      "UTC",
    ).length,
    0,
  );
});
test("preview wraps and paginates without silently clipping long text", () => {
  const text = "WELCOME TO THE MAZZAGOTTE HOUSE\n" + "A".repeat(70);
  const lines = messageLines(text);
  assert.ok(lines.every((line) => line.length <= 24));
  assert.equal(lines.join("").replaceAll(" ", ""), text.replaceAll(" ", "").replaceAll("\n", ""));
  assert.ok(messagePages(text).every((page) => page.length <= 4));
  assert.deepEqual(messageLines("Caffè & friends"), ["CAFFE AND FRIENDS"]);
  const items = [
    { ...message, text: "FIRST" },
    { ...message, id: "2", text: "SECOND" },
  ];
  assert.deepEqual(rotatingMessage(items, 0), ["FIRST"]);
  assert.deepEqual(rotatingMessage(items, 1), ["SECOND"]);
  assert.deepEqual(rotatingMessage(items, 2), ["FIRST"]);
  assert.equal(rotatingMessage([], 0), null);
});
test("new preferences migrate and malformed saved messages are rejected", () => {
  assert.deepEqual(restoreSettings({}).messages, []);
  assert.equal(restoreSettings({}).displayMode, "daily");
  assert.equal(restoreSettings({ messages: [message], displayMode: "messages" }).messages[0].text, message.text);
  assert.equal(isPersonalMessage({ ...message, start: "25:00" }), false);
  assert.equal(validExpiration("2026-02-30"), false);
  assert.equal(validExpiration("2028-02-29"), true);
  assert.throws(() => restoreSettings({ messages: [message, message] }));
  assert.throws(() => restoreSettings({ messages: [{ ...message, text: "A".repeat(241) }] }));
  assert.throws(() => restoreSettings({ displayMode: "invalid" }));
});

test("evening dimming respects city timezone, overnight boundaries and all-day schedules", () => {
  const at = (time: string, zone = "America/Boise") => eveningActive(true, new Date(time), zone, "21:00", "07:00");
  assert.equal(at("2026-10-21T03:00:00Z"), true);
  assert.equal(at("2026-10-21T12:59:00Z"), true);
  assert.equal(at("2026-10-21T13:00:00Z"), false);
  assert.equal(at("2026-10-21T03:00:00Z", "Asia/Tokyo"), false);
  assert.equal(eveningActive(false, new Date(), "UTC", "00:00", "00:00"), false);
  assert.equal(eveningActive(true, new Date(), "UTC", "00:00", "00:00"), true);
  assert.equal(eveningActive(true, new Date("2026-11-01T08:30:00Z"), "America/Boise", "01:00", "02:00"), true);
});
test("display comfort preferences preserve old settings and validate saved values", () => {
  const old = restoreSettings({ favoritesByLeague: { nfl: "DAL" } });
  assert.equal(old.keepAwake, false);
  assert.equal(old.eveningDimming, false);
  assert.equal(old.eveningBrightness, 0.45);
  assert.equal(old.favoritesByLeague.nfl, "DAL");
  assert.equal(restoreSettings({ keepAwake: true, eveningDimming: true }).keepAwake, true);
  for (const invalid of [
    { eveningBrightness: 0.1 },
    { eveningBrightness: NaN },
    { eveningStart: "25:00" },
    { eveningEnd: "invalid" },
    { keepAwake: "yes" },
  ]) {
    assert.throws(() => restoreSettings(invalid));
  }
});
