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
      const eyes = ellipse(x, y, 12, 7.6, 1.5, 2.2) || ellipse(x, y, 20, 7.6, 1.5, 2.2);
      const smile = y >= 11 && Math.hypot(x - 16, y - 9.5) >= 5 && Math.hypot(x - 16, y - 9.5) <= 6.8;
      return radius <= 9.2 && !eyes && !smile;
    }),
  },
  { id: "star", label: "Star", pixels: raster(star) },
  {
    id: "flower",
    label: "Flower",
    pixels: raster((x, y) => {
      const bloom = polygon([
        [8.5, 1.5],
        [13, 5.5],
        [16, 0.5],
        [19, 5.5],
        [23.5, 1.5],
        [24, 8.5],
        [21, 13.5],
        [16, 15],
        [11, 13.5],
        [8, 8.5],
      ])(x, y);
      const seams = line(x, y, 13, 6, 13.6, 11, 0.9) || line(x, y, 19, 6, 18.4, 11, 0.9);
      const leaf = (s: number) =>
        polygon([
          [16 + s * 0.8, 19],
          [16 + s * 7, 18],
          [16 + s * 8, 14],
          [16 + s * 3, 16.5],
        ])(x, y);
      return (bloom && !seams) || line(x, y, 16, 14, 16, 19.8, 1.8) || leaf(-1) || leaf(1);
    }),
  },
  {
    id: "butterfly",
    label: "Butterfly",
    pixels: raster((x, y) => {
      const wing = (px: number, py: number) => {
        const upper = polygon([
          [15, 10],
          [14, 3.5],
          [9, 1],
          [3.5, 1.5],
          [1, 5.5],
          [2.5, 10],
        ])(px, py);
        const lower = polygon([
          [15, 12],
          [3.5, 12],
          [4.5, 16.5],
          [9, 19],
          [13, 17.5],
        ])(px, py);
        const spots = ellipse(px, py, 7.6, 5.6, 2.6, 2.1) || ellipse(px, py, 9, 15.2, 1.6, 1.4);
        return (upper || lower) && !spots;
      };
      return (
        wing(x, y) ||
        wing(32 - x, y) ||
        ellipse(x, y, 16, 11, 1.3, 7.2) ||
        line(x, y, 16, 4.5, 13, 0.8, 1) ||
        line(x, y, 16, 4.5, 19, 0.8, 1)
      );
    }),
  },
  {
    id: "coffee",
    label: "Coffee cup",
    pixels: raster((x, y) => {
      const body = polygon([
        [6, 8],
        [22, 8],
        [21, 13],
        [18, 16],
        [10, 16],
        [7, 13],
      ])(x, y);
      const surface = y >= 9.3 && y <= 10.3 && x >= 7.4 && x <= 20.6;
      const handle = x >= 21 && ellipse(x, y, 23, 11.4, 4, 3.4) && !ellipse(x, y, 23, 11.4, 2, 1.7);
      const steam = [10, 14, 18].some((cx) => y >= 0.8 && y <= 6 && Math.abs(x - cx - Math.sin(y * 1.2)) < 0.7);
      return (body && !surface) || handle || steam || ellipse(x, y, 14, 18.5, 11, 1.2);
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
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        const reach = i % 3 === 0 ? 9 : 8.2;
        return line(
          x,
          y,
          16 + Math.cos(a) * 6.6,
          10 + Math.sin(a) * 6.6,
          16 + Math.cos(a) * reach,
          10 + Math.sin(a) * reach,
          1.6,
        );
      }).some(Boolean);
      return ellipse(x, y, 16, 10, 4.8) || rays;
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
      const roof = polygon([
        [16, 1],
        [29, 9.6],
        [3, 9.6],
      ])(x, y);
      const walls = x >= 6 && x <= 26 && y >= 10.6 && y <= 19.6;
      const cuts =
        (x >= 13.8 && x <= 18.2 && y >= 13.4) ||
        (x >= 9 && x <= 12.4 && y >= 12.6 && y <= 15.8) ||
        (x >= 19.6 && x <= 23 && y >= 12.6 && y <= 15.8) ||
        ellipse(x, y, 16, 6.2, 1.5);
      const chimney = x >= 21.6 && x <= 24.6 && y >= 2 && y <= 6;
      return ((roof || walls) && !cuts) || chimney;
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
      const d = Math.hypot(x - 16, Math.min(y - 17.5, 0));
      return (d >= 12.6 && d <= 15.6) || (d >= 8.6 && d <= 11.6) || (d >= 4.6 && d <= 7.6);
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
      const lid = x >= 4 && x <= 28 && y >= 7 && y <= 11;
      const box = x >= 5.5 && x <= 26.5 && y >= 12 && y <= 19.6;
      const ribbon = x >= 15 && x <= 17 && y >= 7;
      const loops =
        (ellipse(x, y, 12.2, 4.2, 3.8, 2.6) && !ellipse(x, y, 12.2, 4.2, 2.1, 1.1)) ||
        (ellipse(x, y, 19.8, 4.2, 3.8, 2.6) && !ellipse(x, y, 19.8, 4.2, 2.1, 1.1));
      return ((lid || box) && !ribbon) || loops || ellipse(x, y, 16, 5.6, 1.6, 1.5);
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
