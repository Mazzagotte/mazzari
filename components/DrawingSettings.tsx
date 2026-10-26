"use client";
import { useRef } from "react";
import type { Settings } from "../lib/config";
import {
  CAPTION_LIMIT,
  DRAWING_COLUMNS,
  DRAWING_ROWS,
  DRAWING_TEMPLATES,
  localDate,
  outlinePixels,
  type Drawing,
} from "../lib/drawing";
import { GestureCards } from "./GestureCards";

export function DrawingSettings({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const latest = useRef(settings);
  latest.current = settings;
  const stroke = useRef<{ pointer: number; filled: boolean; last: number } | null>(null);
  const preview =
    settings.drawing.style === "outline" ? outlinePixels(settings.drawing.pixels) : settings.drawing.pixels;
  const save = (drawing: Drawing) => {
    const next = { ...latest.current, drawing };
    latest.current = next;
    onChange(next);
  };
  const paint = (index: number, filled: boolean, from = index) => {
    const pixels = [...latest.current.drawing.pixels];
    const startRow = Math.floor(from / DRAWING_COLUMNS),
      startCol = from % DRAWING_COLUMNS;
    const row = Math.floor(index / DRAWING_COLUMNS),
      col = index % DRAWING_COLUMNS;
    const steps = Math.max(Math.abs(row - startRow), Math.abs(col - startCol), 1);
    for (let step = 0; step <= steps; step++) {
      const r = Math.round(startRow + ((row - startRow) * step) / steps),
        c = Math.round(startCol + ((col - startCol) * step) / steps);
      pixels[r] = pixels[r].slice(0, c) + (filled ? "1" : "0") + pixels[r].slice(c + 1);
    }
    save({ ...latest.current.drawing, pixels });
  };
  return (
    <section aria-label="Drawing editor">
      <p className="hint" id="drawing-help">
        Draw on a {DRAWING_COLUMNS} by {DRAWING_ROWS} flap grid. Tap or drag to draw. Start on a gold flap to erase.
        Keyboard: Tab to a flap, then press Space or Enter. Your drawing saves automatically in this browser.
      </p>
      <p className="hint">
        Choose a template to replace the grid, then make it your own. Your caption stays unchanged.
      </p>
      <div className="drawing-templates" role="group" aria-label="Drawing templates">
        {DRAWING_TEMPLATES.map((template) => (
          <button
            type="button"
            className="reset drawing-template"
            key={template.id}
            aria-label={`${template.label} template`}
            onClick={() => save({ ...latest.current.drawing, pixels: [...template.pixels] })}
          >
            <svg viewBox={`0 0 ${DRAWING_COLUMNS} ${DRAWING_ROWS}`} aria-hidden="true" focusable="false">
              {template.pixels.flatMap((row, r) =>
                [...row].map((cell, c) =>
                  cell === "1" ? <rect key={`${r}-${c}`} x={c} y={r} width=".88" height=".88" /> : null,
                ),
              )}
            </svg>
            <span>{template.label}</span>
          </button>
        ))}
      </div>
      <button
        className="reset"
        onClick={() =>
          save({ ...settings.drawing, pixels: Array.from({ length: DRAWING_ROWS }, () => "0".repeat(DRAWING_COLUMNS)) })
        }
      >
        Clear drawing
      </button>
      <label>
        Drawing style
        <select
          value={settings.drawing.style || "solid"}
          onChange={(e) => {
            if (e.target.value === "solid" || e.target.value === "outline")
              save({ ...settings.drawing, style: e.target.value });
          }}
        >
          <option value="solid">Solid gold</option>
          <option value="outline">Gold outline</option>
        </select>
      </label>
      <label>
        Reveal effect
        <select
          value={settings.drawing.reveal || "sweep"}
          onChange={(e) => {
            const reveal = e.target.value;
            if (reveal === "sweep" || reveal === "center" || reveal === "outline")
              save({ ...settings.drawing, reveal });
          }}
        >
          <option value="sweep">Left-to-right sweep</option>
          <option value="center">Center outward</option>
          <option value="outline">Outline, then fill</option>
        </select>
      </label>
      <svg className="drawing-style-preview" viewBox="0 0 32 20" role="img" aria-label="Styled drawing preview">
        {preview.flatMap((row, r) =>
          [...row].map((cell, c) =>
            cell === "1" ? <rect key={`${r}-${c}`} x={c} y={r} width=".9" height=".9" /> : null,
          ),
        )}
      </svg>
      <p className="hint">
        Preview above shows the chosen style. The editable grid below keeps the original filled shape, so switching
        styles never erases your artwork. Reveals play once per card arrival; reduced motion shows the result
        immediately.
      </p>
      <div
        className="drawing-grid"
        role="group"
        aria-label="Drawing grid and preview"
        aria-describedby="drawing-help"
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          const target = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button[data-cell]") : null;
          if (!target) return;
          const index = Number(target.dataset.cell);
          const filled =
            latest.current.drawing.pixels[Math.floor(index / DRAWING_COLUMNS)][index % DRAWING_COLUMNS] !== "1";
          stroke.current = { pointer: e.pointerId, filled, last: index };
          e.currentTarget.setPointerCapture(e.pointerId);
          paint(index, filled);
        }}
        onPointerMove={(e) => {
          const active = stroke.current;
          if (!active || active.pointer !== e.pointerId) return;
          const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLButtonElement>("button[data-cell]");
          if (!target || !e.currentTarget.contains(target)) return;
          const index = Number(target.dataset.cell);
          if (index === active.last) return;
          paint(index, active.filled, active.last);
          active.last = index;
        }}
        onPointerUp={() => {
          stroke.current = null;
        }}
        onPointerCancel={() => {
          stroke.current = null;
        }}
        onLostPointerCapture={() => {
          stroke.current = null;
        }}
      >
        {settings.drawing.pixels.flatMap((row, r) =>
          [...row].map((cell, c) => (
            <button
              type="button"
              key={`${r}-${c}`}
              data-cell={r * DRAWING_COLUMNS + c}
              aria-label={`Row ${r + 1}, column ${c + 1}`}
              aria-pressed={cell === "1"}
              onClick={(e) => {
                if (e.detail === 0) paint(r * DRAWING_COLUMNS + c, cell !== "1");
              }}
            />
          )),
        )}
      </div>
      <label>
        Drawing caption (optional)
        <input
          maxLength={CAPTION_LIMIT}
          value={settings.drawing.caption}
          placeholder="LOVE YOU"
          onChange={(e) => save({ ...settings.drawing, caption: e.target.value })}
        />
      </label>
      <p className="hint">
        Up to {CAPTION_LIMIT} characters. The caption appears centered below the drawing. Blank rows and flaps stay in
        place to preserve your shape.
      </p>
      <label>
        Signature (optional)
        <input
          maxLength={CAPTION_LIMIT}
          placeholder="JAMES"
          value={settings.drawing.signature || ""}
          onChange={(e) => save({ ...settings.drawing, signature: e.target.value })}
        />
      </label>
      <label>
        Meaningful date
        <select
          value={settings.drawing.occasion?.kind || "none"}
          onChange={(e) => {
            const kind = e.target.value;
            if (kind === "none") {
              const { occasion, ...drawing } = settings.drawing;
              void occasion;
              save(drawing);
            } else if (kind === "countdown" || kind === "anniversary")
              save({
                ...settings.drawing,
                occasion: {
                  kind,
                  date: settings.drawing.occasion?.date || localDate(new Date(), settings.timezone),
                  label: settings.drawing.occasion?.label || "",
                },
              });
          }}
        >
          <option value="none">No date</option>
          <option value="countdown">Countdown to a date</option>
          <option value="anniversary">Years since an anniversary</option>
        </select>
      </label>
      {settings.drawing.occasion && (
        <>
          <label>
            Card date
            <input
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={settings.drawing.occasion.date}
              onChange={(e) => {
                if (e.target.value && settings.drawing.occasion)
                  save({ ...settings.drawing, occasion: { ...settings.drawing.occasion, date: e.target.value } });
              }}
            />
          </label>
          <label>
            Date label (optional)
            <input
              maxLength={24}
              placeholder="OUR TRIP"
              value={settings.drawing.occasion.label}
              onChange={(e) => {
                if (settings.drawing.occasion)
                  save({ ...settings.drawing, occasion: { ...settings.drawing.occasion, label: e.target.value } });
              }}
            />
          </label>
          <p className="hint">
            Dates follow {settings.timezone}. Countdowns show days until, today, or days since. Anniversaries show
            completed years; a February 29 anniversary advances on March 1 in non-leap years.
          </p>
        </>
      )}
      <button
        className="reset"
        onClick={() => onChange({ ...settings, displayMode: "drawing", playCards: false, returnToDailyAt: 0 })}
      >
        Show Drawing board
      </button>
      <p className="hint">
        Choose a timed return under Display after showing your drawing. This is local to this browser, not remote
        sending.
      </p>
      <GestureCards settings={settings} onChange={onChange} />
    </section>
  );
}
