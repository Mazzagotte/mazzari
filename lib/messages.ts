export type PersonalMessage = {
  id: string;
  text: string;
  enabled: boolean;
  scheduled: boolean;
  start: string;
  end: string;
  expires: string;
};
export const MESSAGE_ROWS = 4;
export const MESSAGE_LIMIT = 240;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function messageLines(text: string): string[] {
  const clean = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^ A-Z0-9:.\-/+!?%°\n]/g, " ");
  const result: string[] = [];
  for (const paragraph of clean.split("\n")) {
    let line = "";
    for (let word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > 24) {
        result.push(line);
        line = "";
      }
      while (word.length > 24) {
        result.push(word.slice(0, 24));
        word = word.slice(24);
      }
      if (word) line = line ? `${line} ${word}` : word;
    }
    result.push(line);
  }
  return result;
}

export function messagePages(text: string): string[][] {
  const lines = messageLines(text);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += MESSAGE_ROWS) pages.push(lines.slice(i, i + MESSAGE_ROWS));
  return pages;
}

export function validExpiration(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isPersonalMessage(value: unknown): value is PersonalMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    m.id.length > 0 &&
    typeof m.text === "string" &&
    m.text.length <= MESSAGE_LIMIT &&
    typeof m.enabled === "boolean" &&
    typeof m.scheduled === "boolean" &&
    typeof m.start === "string" &&
    timePattern.test(m.start) &&
    typeof m.end === "string" &&
    timePattern.test(m.end) &&
    typeof m.expires === "string" &&
    validExpiration(m.expires)
  );
}

export function activeMessages(messages: PersonalMessage[], now: Date, zone: string): PersonalMessage[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  return messages.filter(
    (m) =>
      m.enabled &&
      messageLines(m.text).some((line) => line.trim()) &&
      (!m.expires || date <= m.expires) &&
      (!m.scheduled ||
        m.start === m.end ||
        (m.start < m.end ? time >= m.start && time < m.end : time >= m.start || time < m.end)),
  );
}

export function rotatingMessage(messages: PersonalMessage[], tick: number): string[] | null {
  const cards = messages.flatMap((message) => messagePages(message.text));
  return cards.length ? cards[tick % cards.length] : null;
}
