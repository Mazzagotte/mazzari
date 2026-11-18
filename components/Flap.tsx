"use client";
import { memo, useEffect, useRef, useState } from "react";
import { SYMBOLS } from "../lib/config";
import { flapSequence } from "../lib/flapSequence";
function FlapComponent({
  char,
  speed,
  onFlip,
  reducedMotion,
  delay = 0,
}: {
  char: string;
  speed: number;
  onFlip?: () => void;
  reducedMotion: boolean;
  delay?: number;
}) {
  const value = char.toUpperCase();
  const isUnit = value === "°F" || value === "°C";
  const clean = SYMBOLS.includes(value) || isUnit || value === "#" ? value : " ";
  const [shown, setShown] = useState(" ");
  const [top, setTop] = useState(" ");
  const [flipping, setFlipping] = useState(false);
  const current = useRef(" ");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipRef = useRef(onFlip);
  flipRef.current = onFlip;
  useEffect(() => {
    let cancelled = false;
    if (reducedMotion) {
      current.current = clean;
      setShown(clean);
      setTop(clean);
      setFlipping(false);
      return;
    }
    // Fixed at the start of each change, so the flap runs A→B→C toward its target.
    const queue = flapSequence(current.current, clean);
    const step = () => {
      if (cancelled) return;
      const next = queue.shift();
      if (next === undefined) {
        setFlipping(false);
        return;
      }
      setTop(current.current);
      setShown(next);
      setFlipping(true);
      current.current = next;
      flipRef.current?.();
      timer.current = setTimeout(step, Math.max(35, speed));
    };
    if (queue.length) timer.current = setTimeout(step, delay);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [clean, speed, reducedMotion, delay]);
  return (
    <div className={`flap${isUnit ? " unit-flap" : ""}`} aria-label={clean}>
      <div className="flap-top">
        <span className={shown === "#" ? "art-pixel" : undefined}>{shown}</span>
      </div>
      <div className="flap-bottom">
        <span className={shown === "#" ? "art-pixel" : undefined}>{shown}</span>
      </div>
      {flipping && (
        <div
          className="flap-turn"
          key={`${top}-${shown}`}
          style={{ animationDuration: `${Math.max(35, speed)}ms` }}
          onAnimationEnd={() => setFlipping(false)}
        >
          <span className={top === "#" ? "art-pixel" : undefined}>{top}</span>
        </div>
      )}
    </div>
  );
}

export const Flap = memo(FlapComponent);
