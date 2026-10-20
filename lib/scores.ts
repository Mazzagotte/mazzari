import type {League} from "./config";
import type {Game} from "./display";

type RecordValue = Record<string, unknown>;
const record = (value:unknown):RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const list = (value:unknown):unknown[] => Array.isArray(value) ? value : [];
const text = (value:unknown):string => typeof value === "string" ? value.trim() :
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const number = (value:unknown):number|undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const athleteName = (value:unknown) => {
  const athlete = record(record(value).athlete);
  return text(athlete.shortName) || text(athlete.displayName);
};

export function normalizeGame(value:unknown, league:League, summaryValue?:unknown):Game {
  const event = record(value), competition = record(list(event.competitions)[0]);
  const summary = record(summaryValue);
  const status = record(event.status || competition.status), type = record(status.type);
  const situation = {...record(competition.situation), ...record(summary.situation)};
  const competitors = list(competition.competitors).map(record);
  const details:string[] = [];
  const essentialDetails:string[] = [];
  const add = (label:string, value:unknown, essential=true) => {
    const content = text(value);
    if (content) {
      const detail=`${label} ${content}`.trim();
      details.push(detail);
      if(essential)essentialDetails.push(detail);
    }
  };
  const live = type.state === "in";
  if (live) {
    if (league === "nfl" || league === "ncaaf") {
      add("", situation.downDistanceText || situation.shortDownDistanceText);
      if (!situation.downDistanceText && !situation.shortDownDistanceText && number(situation.down) !== undefined) {
        add("DOWN", `${situation.down}${number(situation.distance) !== undefined ? ` TO GO ${situation.distance} YD` : ""}`);
      }
      add("BALL AT", situation.possessionText);
      const possession = competitors.find(team => text(team.id) === text(situation.possession));
      if (possession) add("POSSESSION", record(possession.team).abbreviation);
      if (situation.isRedZone === true) add("", "RED ZONE");
    }
    if (league === "mlb") {
      const balls = number(situation.balls), strikes = number(situation.strikes), outs = number(situation.outs);
      if (balls !== undefined || strikes !== undefined) {
        add("COUNT", `${balls === undefined ? "?" : balls} BALL ${strikes === undefined ? "?" : strikes} STRIKE`);
      }
      if (outs !== undefined) add("OUTS", outs);
      const bases = [["onFirst","1ST"],["onSecond","2ND"],["onThird","3RD"]] as const;
      const occupied = bases.filter(([key]) => situation[key] === true).map(([,label]) => label);
      if (occupied.length) add("RUNNERS", occupied.join(" "));
      else if (bases.every(([key]) => situation[key] === false)) add("", "BASES EMPTY");
      add("BAT", athleteName(situation.batter));
      add("PITCH", athleteName(situation.pitcher));
      const lastPitch = record(record(situation.lastPlay).pitch);
      if (number(lastPitch.speed) !== undefined) add("LAST PITCH MPH", lastPitch.speed,false);
      add("PITCH TYPE", record(lastPitch.type).description,false);
      const pitcher = record(situation.pitcher);
      for (const statValue of list(pitcher.statistics)) {
        const stat = record(statValue);
        add(`PITCHER ${text(stat.abbreviation) || text(stat.name)}`, stat.displayValue,false);
      }
    }
    if (league === "nhl") {
      if (situation.isPowerPlay === true) add("", "POWER PLAY");
      if (situation.isPenaltyShot === true) add("", "PENALTY SHOT");
    }
    for (const team of competitors) {
      const abbr = text(record(team.team).abbreviation);
      if (number(team.timeouts) !== undefined) add(`${abbr} TIMEOUTS`, team.timeouts);
      const teamSituation = record(team.situation);
      if (teamSituation.isPowerPlay === true) add(abbr, "POWER PLAY");
      if (number(teamSituation.strength) !== undefined) add(`${abbr} SKATERS`, teamSituation.strength);
    }
    const play = record(situation.lastPlay || summary.lastPlay);
    add("LAST PLAY", play.text,false);
  }
  for (const team of competitors) {
    if (type.state === "pre") continue;
    const abbr = text(record(team.team).abbreviation);
    for (const item of list(team.statistics)) {
      const stat = record(item), label = text(stat.abbreviation) || text(stat.name);
      if (label) add(`${abbr} ${label}`, stat.displayValue,false);
    }
    const boxTeam = list(record(summary.boxscore).teams).map(record)
      .find(item => text(record(item.team).id) === text(team.id));
    for (const item of list(boxTeam?.statistics)) {
      const stat = record(item);
      add(`${abbr} ${text(stat.label) || text(stat.abbreviation) || text(stat.name)}`, stat.displayValue,false);
    }
  }
  return {
    id:text(event.id), date:text(event.date) || undefined,
    ...(competition.timeValid===false||text(type.shortDetail).toUpperCase()==="TBD"?{startTimeTbd:true}:{}),
    status:text(type.shortDetail) || text(type.description) || "SCHEDULED",
    state:text(type.state) || "pre",
    teams:competitors.map(team => ({
      abbr:text(record(team.team).abbreviation) || "?", score:text(record(team.score).displayValue) || text(record(team.score).value) || text(team.score) || "0", homeAway:text(team.homeAway),
    })),
    details:Array.from(new Set(details)),
    essentialDetails:Array.from(new Set(essentialDetails)),
  };
}
