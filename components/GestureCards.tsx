"use client";
import { useState } from "react";
import type { Settings } from "../lib/config";
import { upgradeDrawing } from "../lib/drawing";
import { CARD_LIMIT, scheduleInput, scheduleInstant, type GestureCard } from "../lib/gestureCards";

export function GestureCards({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("My card");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [at, setAt] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [deleting, setDeleting] = useState("");
  const update = (id: string, patch: Partial<GestureCard>) =>
    onChange({ ...settings, cards: settings.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)) });
  const save = (replace: boolean) => {
    setError("");
    setStatus("");
    if (!name.trim()) {
      setError("Give your card a name before saving.");
      return;
    }
    if (replace && !settings.cards.some((card) => card.id === selected)) {
      setError("Load a saved card before updating it.");
      return;
    }
    if (!replace && settings.cards.length >= CARD_LIMIT) {
      setError(`You can save up to ${CARD_LIMIT} cards. Delete one first.`);
      return;
    }
    const drawing = upgradeDrawing(settings.drawing);
    if (replace) update(selected, { name: name.trim(), drawing });
    else {
      const id = crypto.randomUUID();
      onChange({
        ...settings,
        cards: [...settings.cards, { id, name: name.trim(), enabled: true, drawing, schedule: null }],
      });
      setSelected(id);
    }
    setStatus(replace ? "Saved card updated." : "New card saved.");
  };
  return (
    <section className="gesture-cards" aria-label="Saved gesture cards">
      <h3>SAVED CARDS</h3>
      <p className="hint">
        Save up to {CARD_LIMIT} cards. Selected cards rotate every 20 seconds in Drawing board mode only. Editing the
        grid changes the draft; use Update loaded card to change its saved copy.
      </p>
      <label>
        Card name
        <input maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="two">
        <button className="reset" disabled={settings.cards.length >= CARD_LIMIT} onClick={() => save(false)}>
          Save as new card
        </button>
        <button
          className="reset"
          disabled={!settings.cards.some((card) => card.id === selected)}
          onClick={() => save(true)}
        >
          Update loaded card
        </button>
      </div>
      {settings.cards.map((card) => (
        <fieldset className="message-editor" key={card.id}>
          <legend>
            {card.name}
            {selected === card.id ? " (loaded)" : ""}
          </legend>
          <label className="check">
            <input
              type="checkbox"
              checked={card.enabled}
              onChange={(e) => update(card.id, { enabled: e.target.checked })}
            />
            Include {card.name} in rotation
          </label>
          <div className="two">
            <button
              className="reset"
              onClick={() => {
                setSelected(card.id);
                setName(card.name);
                setStatus("Card loaded into the editor.");
                setError("");
                onChange({ ...settings, drawing: upgradeDrawing(card.drawing) });
              }}
            >
              Edit {card.name}
            </button>
            <button
              className="reset"
              onClick={() => {
                setScheduleId(card.id);
                setAt(card.schedule ? scheduleInput(card.schedule.at, settings.timezone) : "");
                setMinutes(String(card.schedule?.minutes || 15));
                setError("");
              }}
            >
              Schedule {card.name}
            </button>
          </div>
          {card.schedule && (
            <>
              <p className="hint" role="status">
                {new Intl.DateTimeFormat("en-US", {
                  timeZone: settings.timezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(card.schedule.at))}{" "}
                for {card.schedule.minutes} minutes ({settings.timezone}).{" "}
                {Date.now() >= card.schedule.at + card.schedule.minutes * 60000 ? "Finished." : ""}
              </p>
              <button className="reset" onClick={() => update(card.id, { schedule: null })}>
                Cancel surprise for {card.name}
              </button>
            </>
          )}
          {deleting === card.id ? (
            <div className="two">
              <button
                className="reset"
                onClick={() => {
                  onChange({ ...settings, cards: settings.cards.filter((item) => item.id !== card.id) });
                  setDeleting("");
                  setStatus("Card deleted; its surprise is canceled.");
                }}
              >
                Confirm delete {card.name}
              </button>
              <button className="reset" onClick={() => setDeleting("")}>
                Keep card
              </button>
            </div>
          ) : (
            <button className="reset" onClick={() => setDeleting(card.id)}>
              Delete {card.name}
            </button>
          )}
        </fieldset>
      ))}
      {scheduleId && settings.cards.some((card) => card.id === scheduleId) && (
        <fieldset className="message-editor">
          <legend>One-time surprise: {settings.cards.find((card) => card.id === scheduleId)?.name}</legend>
          <label>
            Surprise date and time
            <input
              type="datetime-local"
              min="0001-01-01T00:00"
              max="9999-12-31T23:59"
              value={at}
              onChange={(e) => setAt(e.target.value)}
            />
          </label>
          <label>
            Surprise duration
            <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
              {[1, 5, 15, 30, 60, 120].map((value) => (
                <option key={value} value={value}>
                  {value} minutes
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            Uses {settings.timezone}, not this device&apos;s timezone. A surprise plays even when its card is excluded
            from rotation. After it ends, the underlying mode returns. Overlapping surprises show the one with the
            latest start.
          </p>
          <div className="two">
            <button
              className="reset"
              onClick={() => {
                setError("");
                setStatus("");
                try {
                  const instant = scheduleInstant(at, settings.timezone);
                  if (instant <= Date.now()) throw new Error("Choose a future date and time.");
                  update(scheduleId, { schedule: { at: instant, minutes: Number(minutes) } });
                  setScheduleId("");
                  setStatus("Surprise scheduled in this browser.");
                } catch (error) {
                  console.error("Could not schedule gesture card", error);
                  setError(error instanceof Error ? error.message : "The surprise could not be scheduled.");
                }
              }}
            >
              Save surprise
            </button>
            <button
              className="reset"
              onClick={() => {
                setScheduleId("");
                setError("");
              }}
            >
              Cancel scheduling
            </button>
          </div>
        </fieldset>
      )}
      <button
        className="reset"
        disabled={!settings.cards.some((card) => card.enabled)}
        onClick={() => onChange({ ...settings, displayMode: "drawing", playCards: true, returnToDailyAt: 0 })}
      >
        Show saved cards
      </button>
      <p className="hint">
        Surprises require this browser to be open. Reloading or waking during a surprise shows its remaining time;
        missed, expired surprises are not replayed. Existing Daily board return timers keep running. No remote delivery
        or account is involved.
      </p>
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
