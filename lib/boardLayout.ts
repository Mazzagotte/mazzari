export const MAX_COLUMNS = 24;

export function boardCells(input: string, maxColumns = MAX_COLUMNS): string[] {
  const normalized = input.toUpperCase().replace(/[^ A-Z0-9:.\-/+!?%°]/g, " ");
  const cells = (normalized.match(/°[FC]|./g) || []).slice(0, maxColumns);
  while (cells.at(-1) === " ") cells.pop();
  return cells;
}

export function boardText(input: string): string {
  return boardCells(input).join("");
}

export function boardLayout(lines: string[], rotationLines: string[] = lines, sectionStarts: number[] = []) {
  const visible: string[] = [],
    sections: number[] = [],
    // The index in `lines` that each visible line came from, so callers can keep per-line metadata aligned.
    sources: number[] = [];
  let section = false;
  for (let index = 0; index < lines.length; index++) {
    if (sectionStarts.includes(index)) section = true;
    const line = boardText(lines[index]);
    if (!line.trim()) continue;
    if (section && visible.length) sections.push(visible.length);
    section = false;
    visible.push(line);
    sources.push(index);
  }
  const columns = Math.max(1, ...[...visible, ...rotationLines].map((line) => boardCells(line).length));
  return { lines: visible, columns, sectionStarts: sections, sources };
}
