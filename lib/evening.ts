import { isQuietTime } from "./display.ts";

export function eveningActive(enabled: boolean, now: Date, zone: string, start: string, end: string): boolean {
  if (!enabled) return false;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return isQuietTime(time, start, end);
}
