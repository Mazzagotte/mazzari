import { useEffect, useState } from "react";
import { DEFAULTS, restoreSettings, type Settings } from "../lib/config";
import { applyMessageReturn } from "../lib/messageReturn";

// Loads and persists settings in localStorage. `ready` becomes true once the saved settings are restored.
export function useSettings(now: Date | null, notify: (message: string) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("flap-settings");
      if (saved) setSettings(applyMessageReturn(restoreSettings(JSON.parse(saved)), Date.now()));
    } catch (error) {
      console.error("Could not restore display settings", error);
      notify("Saved settings could not be loaded. Defaults are active.");
    }
    setReady(true);
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        localStorage.setItem("flap-settings", JSON.stringify(settings));
      } catch (error) {
        console.error("Could not save display settings", error);
        notify("Settings could not be saved in this browser.");
      }
    };
    // Sliders and text fields change settings many times a second; write once the changes settle.
    const timer = setTimeout(save, 400);
    const flush = () => {
      clearTimeout(timer);
      save();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [ready, settings, notify]);

  useEffect(() => {
    if (!ready || !now) return;
    setSettings((previous) => applyMessageReturn(previous, now.getTime()));
  }, [ready, now]);

  return { settings, setSettings, ready };
}
