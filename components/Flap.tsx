"use client";
import { useEffect, useRef, useState } from "react";
import { SYMBOLS } from "../lib/config";
export function Flap({
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
  const clean = SYMBOLS.includes(char.toUpperCase()) ? char.toUpperCase() : " ";
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
    const step = () => {
      if (cancelled) return;
      if (current.current === clean) {
        setFlipping(false);
        return;
      }
      const at = SYMBOLS.indexOf(current.current),
        end = SYMBOLS.indexOf(clean);
      const dist = (end - at + SYMBOLS.length) % SYMBOLS.length;
      // Cap cycle length so a board update never gets stuck cycling through the entire alphabet.
      const stride = dist > 12 ? Math.max(1, Math.floor(dist / 5)) : 1;
      const next = SYMBOLS[(at + stride) % SYMBOLS.length];
      setTop(current.current);
      setShown(next);
      setFlipping(true);
      current.current = next;
      flipRef.current?.();
      timer.current = setTimeout(step, Math.max(35, speed));
    };
    if (current.current !== clean) timer.current = setTimeout(step, delay);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [clean, speed, reducedMotion, delay]);
  return (
    <div className="flap" aria-label={clean}>
      <div className="flap-base">
        <span>{shown}</span>
      </div>
      <div className="flap-top">
        <span>{shown}</span>
      </div>
      <div className="flap-bottom">
        <span>{shown}</span>
      </div>
      <div
        className={`flap-turn ${flipping ? "turning" : ""}`}
        key={`${top}-${shown}`}
        style={{ animationDuration: `${Math.max(35, speed)}ms` }}
      >
        <span>{top}</span>
      </div>
      <div className="flap-seam" />
      <div className="flap-pin left" />
      <div className="flap-pin right" />
    </div>
  );
}
