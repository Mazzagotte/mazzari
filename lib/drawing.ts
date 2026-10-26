import { boardCells } from "./boardLayout.ts";
import { validExpiration } from "./messages.ts";

export const DRAWING_COLUMNS = 32;
export const DRAWING_ROWS = 20;
export const CAPTION_LIMIT = 24;
export type Reveal = "sweep" | "center" | "outline";
export type DrawingDate = { kind: "countdown" | "anniversary"; date: string; label: string };
export type Drawing = {
  pixels: string[];
  caption: string;
  signature?: string;
  style?: "solid" | "outline";
  reveal?: Reveal;
  occasion?: DrawingDate;
};
type Shape = (x: number, y: number) => boolean;

function raster(shape: Shape): string[] {
  return Array.from({ length: DRAWING_ROWS }, (_, r) =>
    Array.from({ length: DRAWING_COLUMNS }, (_, c) => (shape(c + 0.5, r + 0.5) ? "1" : "0")).join(""),
  );
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry = rx): boolean {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

function line(x: number, y: number, x1: number, y1: number, x2: number, y2: number, width = 1): boolean {
  const dx = x2 - x1,
    dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= width / 2;
}

function polygon(points: readonly (readonly [number, number])[]): Shape {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i],
        [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function heart(x: number, y: number): boolean {
  const nx = (x - 16) / 12,
    ny = (10 - y) / 8;
  return (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3 <= 0;
}

export function heartDrawing(): Drawing {
  return { pixels: raster(heart), caption: "" };
}

const star = polygon(
  Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5,
      radius = i % 2 ? 4 : 9;
    return [16 + Math.cos(angle) * radius, 10 + Math.sin(angle) * radius] as const;
  }),
);
const catHead = polygon([
  [7, 10],
  [6, 2],
  [12, 5],
  [20, 5],
  [26, 2],
  [25, 10],
  [25, 14],
  [22, 18],
  [10, 18],
  [7, 14],
]);

export const DRAWING_TEMPLATES = [
  { id: "heart", label: "Heart", pixels: heartDrawing().pixels },
  {
    id: "smiley",
    label: "Smiley face",
    pixels: raster((x, y) => {
      const radius = Math.hypot(x - 16, y - 10);
      return (
        (radius >= 7.8 && radius <= 9.5) ||
        ellipse(x, y, 12.3, 7.4, 1.4, 2) ||
        ellipse(x, y, 19.7, 7.4, 1.4, 2) ||
        (y >= 11.2 && radius >= 4.6 && radius <= 6.2)
      );
    }),
  },
  { id: "star", label: "Star", pixels: raster(star) },
  {
    id: "flower",
    label: "Flower",
    pixels: raster((x, y) => {
      const petals = Array.from({ length: 8 }, (_, i) => {
        const angle = -Math.PI / 2 + (i * Math.PI) / 4;
        return ellipse(x, y, 16 + Math.cos(angle) * 5.1, 7.5 + Math.sin(angle) * 5.1, 2);
      }).some(Boolean);
      return (
        petals ||
        ellipse(x, y, 16, 7.5, 2.5) ||
        line(x, y, 16, 13.8, 16, 19.6, 1.6) ||
        ellipse(x, y, 12.6, 17.2, 3.6, 1.5) ||
        ellipse(x, y, 19.4, 16, 3.6, 1.5)
      );
    }),
  },
  {
    id: "butterfly",
    label: "Butterfly",
    pixels: raster((x, y) => {
      const wing = (px: number, py: number) => {
        const upper = ellipse(px, py, 8.6, 7, 6.4, 5.6);
        const lower = ellipse(px, py, 10.6, 15, 4.4, 3.7);
        const hollow = ellipse(px, py, 8.6, 7, 4.7, 3.9) || ellipse(px, py, 10.6, 15, 2.8, 2.1);
        const dots = ellipse(px, py, 8.6, 7, 1.7, 1.4);
        return ((upper || lower) && !hollow) || dots;
      };
      return (
        wing(x, y) ||
        wing(32 - x, y) ||
        ellipse(x, y, 16, 11, 1.3, 6.6) ||
        line(x, y, 16, 5, 13, 1.5, 1) ||
        line(x, y, 16, 5, 19, 1.5, 1)
      );
    }),
  },
  {
    id: "coffee",
    label: "Coffee cup",
    pixels: raster((x, y) => {
      const cup = (x >= 6 && x <= 23 && y >= 8 && y <= 12) || ellipse(x, y, 14.5, 12, 8.5, 5);
      const inside = (x >= 7.5 && x <= 21.5 && y >= 9.5 && y <= 12) || ellipse(x, y, 14.5, 12, 7, 3.5);
      const handle = ellipse(x, y, 24, 11, 4, 3) && !ellipse(x, y, 24, 11, 2.5, 1.5);
      const steam = [10, 15, 20].some((cx) => y >= 1 && y <= 6 && Math.abs(x - cx - Math.sin(y * 1.3)) < 0.65);
      return (cup && !inside) || handle || steam || line(x, y, 5, 18.5, 26, 18.5, 1.5);
    }),
  },
  {
    id: "letter",
    label: "Love letter",
    pixels: raster((x, y) => {
      const border = x >= 3 && x <= 29 && y >= 4 && y <= 18 && (x < 4.3 || x > 27.7 || y < 5.3 || y > 16.7);
      const seal = heart(16 + (x - 16) * 4, 10 + (y - 10) * 4);
      const fold =
        line(x, y, 4, 5, 16, 12) ||
        line(x, y, 28, 5, 16, 12) ||
        line(x, y, 4, 17, 11, 11) ||
        line(x, y, 28, 17, 21, 11);
      return border || seal || fold;
    }),
  },
  {
    id: "cat",
    label: "Cat",
    pixels: raster((x, y) => {
      const edge =
        catHead(x, y) && !(catHead(x - 1.4, y) && catHead(x + 1.4, y) && catHead(x, y - 1.4) && catHead(x, y + 1.4));
      const nose = polygon([
        [14.6, 12],
        [17.4, 12],
        [16, 13.6],
      ])(x, y);
      return (
        edge ||
        ellipse(x, y, 12, 9.2, 1.3, 1.8) ||
        ellipse(x, y, 20, 9.2, 1.3, 1.8) ||
        nose ||
        line(x, y, 16, 13.6, 16, 14.6, 1) ||
        line(x, y, 16, 14.6, 13.6, 15.8, 1) ||
        line(x, y, 16, 14.6, 18.4, 15.8, 1) ||
        line(x, y, 5.4, 11.5, 0.8, 10, 0.9) ||
        line(x, y, 5.4, 14.5, 0.8, 16, 0.9) ||
        line(x, y, 26.6, 11.5, 31.2, 10, 0.9) ||
        line(x, y, 26.6, 14.5, 31.2, 16, 0.9)
      );
    }),
  },
  {
    id: "sun",
    label: "Sun",
    pixels: raster((x, y) => {
      const burst = polygon(
        Array.from({ length: 32 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 16;
          const r = i % 2 ? 6.4 : 9.6;
          return [16 + Math.cos(a) * r, 10 + Math.sin(a) * r] as const;
        }),
      );
      return (burst(x, y) && !ellipse(x, y, 16, 10, 5.4)) || ellipse(x, y, 16, 10, 3.8);
    }),
  },
  {
    id: "moon",
    label: "Moon & stars",
    pixels: raster((x, y) => {
      const sparkle = (cx: number, cy: number, r: number) =>
        line(x, y, cx, cy - r, cx, cy + r, 1.2) || line(x, y, cx - r, cy, cx + r, cy, 1.2);
      return (
        (ellipse(x, y, 12.5, 10, 8.5) && !ellipse(x, y, 17.2, 8, 7.4)) ||
        sparkle(25.5, 4.5, 2.4) ||
        sparkle(28.5, 11.5, 1.6) ||
        sparkle(22.5, 16, 2)
      );
    }),
  },
  {
    id: "house",
    label: "House",
    pixels: raster((x, y) => {
      const roof = line(x, y, 3, 10, 16, 2.2, 1.9) || line(x, y, 29, 10, 16, 2.2, 1.9) || ellipse(x, y, 16, 7, 1.4);
      const walls = y >= 10 && y <= 18.5 && x >= 6 && x <= 26 && (x <= 7.5 || x >= 24.5 || y >= 17.2);
      const door = x >= 13.5 && x <= 18.5 && y >= 12.5 && y <= 18.5;
      const window = (cx: number) =>
        x >= cx - 2 && x <= cx + 2 && y >= 12 && y <= 15.5 && (x < cx - 0.8 || x > cx + 0.8) && (y < 13.1 || y > 14.4);
      const chimney = x >= 22 && x <= 24.8 && y >= 2.2 && y <= 6;
      return roof || walls || door || window(10.3) || window(21.7) || chimney;
    }),
  },
  {
    id: "tree",
    label: "Pine tree",
    pixels: raster(
      (x, y) =>
        polygon([
          [16, 1],
          [22, 7],
          [10, 7],
        ])(x, y) ||
        polygon([
          [16, 5],
          [24, 12],
          [8, 12],
        ])(x, y) ||
        polygon([
          [16, 9],
          [27, 16.5],
          [5, 16.5],
        ])(x, y) ||
        (x >= 14.5 && x <= 17.5 && y >= 16.5 && y <= 19.5),
    ),
  },
  {
    id: "rainbow",
    label: "Rainbow",
    pixels: raster((x, y) => {
      const d = Math.hypot(x - 16, y - 16.5);
      const bands = y <= 16.5 && ((d >= 12.2 && d <= 14.8) || (d >= 8.4 && d <= 11) || (d >= 4.6 && d <= 7.2));
      const cloud = (px: number) =>
        ellipse(px, y, 3.6, 17.6, 3.2, 2) || ellipse(px, y, 7.2, 17.8, 2.8, 1.8) || ellipse(px, y, 5.2, 16, 2.4, 2);
      return bands || cloud(x) || cloud(32 - x);
    }),
  },
  {
    id: "music",
    label: "Music notes",
    pixels: raster(
      (x, y) =>
        ellipse(x, y, 10, 15.5, 3, 2.2) ||
        ellipse(x, y, 22, 13.5, 3, 2.2) ||
        line(x, y, 12.6, 15, 12.6, 4, 1.4) ||
        line(x, y, 24.6, 13, 24.6, 2.5, 1.4) ||
        polygon([
          [12, 4],
          [25.3, 2.5],
          [25.3, 5.8],
          [12, 7.3],
        ])(x, y),
    ),
  },
  {
    id: "gift",
    label: "Gift",
    pixels: raster((x, y) => {
      const box = x >= 6 && x <= 26 && y >= 9.5 && y <= 18.5 && (x < 7.4 || x > 24.6 || y > 17.1);
      const lid = x >= 5 && x <= 27 && y >= 6.5 && y <= 9.5 && (x < 6.4 || x > 25.6 || y < 7.9 || y > 8.1);
      const ribbon = x >= 14.5 && x <= 17.5 && y >= 6.5 && y <= 18.5;
      const bow =
        (ellipse(x, y, 12.5, 4, 3.6, 2.4) && !ellipse(x, y, 12.5, 4, 2.2, 1.1)) ||
        (ellipse(x, y, 19.5, 4, 3.6, 2.4) && !ellipse(x, y, 19.5, 4, 2.2, 1.1));
      return box || lid || ribbon || bow;
    }),
  },
  {
    id: "sailboat",
    label: "Sailboat",
    pixels: raster(
      (x, y) =>
        polygon([
          [5, 15],
          [27, 15],
          [23, 19],
          [9, 19],
        ])(x, y) ||
        line(x, y, 15, 2, 15, 15, 1.2) ||
        polygon([
          [16.5, 3],
          [16.5, 13.5],
          [25, 13.5],
        ])(x, y) ||
        polygon([
          [13.5, 5.5],
          [13.5, 13.5],
          [7, 13.5],
        ])(x, y),
    ),
  },
] as const;

export function isDrawing(value: unknown): value is Drawing {
  if (!value || typeof value !== "object" || !("pixels" in value) || !("caption" in value)) return false;
  if (!Array.isArray(value.pixels)) return false;
  const columns = value.pixels.length === 10 ? 16 : DRAWING_COLUMNS;
  return (
    (value.pixels.length === 10 || value.pixels.length === DRAWING_ROWS) &&
    value.pixels.every((row) => typeof row === "string" && row.length === columns && /^[01]+$/.test(row)) &&
    typeof value.caption === "string" &&
    value.caption.length <= CAPTION_LIMIT &&
    (!("signature" in value) || (typeof value.signature === "string" && value.signature.length <= CAPTION_LIMIT)) &&
    (!("style" in value) || value.style === "solid" || value.style === "outline") &&
    (!("reveal" in value) || value.reveal === "sweep" || value.reveal === "center" || value.reveal === "outline") &&
    (!("occasion" in value) || isDrawingDate(value.occasion))
  );
}

function isDrawingDate(value: unknown): value is DrawingDate {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    (value.kind === "countdown" || value.kind === "anniversary") &&
    "date" in value &&
    typeof value.date === "string" &&
    !!value.date &&
    validExpiration(value.date) &&
    "label" in value &&
    typeof value.label === "string" &&
    value.label.length <= CAPTION_LIMIT
  );
}

