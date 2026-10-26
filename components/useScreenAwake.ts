"use client";
import { useEffect, useState } from "react";

export function useScreenAwake(enabled: boolean, retry: number): string {
  const [status, setStatus] = useState("Off");
  useEffect(() => {
    if (!enabled) {
      setStatus("Off");
      return;
    }
    if (!("wakeLock" in navigator)) {
      setStatus("Not supported in this browser");
      return;
    }
    let stopped = false,
      pending = false;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      if (stopped || pending || lock || document.visibilityState !== "visible") return;
      pending = true;
      setStatus("Requesting screen awake");
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (stopped) {
          await acquired.release();
          return;
        }
        lock = acquired;
        setStatus("Screen awake");
        acquired.addEventListener("release", () => {
          if (lock === acquired) lock = null;
          if (!stopped) setStatus("Released by browser - interact to retry");
        });
      } catch (error) {
        console.error("Screen wake lock unavailable", error);
        if (!stopped) setStatus("Unavailable - check browser permissions or power settings");
      } finally {
        pending = false;
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") void acquire();
      else setStatus("Paused while display is hidden");
    };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", acquire);
    document.addEventListener("keydown", acquire);
    window.addEventListener("pageshow", acquire);
    visibility();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", acquire);
      document.removeEventListener("keydown", acquire);
      window.removeEventListener("pageshow", acquire);
      if (lock) void lock.release().catch((error) => console.error("Could not release screen wake lock", error));
    };
  }, [enabled, retry]);
  return status;
}
