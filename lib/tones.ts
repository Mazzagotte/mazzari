import { boardCells } from "./boardLayout.ts";

/** A colored flap, like the status cards on a real departure board. */
export type Tone = "live" | "alert";
/** Which kind of row a line is, so only status rows can ever be colored (never personal messages). */
export type ToneKind = "sports-status" | "forecast";

// Rain chance at or above this percentage turns its number red.
export const RAIN_ALERT = 60;
const INTERRUPTED = /\b(?:RAIN DELAY|DELAYED|DELAY|POSTPONED|SUSPENDED|CANCELED|CANCELLED|ABANDONED|FORFEIT)\b/g;

/** Per-cell tones for one board line; cells without a tone stay plain. */
export function lineTones(line: string, kind: ToneKind): (Tone | undefined)[] {
  // One character per cell, so regex positions line up with flap positions even when a cell holds "°F".
  const cells = boardCells(line, Number.MAX_SAFE_INTEGER);
  const text = cells.map((cell) => cell[0]).join("");
  const tones: (Tone | undefined)[] = cells.map(() => undefined);
  const paint = (start: number, length: number, tone: Tone) => {
    for (let index = start; index < start + length; index++) tones[index] = tone;
  };
  if (kind === "sports-status") {
    if (text.startsWith("LIVE")) paint(0, 4, "live");
    for (const match of text.matchAll(INTERRUPTED)) paint(match.index, match[0].length, "alert");
  } else {
    const rain = /\bRAIN (\d{1,3})%/.exec(text);
    if (rain && Number(rain[1]) >= RAIN_ALERT) paint(rain.index + 5, rain[1].length + 1, "alert");
  }
  return tones;
}