export function upgradeDrawing(drawing: Drawing): Drawing {
  const pixels =
    drawing.pixels.length === 10
      ? drawing.pixels.flatMap((row) => {
          const enlarged = [...row].map((cell) => cell.repeat(2)).join("");
          return [enlarged, enlarged];
        })
      : [...drawing.pixels];
  return { ...drawing, pixels, ...(drawing.occasion ? { occasion: { ...drawing.occasion } } : {}) };
}

export function outlinePixels(pixels: readonly string[]): string[] {
  return pixels.map((row, r) =>
    [...row]
      .map((cell, c) =>
        cell === "1" &&
        [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].some(([y, x]) => pixels[y]?.[x] !== "1")
          ? "1"
          : "0",
      )
      .join(""),
  );
}

export function localDate(now: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

export function occasionLines(occasion: DrawingDate, now: Date, zone: string): string[] {
  const today = localDate(now, zone);
  const days = Math.round((Date.parse(`${occasion.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  let text: string;
  if (occasion.kind === "anniversary" && days <= 0) {
    const years =
      Number(today.slice(0, 4)) - Number(occasion.date.slice(0, 4)) - (today.slice(5) < occasion.date.slice(5) ? 1 : 0);
    text = `${years} ${years === 1 ? "YEAR" : "YEARS"} TOGETHER`;
  } else if (days === 0) text = "TODAY IS THE DAY";
  else text = `${Math.abs(days)} ${Math.abs(days) === 1 ? "DAY" : "DAYS"} ${days > 0 ? "UNTIL" : "SINCE"}`;
  return [text, ...(occasion.label.trim() ? [occasion.label] : [])];
}

export function revealDelay(reveal: Reveal, r: number, c: number, pixels: readonly string[]): number {
  if (reveal === "center") return Math.round(Math.hypot((c - 15.5) * 0.65, r - 9.5) * 55);
  if (reveal === "outline") {
    const edge =
      pixels[r]?.[c] === "1" &&
      [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].some(([y, x]) => pixels[y]?.[x] !== "1");
    return (edge ? 0 : 650) + c * 15;
  }
  return c * 24;
}

export function drawingLayout(drawing: Drawing, now = new Date(), zone = "UTC") {
  const source = drawing.style === "outline" ? outlinePixels(drawing.pixels) : drawing.pixels;
  const pixels = source.map((row) => [...row].map((cell) => cell === "1"));
  const lines = drawing.pixels.map(() => " ".repeat(DRAWING_COLUMNS));
  const text = [
    drawing.caption,
    ...(drawing.occasion ? occasionLines(drawing.occasion, now, zone) : []),
    drawing.signature ? `- ${drawing.signature}` : "",
  ]
    .map((line) => boardCells(line.replace(/[\r\n]/g, " "), DRAWING_COLUMNS))
    .filter((cells) => cells.length);
  if (text.length) {
    lines.push(
      " ".repeat(DRAWING_COLUMNS),
      ...text.map((cells) => " ".repeat(Math.floor((DRAWING_COLUMNS - cells.length) / 2)) + cells.join("")),
    );
  }
  return { lines, columns: DRAWING_COLUMNS, sectionStarts: [], pixels, source };
}
