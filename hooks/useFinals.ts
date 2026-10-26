import { useEffect, useState } from "react";
import type { League, Settings } from "../lib/config";
import type { Game } from "../lib/display";
import { rememberFinals, restoreFinalCache, type FinalCache } from "../lib/favoriteGames";
import type { Feed } from "./feed";

// Remembers favorite teams' observed final scores across reloads.
export function useFinals(
  ready: boolean,
  sports: Partial<Record<League, Feed<Game[]>>>,
  favoritesByLeague: Settings["favoritesByLeague"],
  notify: (message: string) => void,
) {
  const [finals, setFinals] = useState<FinalCache>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mazzari-finals");
      if (saved) setFinals(restoreFinalCache(JSON.parse(saved), Date.now()));
    } catch (error) {
      console.error("Could not restore final scores", error);
      notify("Saved final scores could not be loaded. New finals will still be tracked.");
    }
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    setFinals((previous) => {
      const next = { ...previous };
      for (const league of Object.keys(sports) as League[]) {
        next[league] = rememberFinals(
          previous[league] || [],
          sports[league]?.data || [],
          favoritesByLeague[league],
          Date.now(),
        );
      }
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [ready, sports, favoritesByLeague]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("mazzari-finals", JSON.stringify(finals));
    } catch (error) {
      console.error("Could not save final scores", error);
      notify("Final scores could not be saved across reloads in this browser.");
    }
  }, [ready, finals, notify]);

  return finals;
}
