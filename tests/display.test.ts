import {test} from "node:test";
import assert from "node:assert/strict";
import {feedStatus, gamePages, isQuietTime, orderGames, pages, selectGamePage} from "../lib/display.ts";
import type {Game} from "../lib/display.ts";
import {DEFAULTS, LEAGUE_IDS, restoreSettings} from "../lib/config.ts";
import {isGameFeed, isWeather} from "../lib/feeds.ts";
import {normalizeGame} from "../lib/scores.ts";

test("weather and status text wraps without losing words or exceeding 24 columns", () => {
  for (const text of ["WEATHER 48F PARTLY CLOUDY", "LIVE TOP OF THE 12TH INNING",
    "HIGH -100C LOW -120C", "A".repeat(60), "NYY 100 - LAD 100"]) {
    const result = pages(text);
    assert.ok(result.every(line => line.length <= 24));
    assert.equal(result.join("").replaceAll(" ", ""), text.replaceAll(" ", ""));
  }
  assert.deepEqual(pages(""), [""]);
});

test("sports prioritizes favorites, then live games, without mutating the feed", () => {
  const make = (id:string, abbr:string, state:string):Game => ({id, state, status:"", teams:[{abbr, score:"0", homeAway:"away"}]});
  const games = [make("other-final", "SEA", "post"), make("favorite-next", "NYY", "pre"),
    make("other-live", "LAD", "in"), make("favorite-live", "NYY", "in")];
  assert.deepEqual(orderGames(games, " nyy ").map(game => game.id),
    ["favorite-live", "favorite-next", "other-live", "other-final"]);
  assert.equal(games[0].id, "other-final");
});

test("favorites-only filters either team, normalizes preferences, and never falls back to other games",()=>{
  const games:Game[]=[
    {id:"1",state:"in",status:"Live",teams:[{abbr:"NYY",score:"1",homeAway:"home"}]},
    {id:"2",state:"pre",status:"Soon",teams:[{abbr:"SEA",score:"0",homeAway:"away"}]},
  ];
  assert.deepEqual(orderGames(games," nyy ",true).map(game=>game.id),["1"]);
  assert.deepEqual(orderGames(games,"DAL",true),[]);
  assert.deepEqual(orderGames(games,"",true),[]);
  assert.equal(orderGames(games,"",false).length,2);
  assert.equal(games.length,2);
});

test("essential rotation preserves live situation while omitting extra game stats",()=>{
  const game=normalizeGame(eventFixture("in",{downDistanceText:"3rd & 7",possession:"1",
    lastPlay:{text:"A long play description"}}),"nfl",{boxscore:{teams:[{team:{id:"1"},statistics:[{label:"Yards",displayValue:"100"}]}]}});
  const essential=gamePages(game,"UTC",true).status;
  const all=gamePages(game,"UTC",false).status;
  assert.ok(essential.includes("3RD AND 7"));
  assert.ok(essential.includes("POSSESSION NYG"));
  assert.ok(!essential.some(line=>line.includes("YARDS")||line.includes("LAST PLAY")));
  assert.ok(all.some(line=>line.includes("YARDS")));
  assert.equal(restoreSettings({}).essentialDetails,true);
  assert.equal(restoreSettings({}).favoritesOnly,false);
  const saved=restoreSettings({favoritesByLeague:{nfl:"DAL"},favoritesOnly:true,essentialDetails:false});
  assert.equal(saved.favoritesByLeague.nfl,"DAL");
  assert.equal(saved.favoritesOnly,true);
  assert.equal(saved.essentialDetails,false);
});

test("quiet hours handles overnight, daytime, boundaries and all-day mute", () => {
  assert.equal(isQuietTime("23:00", "22:00", "07:00"), true);
  assert.equal(isQuietTime("06:59", "22:00", "07:00"), true);
  assert.equal(isQuietTime("07:00", "22:00", "07:00"), false);
  assert.equal(isQuietTime("22:00", "22:00", "07:00"), true);
  assert.equal(isQuietTime("12:00", "22:00", "07:00"), false);
  assert.equal(isQuietTime("12:00", "09:00", "17:00"), true);
  assert.equal(isQuietTime("18:00", "09:00", "17:00"), false);
  assert.equal(isQuietTime("12:00", "09:00", "09:00"), true);
});

