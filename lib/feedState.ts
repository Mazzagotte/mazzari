import type { League } from "./config.ts";
import type { Game } from "./display.ts";

export type Feed<T> = { data: T | null; updated: number | null; failed: boolean };
export const emptyFeed = <T>(): Feed<T> => ({ data: null, updated: null, failed: false });
export type ScheduleFeeds = Partial<Record<League, { key: string; feed: Feed<Game[]> }>>;
