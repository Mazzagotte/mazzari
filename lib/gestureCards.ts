import { isDrawing, localDate, upgradeDrawing, type Drawing } from "./drawing.ts";
import { validExpiration } from "./messages.ts";

export const CARD_LIMIT = 20;
export type GestureCard = {
  id: string;
  name: string;
  enabled: boolean;
  drawing: Drawing;
  schedule: { at: number; minutes: number } | null;
};

export function isGestureCard(value: unknown): value is GestureCard {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 100 &&
    "name" in value &&
    typeof value.name === "string" &&
    !!value.name.trim() &&
    value.name.length <= 40 &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    "drawing" in value &&
    isDrawing(value.drawing) &&
    "schedule" in value &&
    (value.schedule === null || isSchedule(value.schedule))
  );
}

function isSchedule(value: unknown): value is NonNullable<GestureCard["schedule"]> {
  return (
    !!value &&
    typeof value === "object" &&
    "at" in value &&
    typeof value.at === "number" &&
    Number.isSafeInteger(value.at) &&
    value.at > 0 &&
    "minutes" in value &&
    typeof value.minutes === "number" &&
    Number.isInteger(value.minutes) &&
    value.minutes >= 1 &&
    value.minutes <= 1440 &&
    value.at + value.minutes * 60000 <= 8640000000000000
  );
}

export function copyCard(card: GestureCard): GestureCard {
  return { ...card, drawing: upgradeDrawing(card.drawing), schedule: card.schedule ? { ...card.schedule } : null };
}

export function activeSurprise(cards: GestureCard[], now: number): GestureCard | undefined {
  return cards
    .filter(
      (card) => card.schedule && now >= card.schedule.at && now < card.schedule.at + card.schedule.minutes * 60000,
    )
    .sort((a, b) => b.schedule!.at - a.schedule!.at || a.id.localeCompare(b.id))[0];
}

export function rotatingCard(cards: GestureCard[], tick: number): GestureCard | undefined {
  const enabled = cards.filter((card) => card.enabled);
  return enabled.length ? enabled[Math.floor(tick / 2) % enabled.length] : undefined;
}

export function scheduleInput(at: number, zone: string): string {
  const date = new Date(at);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${localDate(date, zone)}T${time}`;
}

export function scheduleInstant(input: string, zone: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(input);
  if (!match || !validExpiration(match[1])) throw new Error("Choose a valid date and time.");
  const wall = Date.parse(`${input}:00Z`);
  // Resolve the city's wall clock, not the timezone of the device editing the card.
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let at = wall - 14 * 3600000; at <= wall + 14 * 3600000; at += 60000) {
    const date = new Date(at);
    if (localDate(date, zone) === match[1] && formatter.format(date) === `${match[2]}:${match[3]}`) return at;
  }
  throw new Error("That local time does not exist in your city's timezone. Choose another time.");
}
