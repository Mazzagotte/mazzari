import type { League } from "./config";
import type { Game } from "./display";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const abbr = (team: RecordValue) => text(record(team.team).abbreviation);
const athlete = (value: unknown) => record(record(value).athlete);
const athleteName = (value: unknown) => text(athlete(value).shortName) || text(athlete(value).displayName);
const interrupted = /DELAY|POSTPON|SUSPEND|CANCEL|ABANDON|FORFEIT/i;

function compactStatus(status: RecordValue, league: League): string {
  const type = record(status.type),
    raw = text(type.shortDetail) || text(type.description) || "SCHEDULED";
  if (interrupted.test(`${text(type.name)} ${raw}`)) return text(type.description) || raw;
  const period = number(status.period),
    clock = text(status.displayClock);
  if (type.state === "post") {
    if (/shootout|\bSO\b/i.test(raw)) return "FINAL SO";
    if (/OT|overtime/i.test(raw)) {
      const match = raw.match(/(\d+)\s*OT/i);
      return `FINAL ${match ? match[1] : ""}OT`;
    }
    const regulation = league === "ncaab" ? 2 : 4;
    if (league !== "mlb" && league !== "nhl" && period !== undefined && period > regulation) {
      return `FINAL ${period - regulation > 1 ? period - regulation : ""}OT`;
    }
    if (league === "mlb" && period !== undefined && period > 9) return `FINAL / ${period}`;
    return "FINAL";
  }
  if (type.state !== "in") return raw;
  if (league === "nhl" && /SHOOTOUT|\bSO\b/i.test(`${text(type.name)} ${raw}`)) return "SHOOTOUT";
  if (/HALFTIME|END OF|INTERMISSION/i.test(`${raw} ${text(type.description)}`)) return raw;
  if (league === "mlb")
    return raw
      .replace(/Top of (?:the )?/i, "TOP ")
      .replace(/Bottom of (?:the )?/i, "BOT ")
      .replace(/\bBottom\b/i, "BOT")
      .replace(/ INNING/i, "");
  if (period !== undefined && period > 0 && clock) {
    const regulation = league === "nhl" ? 3 : league === "ncaab" ? 2 : 4;
    const phase =
      period > regulation
        ? `${period - regulation > 1 ? period - regulation : ""}OT`
        : `${league === "nhl" ? "P" : league === "ncaab" ? "H" : "Q"}${period}`;
    return `${phase} ${clock}`;
  }
  return raw;
}

