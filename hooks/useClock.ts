import { useEffect, useState, type RefObject } from "react";

// Rotates pages every 10 seconds and counts long gaps (such as sleep) so feeds can refresh. The timer
// wakes every second, but state only changes (and the page only re-renders) each second when
// `perSecond.current` is true; otherwise once per minute.
export function useClock(perSecond: RefObject<boolean>) {
  const [now, setNow] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const [wakeCount, setWakeCount] = useState(0);
  useEffect(() => {
    setNow(new Date());
    let lastClock = Date.now();
    let lastRender = lastClock;
    const clock = setInterval(() => {
      const time = Date.now();
      const gap = time - lastClock;
      lastClock = time;
      if (gap > 45000) setWakeCount((value) => value + 1);
      if (perSecond.current || gap > 45000 || Math.floor(time / 60000) !== Math.floor(lastRender / 60000)) {
        lastRender = time;
        setNow(new Date(time));
      }
    }, 1000);
    const rotation = setInterval(() => setTick((value) => value + 1), 10000);
    return () => {
      clearInterval(clock);
      clearInterval(rotation);
    };
  }, [perSecond]);
  return { now, setNow, tick, wakeCount };
}
