import type { Settings } from "./config.ts";

export function returnDeadline(choice: "30m" | "2h" | "morning", now: Date, zone: string): number {
  if (choice !== "morning") return now.getTime() + (choice === "30m" ? 30 : 120) * 60000;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = (date: Date) =>
    Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const today = parts(now);
  const nextDate = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + 1));
  const target = nextDate.toISOString().slice(0, 10);
  // Search the next local date rather than adding 24h across a daylight-saving change.
  for (let time = nextDate.getTime() - 14 * 3600000; time <= nextDate.getTime() + 36 * 3600000; time += 60000) {
    const local = parts(new Date(time));
    if (`${local.year}-${local.month}-${local.day}` === target && local.hour === "07" && local.minute === "00")
      return time;
  }
  throw new Error("Could not determine tomorrow morning in the selected timezone.");
}

export function applyMessageReturn(settings: Settings, now: number): Settings {
  return (settings.displayMode === "messages" || settings.displayMode === "drawing") &&
    settings.returnToDailyAt > 0 &&
    now >= settings.returnToDailyAt
    ? { ...settings, displayMode: "daily", returnToDailyAt: 0 }
    : settings;
}