export function normalizeGame(value: unknown, league: League, summaryValue?: unknown): Game {
  const event = record(value),
    competition = record(list(event.competitions)[0]),
    summary = record(summaryValue);
  const summaryCompetition = record(list(record(summary.header).competitions)[0]);
  // Score and clock come from one scoreboard snapshot; summaries only enrich its details.
  const status = record(event.status || competition.status),
    type = record(status.type);
  const situation = { ...record(competition.situation), ...record(summary.situation) };
  const competitors = list(competition.competitors).map(record);
  const state = text(type.state) || "pre";
  const paused = interrupted.test(`${text(type.name)} ${text(type.shortDetail)} ${text(type.description)}`);
  const interval = /HALFTIME|END_PERIOD|END_INNING|END OF|MIDDLE|MID \d|INTERMISSION/i.test(
    `${text(type.name)} ${text(type.shortDetail)} ${text(type.description)}`,
  );
  type Card = { text: string; essential: boolean; rank: number; context?: boolean };
  const cards: Card[] = [];
  const add = (content: string, rank: number, essential = true) => {
    const clean = content.toUpperCase().replace(/&/g, " AND ").replace(/\s+/g, " ").trim();
    if (!clean || clean.length > 24) return;
    const existing = cards.find((card) => card.text === clean);
    if (existing) {
      existing.rank = Math.min(existing.rank, rank);
      existing.essential = existing.essential || essential;
    } else cards.push({ text: clean, rank, essential });
  };
  const named = (label: string, value: unknown, rank: number, essential = true) => {
    const person = athlete(value);
    for (const name of [athleteName(value), text(person.lastName)]) {
      if (name && `${label} ${name}`.length <= 24) {
        add(`${label} ${name}`, rank, essential);
        return true;
      }
    }
    return false;
  };
  let priority: string | undefined;
  const important = (content: string) => {
    add(content, 0);
    priority = cards.find((card) => card.rank === 0)?.text;
  };
  const context = (content: string, rank: number) => {
    add(content, rank);
    const card = cards.find((item) => item.text === content.toUpperCase());
    if (card) card.context = true;
  };
  const teamSituation = (team: RecordValue) => {
    const extra = list(summaryCompetition.competitors)
      .map(record)
      .find((item) => text(item.id) === text(team.id));
    return { ...record(extra?.situation), ...record(team.situation) };
  };
  const stats = (team: RecordValue) => {
    const box = list(record(summary.boxscore).teams)
      .map(record)
      .find((item) => text(record(item.team).id) === text(team.id));
    return [...list(team.statistics), ...list(box?.statistics)].map(record);
  };
  const pairedStat = (names: string[], label: string, rank: number) => {
    const values = competitors.map((team) => {
      const stat = stats(team).find((item) =>
        names.includes((text(item.name) || text(item.abbreviation) || text(item.label)).toLowerCase()),
      );
      const result = text(stat?.displayValue);
      return abbr(team) && result ? `${abbr(team)} ${result}` : "";
    });
    if (values.length === 2 && values.every(Boolean)) add(`${label} ${values.join(" ")}`, rank, false);
  };

  if (state === "in" && !paused && !interval) {
    if (league === "nfl" || league === "ncaaf") {
      const possession = text(situation.possession)
        ? competitors.find((team) => text(team.id) === text(situation.possession))
        : undefined;
      const down = number(situation.down),
        distance = number(situation.distance);
      const raw = text(situation.shortDownDistanceText) || text(situation.downDistanceText);
      const downText =
        raw.replace(/\b(1st|2nd|3rd|4th)\s*(?:&|and)\s*/i, "$1/").replace(/\bGoal\b/i, "GOAL") ||
        (down !== undefined
          ? `${down}${["", "ST", "ND", "RD", "TH"][down] || ""}${distance !== undefined ? `/${distance}` : ""}`
          : "");
      const ball = possession ? `${abbr(possession)} BALL` : "";
      const situationCard = [ball, downText].filter(Boolean).join(" / ");
      if (situation.isRedZone === true) important(`${possession ? abbr(possession) + " " : ""}RED ZONE`);
      add(situationCard, 1);
      if (!priority && down !== undefined && down === 4) important(situationCard);
      if (text(situation.possessionText)) add(`AT ${text(situation.possessionText)}`, 2);
      const timeouts = competitors.map((team) =>
        number(team.timeouts) !== undefined ? `${abbr(team)} ${team.timeouts}` : "",
      );
      if (timeouts.length === 2 && timeouts.every(Boolean)) add(`TO ${timeouts.join(" ")}`, 4);
      pairedStat(["totalyards", "yards", "yds"], "YDS", 5);
    }
    if (league === "mlb") {
      const balls = number(situation.balls),
        strikes = number(situation.strikes),
        outs = number(situation.outs);
      const bases = [
        ["onFirst", "1ST"],
        ["onSecond", "2ND"],
        ["onThird", "3RD"],
      ] as const;
      const occupied = bases.filter(([key]) => situation[key] === true).map(([, label]) => label);
      const knownBases = bases.every(([key]) => typeof situation[key] === "boolean");
      const baseText =
        occupied.length === 3 ? "LOADED" : occupied.length ? occupied.join(" ") : knownBases ? "EMPTY" : "";
      const line = [
        balls !== undefined && strikes !== undefined ? `${balls}-${strikes}` : "",
        outs !== undefined ? `${outs} OUT` : "",
        baseText,
      ]
        .filter(Boolean)
        .join(" / ");
      add(line === "EMPTY" ? "BASES EMPTY" : line, 1);
      if (situation.onSecond === true || situation.onThird === true) important(line);
      named("BAT", situation.batter, 2);
      named("PITCH", situation.pitcher, 3);
      const pitch = record(record(situation.lastPlay).pitch);
      if (number(pitch.speed) !== undefined) add(`LAST PITCH ${pitch.speed} MPH`, 5, false);
    }
    if (league === "nba" || league === "ncaab") {
      const bonus = competitors.filter((team) => team.bonus === true || teamSituation(team).isBonus === true);
      if (bonus.length) add(`BONUS ${bonus.map(abbr).join(" ")}`, 2);
      const clock = number(situation.shotClock);
      if (clock !== undefined && clock >= 0) add(`SHOT CLOCK ${clock}`, 4, false);
      const timeouts = competitors.map((team) =>
        number(team.timeouts) !== undefined ? `${abbr(team)} ${team.timeouts}` : "",
      );
      if (timeouts.length === 2 && timeouts.every(Boolean)) add(`TO ${timeouts.join(" ")}`, 3);
      pairedStat(["fouls", "totalfouls", "pf"], "FOULS", 5);
      pairedStat(["threepointfieldgoalsmade-threepointfieldgoalsattempted", "3pt"], "3PT", 6);
    }
    if (league === "nhl") {
      if (compactStatus(status, league) === "SHOOTOUT") important("SHOOTOUT");
      const power = competitors.find((team) => teamSituation(team).isPowerPlay === true);
      const strengths = competitors.map((team) => number(teamSituation(team).strength));
      const knownStrengths = strengths.filter((value): value is number => value !== undefined);
      const strength =
        knownStrengths.length === 2 ? `${Math.max(...knownStrengths)} ON ${Math.min(...knownStrengths)}` : "";
      if (situation.isPenaltyShot === true && !priority) important("PENALTY SHOT");
      if (power || situation.isPowerPlay === true) {
        const label = power ? `${abbr(power)} PP` : "POWER PLAY";
        if (!priority) important([label, strength].filter(Boolean).join(" / "));
        else add([label, strength].filter(Boolean).join(" / "), 1);
      }
      for (const team of competitors) if (teamSituation(team).isEmptyNet === true) add(`${abbr(team)} EMPTY NET`, 1);
      pairedStat(["shots", "shotsongoal", "sog"], "SOG", 3);
    }
    const clockParts = text(status.displayClock).match(/^(\d+):(\d{2})$/);
    const period = number(status.period),
      clock = number(status.clock) ?? (clockParts ? Number(clockParts[1]) * 60 + Number(clockParts[2]) : undefined);
    const regulation = league === "nhl" ? 3 : league === "ncaab" ? 2 : 4;
    const scores = competitors.map((team) => {
      const score = text(record(team.score).value) || text(record(team.score).displayValue) || text(team.score);
      return score !== "" ? Number(score) : NaN;
    });
    const close =
      scores.length === 2 &&
      scores.every(Number.isFinite) &&
      Math.abs(scores[0] - scores[1]) <= (league === "nfl" || league === "ncaaf" ? 8 : league === "nhl" ? 1 : 5);
    if (
      !priority &&
      league !== "mlb" &&
      period !== undefined &&
      (period > regulation || (period === regulation && clock !== undefined && clock <= 120 && close))
    ) {
      // Use the provider clock, never a locally invented countdown.
      important(period > regulation ? "OVERTIME" : `CLOSE / ${compactStatus(status, league)}`);
    }
    if (
      !priority &&
      league === "mlb" &&
      period !== undefined &&
      period >= 9 &&
      scores.length === 2 &&
      scores.every(Number.isFinite) &&
      Math.abs(scores[0] - scores[1]) <= 1
    ) {
      important(scores[0] === scores[1] ? "TIED / LATE INNINGS" : "1-RUN GAME / LATE");
    }
  }

  if (state === "pre" && !paused && league === "mlb") {
    for (const team of competitors) {
      const probable = list(team.probables)
        .map(record)
        .find((item) => item.name === "probableStartingPitcher" || item.abbreviation === "SP");
      if (probable) named(`${abbr(team)} SP`, probable, 2);
    }
  }

  const playoff = number(record(event.season).type) === 3 || number(record(record(summary.header).season).type) === 3;
  const seriesCandidates = [...list(competition.series), competition.series, ...list(summaryCompetition.series)].map(
    record,
  );
  const series =
    seriesCandidates.find((item) => item.type === "playoff") ||
    (playoff ? seriesCandidates.find((item) => item.type === "current") : undefined);
  if (series) {
    const result = text(series.summary);
    // Only accept short, structured playoff results, never arbitrary provider notes.
    if (/^(?:[A-Z0-9]{2,5} (?:leads|wins)(?: series)? \d+-\d+|Series tied \d+-\d+)$/i.test(result)) context(result, 4);
  }
  if (playoff || series) {
    const notes = [...list(competition.notes), ...list(summaryCompetition.notes)].map(record);
    for (const note of notes) {
      const headline = text(note.headline);
      const match = headline.match(
        /^(ALCS|NLCS|ALDS|NLDS|ALWC|NLWC|WORLD SERIES|NBA FINALS|STANLEY CUP FINAL|EAST(?:ERN)? (?:CONF(?:ERENCE)? )?FINALS|WEST(?:ERN)? (?:CONF(?:ERENCE)? )?FINALS)(?:\s*-\s*GAME (\d+))?$/i,
      );
      if (match) {
        const label = [match[1], match[2] ? `GAME ${match[2]}` : ""].filter(Boolean).join(" ");
        context(label.length <= 24 ? label : `GAME ${match[2]}`, Number(match[2]) === 7 ? 1 : 5);
      } else {
        const game = headline.match(/\bGAME ([1-7])$/i);
        if (game) context(`GAME ${game[1]}`, Number(game[1]) === 7 ? 1 : 5);
        const round = headline.match(/^(East|West)(?:ern)?(?: Conference)? (1st|2nd|First|Second) Round/i);
        if (round) context(`${round[1]} ROUND ${/1st|First/i.test(round[2]) ? 1 : 2}`, 5);
        const football = headline.match(
          /^(?:(AFC|NFC) )?(Wild Card|Divisional|Conference Championship)(?: (?:Round|Playoffs))?$/i,
        );
        if (football) context([football[1], football[2]].filter(Boolean).join(" "), 5);
        if (/^Super Bowl(?: [IVXLCDM]+|\s+\d+)?$/i.test(headline)) context(headline, 5);
        if (/^(?:CFP|College Football Playoff) (Quarterfinal|Semifinal|National Championship)$/i.test(headline)) {
          context(
            headline.replace(/^College Football Playoff/i, "CFP").replace(/National Championship/i, "CHAMPIONSHIP"),
            5,
          );
        }
      }
    }
  }

  if (state === "post" && !paused) {
    const categories =
      league === "nba" || league === "ncaab"
        ? ["points"]
        : league === "nhl"
          ? ["goals"]
          : league === "mlb"
            ? ["RBIs", "homeRuns", "MLBRating"]
            : ["passingYards", "rushingYards", "receivingYards"];
    const candidates: { player: RecordValue; value: number; unit: string }[] = [];
    const leaders = [...list(competition.leaders)];
    for (const team of competitors) {
      const group = list(summary.leaders)
        .map(record)
        .find((item) => text(record(item.team).id) === text(team.id));
      leaders.push(...list(team.leaders), ...list(group?.leaders));
    }
    for (const category of leaders.map(record)) {
      if (!categories.includes(text(category.name))) continue;
      const leader = record(list(category.leaders)[0]),
        display = text(leader.displayValue);
      const unit =
        league === "nba" || league === "ncaab"
          ? "PTS"
          : league === "nhl"
            ? "G"
            : league === "mlb"
              ? category.name === "homeRuns"
                ? "HR"
                : "RBI"
              : `${category.name === "passingYards" ? "PASS" : category.name === "rushingYards" ? "RUSH" : "REC"} YD`;
      const match =
        league === "mlb"
          ? display.match(new RegExp(`(?:^|, )(?:(\\d+) )?${unit}(?:,|$)`))
          : league === "nfl" || league === "ncaaf"
            ? display.match(/(\d+) YDS/)
            : display.match(/^(\d+)(?:\s|$)/);
      const value = match ? Number(match[1] || 1) : undefined;
      if (value !== undefined && value > 0) candidates.push({ player: leader, value, unit });
    }
    for (const best of candidates.sort((a, b) => b.value - a.value)) {
      if (named(`${best.value} ${best.unit}`, best.player, 3, false)) break;
    }
    if (league === "nhl") pairedStat(["shots", "shotsongoal", "sog"], "SOG", 7);
  }

  cards.sort((a, b) => a.rank - b.rank);
  const select = (available: Card[]) => {
    const selected = available.slice(0, 3),
      playoffCard = available.find((card) => card.context);
    if (playoffCard && selected.length === 3 && !selected.some((card) => card.context)) selected[2] = playoffCard;
    return selected.map((card) => card.text);
  };
  const details = select(cards);
  const essentialDetails = select(cards.filter((card) => card.essential));
  return {
    id: text(event.id),
    date: text(event.date) || text(competition.date) || undefined,
    ...(competition.timeValid === false || text(type.shortDetail).toUpperCase() === "TBD"
      ? { startTimeTbd: true }
      : {}),
    status: compactStatus(status, league),
    state,
    teams: competitors.map((team) => ({
      abbr: abbr(team) || "?",
      score: text(record(team.score).displayValue) || text(record(team.score).value) || text(team.score) || "0",
      homeAway: text(team.homeAway),
    })),
    details,
    essentialDetails,
    ...(priority ? { priorityDetail: priority } : {}),
  };
}