test("feed state distinguishes disabled, initial, failed, current and stale data", () => {
  assert.equal(feedStatus(false, true, null, 400000), "OFF");
  assert.equal(feedStatus(true, false, null, 400000), "LOADING");
  assert.equal(feedStatus(true, true, null, 400000), "OFFLINE");
  assert.equal(feedStatus(true, false, 100000, 400000), "LIVE");
  assert.equal(feedStatus(true, false, 100000, 400001), "STALE");
  assert.equal(feedStatus(true, true, 399999, 400000), "STALE");
});

test("saved settings migrate old preferences and reject invalid values", () => {
  assert.deepEqual(restoreSettings({city:"London"}), {...DEFAULTS, city:"London"});
  for (const invalid of [null, [], {timezone:"Invalid/Zone"}, {lat:91}, {volume:"loud"},
    {quietStart:"25:00"}, {league:"constructor"}, {unit:"kelvin"}]) {
    assert.throws(() => restoreSettings(invalid));
  }
});

test("league selections support none, one, two, and all with separate favorites", () => {
  for (const leagues of [[], ["nfl"], ["nfl","ncaaf"], LEAGUE_IDS]) {
    const settings = restoreSettings({leagues, favoritesByLeague:{nfl:"NYG",ncaaf:"BSU"}});
    assert.deepEqual(settings.leagues, leagues);
    assert.equal(settings.favoritesByLeague.nfl, "NYG");
    assert.equal(settings.favoritesByLeague.ncaaf, "BSU");
  }
  assert.deepEqual(restoreSettings({showSports:false,league:"nfl",favorites:"NYG"}).leagues, []);
  const legacy = restoreSettings({showSports:true,league:"ncaaf",favorites:"BSU"});
  assert.deepEqual(legacy.leagues, ["ncaaf"]);
  assert.equal(legacy.favoritesByLeague.ncaaf, "BSU");
  assert.deepEqual(restoreSettings({leagues:["nfl","nfl"]}).leagues, ["nfl"]);
  assert.throws(() => restoreSettings({leagues:["invalid"]}));
  assert.throws(() => restoreSettings({favoritesByLeague:{nfl:3}}));
  assert.equal(DEFAULTS.favoritesByLeague.nfl, "");
});

test("malformed feeds are rejected instead of displaying corrupt data", () => {
  assert.equal(isWeather({current:{temperature_2m:48}, daily:{}}), false);
  assert.equal(isGameFeed({games:[]}), true);
  assert.equal(isGameFeed({games:[{id:"1", date:"invalid", state:"pre", status:"Soon", teams:[]}]}), false);
  assert.equal(isGameFeed({games:[{id:"1", state:"in", status:"Live", teams:[{abbr:"NYY", score:"2", homeAway:"away"}]}]}), true);
});

test("details advance on successive visits without starving other games", () => {
  const game:Game = {id:"1", state:"in", status:"A".repeat(70), teams:[]};
  const entries = [gamePages(game, "UTC"), {matchup:["NYY AT SEA"], status:["NEXT"]}];
  assert.equal(entries[0].status.length, 4);
  assert.deepEqual([0,1,2,3,4,5].map(tick => selectGamePage(entries,tick)), [
    {index:0,page:0}, {index:0,page:1}, {index:1,page:0}, {index:1,page:1},
    {index:0,page:2}, {index:0,page:3},
  ]);
  assert.deepEqual(selectGamePage(entries,6), {index:1,page:2});
  assert.equal(selectGamePage([],0), null);
});

function eventFixture(state = "in", situation:Record<string,unknown> = {}) {
  return {id:"1", status:{type:{state, shortDetail:state === "in" ? "7:34 - 2nd" : "Scheduled"}},
    competitions:[{situation, competitors:[
      {id:"1", team:{abbreviation:"NYG"}, score:"21", homeAway:"away"},
      {id:"2", team:{abbreviation:"DAL"}, score:"14", homeAway:"home"},
    ]}]};
}

test("NFL and CFB include down, yards, field position, possession, and zero timeouts", () => {
  for (const league of ["nfl","ncaaf"] as const) {
    const fixture = eventFixture("in", {downDistanceText:"3rd & 7", possessionText:"DAL 25", possession:"1", isRedZone:true});
    Object.assign(fixture.competitions[0].competitors[0], {timeouts:0});
    const game = normalizeGame(fixture, league);
    assert.ok(game.details?.includes("3rd & 7"));
    assert.ok(game.details?.includes("BALL AT DAL 25"));
    assert.ok(game.details?.includes("POSSESSION NYG"));
    assert.ok(game.details?.includes("NYG TIMEOUTS 0"));
    assert.ok(game.details?.includes("RED ZONE"));
    assert.equal(isGameFeed({games:[game]}), true);
  }
});

