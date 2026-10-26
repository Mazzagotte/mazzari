import { LEAGUES, type League } from "./config.ts";

export type ESPNTeam = { id: string; abbr: string; name: string };

export function parseTeams(value: unknown): ESPNTeam[] {
  if (!value || typeof value !== "object" || !("sports" in value) || !Array.isArray(value.sports))
    throw new Error("Invalid teams response");
  const entries: unknown = value.sports[0]?.leagues?.[0]?.teams;
  if (!Array.isArray(entries)) throw new Error("Invalid teams response");
  return entries.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || !("team" in entry) || !entry.team || typeof entry.team !== "object")
      throw new Error("Invalid team entry");
    const team = entry.team;
    if (
      !("id" in team) ||
      typeof team.id !== "string" ||
      !team.id ||
      !("abbreviation" in team) ||
      typeof team.abbreviation !== "string" ||
      !team.abbreviation ||
      !("displayName" in team) ||
      typeof team.displayName !== "string"
    )
      throw new Error("Invalid team entry");
    return { id: team.id, abbr: team.abbreviation, name: team.displayName };
  });
}

export async function fetchTeams(league: League, signal: AbortSignal): Promise<ESPNTeam[]> {
  const { sport, code } = LEAGUES[league];
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/teams?limit=1000${league === "ncaaf" ? "&groups=80" : ""}`,
    { next: { revalidate: 86400 }, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
  );
  if (!response.ok) throw new Error(`Teams HTTP ${response.status}`);
  return parseTeams(await response.json());
}
