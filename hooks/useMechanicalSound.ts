import { useCallback, useRef } from "react";
import type { Settings } from "../lib/config";
import { isQuietTime } from "../lib/display";
import { eveningActive } from "../lib/evening";
import { clatterLevel, createClickBuffer, playMechanicalClick } from "../lib/mechanicalAudio";
import { safeTime } from "../lib/clock";

export function useMechanicalSound(settings: Settings, notify: (message: string) => void) {
  const audio = useRef<AudioContext | null>(null);
  const clickBuffer = useRef<AudioBuffer | null>(null);
  const lastClick = useRef(0);
  // Recent flips, decaying with a quarter-second half-life, so the clatter grows with how much of the board moves.
  const activity = useRef({ value: 0, at: 0 });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onFlip = useCallback(() => {
    const s = settingsRef.current;
    if (!s.sound || !s.volume || !audio.current || audio.current.state !== "running") return;
    const now = performance.now();
    activity.current = {
      value: activity.current.value * Math.pow(0.5, (now - activity.current.at) / 250) + 1,
      at: now,
    };
    const level = clatterLevel(activity.current.value);
    if (now - lastClick.current < level.gapMs) return;
    lastClick.current = now;
    if (
      s.quietHours &&
      isQuietTime(
        safeTime(new Date(), s.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
        s.quietStart,
        s.quietEnd,
      )
    )
      return;
    if (eveningActive(s.eveningDimming, new Date(), s.timezone, s.eveningStart, s.eveningEnd)) return;
    const ctx = audio.current;
    if (!clickBuffer.current) clickBuffer.current = createClickBuffer(ctx);
    playMechanicalClick(ctx, clickBuffer.current, s.volume, level.scale);
  }, []);

  const unlockAudio = useCallback(
    (enablingSound = false) => {
      if (!settingsRef.current.sound && !enablingSound) return;
      try {
        if (!audio.current) audio.current = new AudioContext();
        void audio.current.resume().catch((error) => {
          console.error(error);
          notify("Audio could not be enabled.");
        });
      } catch (error) {
        console.error(error);
        notify("Audio is unavailable in this browser.");
      }
    },
    [notify],
  );

  return { onFlip, unlockAudio };
}