test("baseball includes zero counts, occupied bases, pitcher, batter and pitch data", () => {
  const game = normalizeGame(eventFixture("in", {balls:0,strikes:2,outs:0,onFirst:true,onSecond:false,onThird:true,
    batter:{athlete:{shortName:"A. Judge"}},pitcher:{athlete:{shortName:"G. Cole"},statistics:[{abbreviation:"PC",displayValue:"62"}]},
    lastPlay:{text:"Foul ball",pitch:{speed:97,type:{description:"Fastball"}}},
  }), "mlb");
  for (const expected of ["COUNT 0 BALL 2 STRIKE","OUTS 0","RUNNERS 1ST 3RD","BAT A. Judge",
    "PITCH G. Cole","PITCHER PC 62","LAST PITCH MPH 97","PITCH TYPE Fastball","LAST PLAY Foul ball"]) {
    assert.ok(game.details?.includes(expected), expected);
  }
  const unknown = normalizeGame(eventFixture(), "mlb");
  assert.ok(!unknown.details?.some(detail => /BASES EMPTY|COUNT|OUTS/.test(detail)));
  assert.ok(normalizeGame(eventFixture("in",{onFirst:false,onSecond:false,onThird:false}),"mlb").details?.includes("BASES EMPTY"));
});

test("basketball and hockey summary stats are included with their team labels", () => {
  const summary = {boxscore:{teams:[{team:{id:"1"},statistics:[
    {label:"Fouls",displayValue:"0"}, {label:"Field Goals",displayValue:"20-40"}, {label:"Shots",displayValue:"25"},
  ]}]}};
  for (const league of ["nba","ncaab","nhl"] as const) {
    const game = normalizeGame(eventFixture("in",{isPowerPlay:true}),league,summary);
    assert.ok(game.details?.includes("NYG Fouls 0"));
    assert.ok(game.details?.includes("NYG Field Goals 20-40"));
    if (league === "nhl") assert.ok(game.details?.includes("POWER PLAY"));
  }
});

test("pregame metadata and season statistics are omitted from the clean display", () => {
  const fixture = eventFixture("pre",{downDistanceText:"1st & 10",balls:2});
  Object.assign(fixture.competitions[0].competitors[0], {
    statistics:[{abbreviation:"AVG",displayValue:".280"}],
    records:[{type:"total",summary:"12-4"}],
  });
  const game = normalizeGame(fixture,"mlb");
  assert.deepEqual(game.details, []);
});

test("venue, records, rankings, leaders and scoring breakdowns do not clutter game details", () => {
  const fixture = eventFixture();
  Object.assign(fixture.competitions[0], {venue:{fullName:"Stadium"},broadcasts:[{names:["TV"]}],notes:[{headline:"Note"}],series:{summary:"Series"}});
  Object.assign(fixture.competitions[0].competitors[0], {records:[{type:"total",summary:"12-4"}],curatedRank:{current:1},
    linescores:[{value:7}],leaders:[{abbreviation:"PASS",leaders:[{displayValue:"100 YD"}]}],
    statistics:[{abbreviation:"YDS",displayValue:"100"}]});
  const game = normalizeGame(fixture,"nfl");
  assert.deepEqual(game.details, ["NYG YDS 100"]);
});

test("detail cards wrap within 24 columns and retain game status between cards", () => {
  const game = normalizeGame(eventFixture("in",{downDistanceText:"3rd & 7",possessionText:"DAL 25"}),"nfl");
  const entry = gamePages(game,"UTC");
  assert.ok(entry.status.includes("3RD AND 7"));
  assert.ok(entry.status.includes("BALL AT DAL 25"));
  assert.ok(entry.status.every(line => line.length <= 24));
  assert.equal(entry.status[0],"LIVE 7:34 - 2ND");
  assert.equal(entry.status[2],"LIVE 7:34 - 2ND");
  assert.equal(isGameFeed({games:[{...game,details:[42]}]}),false);
});
