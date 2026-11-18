"use client";
import { memo, type CSSProperties } from "react";
import { Flap } from "./Flap";
import { boardCells, MAX_COLUMNS } from "../lib/boardLayout";
import { revealDelay, type Reveal } from "../lib/drawing";
function BoardComponent({
  lines,
  columns = MAX_COLUMNS,
  speed,
  onFlip,
  reducedMotion,
  sectionStarts = [],
  emphasizeClock = false,
  pixels,
  description,
  reveal = "sweep",
  artSource,
}: {
  lines: string[];
  columns?: number;
  speed: number;
  onFlip: () => void;
  reducedMotion: boolean;
  sectionStarts?: number[];
  emphasizeClock?: boolean;
  pixels?: boolean[][];
  description?: string;
  reveal?: Reveal;
  artSource?: string[];
}) {
  const rows = lines.map((_, index) => `minmax(0, ${emphasizeClock && index === 0 ? 1.35 : 1}fr)`).join(" ");
  const style: CSSProperties & { "--board-columns": number; "--flap-font": string; "--clock-font": string } = {
    "--board-columns": columns,
    "--flap-font": `${(2.8 * MAX_COLUMNS) / columns}cqw`,
    "--clock-font": `${(3.35 * MAX_COLUMNS) / columns}cqw`,
  };
  return (
    <div className="board" role="img" aria-label={description || lines.filter(Boolean).join(" | ")} style={style}>
      <div className="board-inner" aria-hidden="true" style={{ gridTemplateRows: rows }}>
        {lines.map((line, r) => {
          const cells = boardCells(line, columns);
          return (
            <div
              key={r}
              className={`flap-row${r > 0 && sectionStarts.includes(r) ? " section-start" : ""}${emphasizeClock && r === 0 ? " clock-row" : ""}`}
            >
              {Array.from({ length: columns }, (_, c) => (
                <Flap
                  key={`${r}-${c}`}
                  char={pixels?.[r]?.[c] ? "#" : cells[c] || " "}
                  speed={speed}
                  onFlip={onFlip}
                  reducedMotion={reducedMotion}
                  // Each column starts a beat after the one to its left, so a change ripples across the row.
                  delay={artSource ? revealDelay(reveal, r, c, artSource) : c * 40}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((line, index) => line === b[index]);
const samePixels = (a?: boolean[][], b?: boolean[][]) =>
  a === b ||
  (!!a &&
    !!b &&
    a.length === b.length &&
    a.every((row, r) => row.length === b[r].length && row.every((v, c) => v === b[r][c])));
// `lines` is rebuilt on every render of the page, so compare it by content or the memo never hits.
export const Board = memo(
  BoardComponent,
  (a, b) =>
    sameLines(a.lines, b.lines) &&
    sameLines((a.sectionStarts ?? []).map(String), (b.sectionStarts ?? []).map(String)) &&
    samePixels(a.pixels, b.pixels) &&
    sameLines(a.artSource ?? [], b.artSource ?? []) &&
    a.description === b.description &&
    a.reveal === b.reveal &&
    a.columns === b.columns &&
    a.speed === b.speed &&
    a.onFlip === b.onFlip &&
    a.reducedMotion === b.reducedMotion &&
    a.emphasizeClock === b.emphasizeClock,
);
