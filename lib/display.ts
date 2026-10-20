export type Game = {
  id: string;
  date?: string;
  startTimeTbd?: boolean;
  status: string;
  state: string;
  teams: {abbr: string; score: string; homeAway: string}[];
  details?: string[];
  essentialDetails?: string[];
  priorityDetail?: string;
};

export function pages(text: string, width = 24): string[] {
  const words = text.toUpperCase().replace(/&/g, " AND ").trim().split(/\s+/);
  const result: string[] = [];
  let line = "";
  for (let word of words) {
    if (line && line.length + word.length + 1 > width) {
      result.push(line);
      line = "";
    }
    while (word.length > width) {
      result.push(word.slice(0, width));
      word = word.slice(width);
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  return result.length ? result : [""];
}

export function favoriteTeams(favorites:string):string[] {
  return Array.from(new Set(favorites.toUpperCase().split(",").map(team=>team.trim()).filter(Boolean)));
}

export function orderGames(games: Game[], favorites: string, favoritesOnly = false): Game[] {
  const preferred = favoriteTeams(favorites);
  const rank = (game: Game) =>
    (game.teams.some(team => preferred.includes(team.abbr.toUpperCase())) ? 0 : 10) +
    (game.state === "in" ? 0 : game.state === "pre" ? 1 : 2);
  return games.filter(game => !favoritesOnly || game.teams.some(team => preferred.includes(team.abbr.toUpperCase())))
    .sort((a, b) => rank(a) - rank(b) || (a.date || "").localeCompare(b.date || ""));
}

export function gamePages(game:Game, zone:string, essentialOnly = false):{matchup:string[]; status:string[]} {
  const away = game.teams.find(team => team.homeAway === "away") || game.teams[0];
  const home = game.teams.find(team => team.homeAway === "home") || game.teams[1];
  const exceptional = /DELAY|POSTPON|SUSPEND|CANCEL|ABANDON|FORFEIT/i.test(game.status);
  const matchup = away && home ? (game.state === "pre" || /CANCEL|POSTPON/i.test(game.status) ? `${away.abbr} AT ${home.abbr}` :
    `${away.abbr} ${away.score} - ${home.abbr} ${home.score}`) : "MATCHUP UNAVAILABLE";
  let detail=game.status;
  if(game.state==="pre"&&game.date&&!exceptional){
    const date=new Date(game.date);
    const day=new Intl.DateTimeFormat("en-US",{timeZone:game.startTimeTbd?"UTC":zone,month:"short",day:"numeric"}).format(date);
    const time=game.startTimeTbd?"TIME TBD":new Intl.DateTimeFormat("en-US",
      {timeZone:zone,hour:"numeric",minute:"2-digit",hour12:true}).format(date);
    detail=`${day} ${time}`;
  }
  const state = game.state === "in" ? "LIVE" : game.state === "post" ? "FINAL" : "NEXT";
  const heading = pages(exceptional || detail.toUpperCase().startsWith(state) ? detail : `${state} ${detail}`);
  const extra = (essentialOnly ? game.essentialDetails || [] : game.details || []).flatMap(item => pages(item));
  const status = [...heading];
  // Repeat the clock/status between detail cards so a long rotation retains game context.
  for (const item of extra) {
    status.push(item, ...heading);
  }
  if(game.priorityDetail && extra.includes(game.priorityDetail.toUpperCase())){
    const priority=game.priorityDetail.toUpperCase();
    const others=extra.filter(item=>item!==priority);
    return {matchup:pages(matchup),status:others.length?
      others.flatMap(item=>[...heading,priority,...heading,item]):[...heading,priority]};
  }
  return {matchup:pages(matchup), status};
}

export function selectGamePage(entries:{matchup:string[];status:string[]}[], tick:number):{index:number;page:number}|null {
  if (!entries.length) return null;
  const index = Math.floor(tick / 2) % entries.length;
  const round = Math.floor(tick / (entries.length * 2));
  return {index, page:round * 2 + tick % 2};
}

export function isQuietTime(time: string, start: string, end: string): boolean {
  if (start === end) return true;
  return start < end ? time >= start && time < end : time >= start || time < end;
}

export function feedStatus(enabled: boolean, failed: boolean, updated: number | null, now: number, staleAfter=300_000): string {
  if (!enabled) return "OFF";
  if (updated === null) return failed ? "OFFLINE" : "LOADING";
  return failed || now - updated > staleAfter ? "STALE" : "LIVE";
}
