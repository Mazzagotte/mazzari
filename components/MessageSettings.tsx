"use client";
import type { Settings } from "../lib/config";
import { MESSAGE_LIMIT, messagePages, type PersonalMessage } from "../lib/messages";
import { returnDeadline } from "../lib/messageReturn";
import { useState } from "react";

export function DisplaySettings({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const [returnError, setReturnError] = useState("");
  return (
    <>
      <label>
        Display mode
        <select
          value={settings.displayMode}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === "daily" || mode === "messages" || mode === "clock" || mode === "drawing") {
              setReturnError("");
              onChange({ ...settings, displayMode: mode, returnToDailyAt: 0 });
            }
          }}
        >
          <option value="daily">Daily board</option>
          <option value="messages">Message board</option>
          <option value="clock">Clock only</option>
          <option value="drawing">Drawing board</option>
        </select>
      </label>
      {(settings.displayMode === "messages" || settings.displayMode === "drawing") && (
        <>
          <label>
            Return to Daily board
            <select
              value={settings.returnToDailyAt ? "scheduled" : "never"}
              onChange={(e) => {
                const choice = e.target.value;
                setReturnError("");
                if (choice === "never") {
                  onChange({ ...settings, returnToDailyAt: 0 });
                  return;
                }
                if (choice !== "30m" && choice !== "2h" && choice !== "morning") return;
                try {
                  onChange({ ...settings, returnToDailyAt: returnDeadline(choice, new Date(), settings.timezone) });
                } catch (error) {
                  console.error("Could not schedule Daily board return", error);
                  setReturnError("Could not schedule the return. Check your city timezone.");
                }
              }}
            >
              <option value="never">Stay on {settings.displayMode === "drawing" ? "Drawing" : "Message"} board</option>
              {settings.returnToDailyAt > 0 && (
                <option value="scheduled" disabled>
                  Return scheduled
                </option>
              )}
              <option value="30m">In 30 minutes</option>
              <option value="2h">In 2 hours</option>
              <option value="morning">Tomorrow at 7 AM</option>
            </select>
          </label>
          {settings.returnToDailyAt > 0 && (
            <p className="hint" role="status">
              Returns{" "}
              {new Intl.DateTimeFormat("en-US", {
                timeZone: settings.timezone,
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              }).format(new Date(settings.returnToDailyAt))}
              . This timer survives reloads; messages and drawings are not deleted.
            </p>
          )}
          {returnError && (
            <p className="hint" role="alert">
              {returnError}
            </p>
          )}
        </>
      )}
      <p className="hint">
        Daily board shows your clock, selected feeds and active messages. Message board shows messages alone; Clock only
        hides feeds and messages. Drawing board shows the draft or selected saved cards. Scheduled surprises temporarily
        override any mode, then return to it.
      </p>
      <p className="hint">
        Text modes fit the longest line across the active rotation, up to 24 columns, and remove empty rows. Drawing
        board preserves the full drawing grid.
      </p>
    </>
  );
}

export function MessageSettings({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const update = (id: string, patch: Partial<PersonalMessage>) =>
    onChange({
      ...settings,
      messages: settings.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    });
  return (
    <section aria-label="Personal message editor">
      <p className="hint">
        Messages rotate every 10 seconds. {settings.messages.length} of 20 messages used.
        {settings.displayMode === "clock" ? " Switch display mode to show them." : ""}
      </p>
      {settings.messages.map((message, index) => (
        <fieldset className="message-editor" key={message.id}>
          <legend>Message {index + 1}</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={message.enabled}
              onChange={(e) => update(message.id, { enabled: e.target.checked })}
            />
            Enabled
          </label>
          <label>
            Message text
            <textarea
              rows={3}
              maxLength={MESSAGE_LIMIT}
              value={message.text}
              placeholder="GOOD MORNING JAMES"
              onChange={(e) => update(message.id, { text: e.target.value })}
            />
          </label>
          <div className="message-preview" aria-label={`Message ${index + 1} preview`}>
            {messagePages(message.text).map((page, i) => (
              <pre key={i}>{page.filter((line) => line.trim()).join("\n") || "Your message preview"}</pre>
            ))}
          </div>
          <p className="hint">
            {message.text.length}/{MESSAGE_LIMIT} characters. Up to 24 columns and 4 rows per page; the board trims
            unused space.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={message.scheduled}
              onChange={(e) => update(message.id, { scheduled: e.target.checked })}
            />
            Daily schedule
          </label>
          {message.scheduled && (
            <div className="two">
              <label>
                Show from
                <input
                  type="time"
                  value={message.start}
                  onChange={(e) => {
                    if (e.target.value) update(message.id, { start: e.target.value });
                  }}
                />
              </label>
              <label>
                Show until
                <input
                  type="time"
                  value={message.end}
                  onChange={(e) => {
                    if (e.target.value) update(message.id, { end: e.target.value });
                  }}
                />
              </label>
            </div>
          )}
          <label>
            Expires after (optional)
            <input
              type="date"
              min="0001-01-01"
              max="9999-12-31"
              value={message.expires}
              onChange={(e) => update(message.id, { expires: e.target.value })}
            />
          </label>
          <button
            className="reset"
            onClick={() =>
              onChange({ ...settings, messages: settings.messages.filter((item) => item.id !== message.id) })
            }
          >
            Delete message {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        className="reset"
        disabled={settings.messages.length >= 20}
        onClick={() =>
          onChange({
            ...settings,
            messages: [
              ...settings.messages,
              {
                id: crypto.randomUUID(),
                text: "",
                enabled: true,
                scheduled: false,
                start: "07:00",
                end: "10:00",
                expires: "",
              },
            ],
          })
        }
      >
        Add message
      </button>
      <details className="settings-help">
        <summary>Scheduling &amp; message help</summary>
        <p className="hint">
          Schedules use {settings.city}&apos;s local time. Overnight windows are supported; equal times mean all day.
          Messages expire at the end of the selected date. Blank, disabled and expired messages are hidden. Message
          board falls back to the clock when none are active. Long messages continue on another page.
        </p>
      </details>
    </section>
  );
}
