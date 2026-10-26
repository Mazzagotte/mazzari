export const MAX_COLUMNS = 24;

export function boardText(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^ A-Z0-9:.\-/+!?%°]/g, " ")
    .slice(0, MAX_COLUMNS)
    .trimEnd();
}

export function boardLayout(lines: string[], rotationLines: string[] = lines, sectionStarts: number[] = []) {
  const visible: string[] = [],
    sections: number[] = [];
  let section = false;
  for (let index = 0; index < lines.length; index++) {
    if (sectionStarts.includes(index)) section = true;
    const line = boardText(lines[index]);
    if (!line.trim()) continue;
    if (section && visible.length) sections.push(visible.length);
    section = false;
    visible.push(line);
  }
  const columns = Math.max(1, ...[...visible, ...rotationLines.map(boardText)].map((line) => line.length));
  return { lines: visible, columns, sectionStarts: sections };
}
