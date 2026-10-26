import { restoreSettings, type Settings } from "./config.ts";

export function exportSettings(settings: Settings, now = new Date()): string {
  return JSON.stringify(
    { app: "mazzari", version: 1, exportedAt: now.toISOString(), settings: restoreSettings(settings) },
    null,
    2,
  );
}

export function importSettings(contents: string): Settings {
  const value: unknown = JSON.parse(contents);
  if (
    !value ||
    typeof value !== "object" ||
    !("app" in value) ||
    value.app !== "mazzari" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("settings" in value) ||
    !value.settings ||
    typeof value.settings !== "object" ||
    Array.isArray(value.settings) ||
    !("city" in value.settings) ||
    !("favoritesByLeague" in value.settings) ||
    !("messages" in value.settings)
  ) {
    throw new Error("Choose a supported MAZZARI settings backup (version 1).");
  }
  return restoreSettings(value.settings);
}
