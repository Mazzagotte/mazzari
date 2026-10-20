import {test} from "node:test";
import assert from "node:assert/strict";
import {feedStatus, gamePages, isQuietTime, orderGames, pages, selectGamePage} from "../lib/display.ts";
import type {Game} from "../lib/display.ts";
import {DEFAULTS, LEAGUE_IDS, restoreSettings} from "../lib/config.ts";
import {isGameFeed, isWeather} from "../lib/feeds.ts";
import {normalizeGame} from "../lib/scores.ts";
import {boardLayout,boardText} from "../lib/boardLayout.ts";

test("board uses the longest rotating line rather than padding every row to 24 columns",()=>{
  const rotation=["NEXT OCT 23 6:00 PM","WORLD SERIES GAME 1","DAL BALL / 3RD/4"];
  const first=boardLayout(["12:31 PM","MLB","TB AT MIL",rotation[0]],rotation);
  const next=boardLayout(["12:31 PM","MLB","TB AT MIL",rotation[1]],rotation);
  assert.equal(first.columns,19);
  assert.equal(next.columns,first.columns);
  assert.equal(boardLayout(["SHORT"],["THE LONGEST MESSAGE"]).columns,19);
  assert.equal(boardLayout(["A".repeat(30)]).columns,24);
  assert.equal(boardText("NEXT  "), "NEXT");
});

test("board removes empty rows and remaps section dividers to the visible rows",()=>{
  const layout=boardLayout(["12:31 PM","TUE, OCT 20","WEATHER LOADING","","MLB","NO GAMES",""],[],[2,4]);
  assert.deepEqual(layout.lines,["12:31 PM","TUE  OCT 20","WEATHER LOADING","MLB","NO GAMES"]);
  assert.deepEqual(layout.sectionStarts,[2,3]);
  assert.deepEqual(boardLayout(["CLOCK","","MESSAGE"],[],[1]).sectionStarts,[1]);
  assert.deepEqual(boardLayout(["","  ","?"]).lines,["?"]);
});

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

test("essential rotation preserves live situation and full mode adds only curated stats",()=>{
  const game=normalizeGame(eventFixture("in",{downDistanceText:"3rd & 7",possession:"1",
    lastPlay:{text:"A long play description"}}),"nfl",{boxscore:{teams:[
      {team:{id:"1"},statistics:[{name:"totalYards",displayValue:"100"}]},
      {team:{id:"2"},statistics:[{name:"totalYards",displayValue:"200"}]},
    ]}});
  const essential=gamePages(game,"UTC",true).status;
  const all=gamePages(game,"UTC",false).status;
  assert.ok(essential.includes("NYG BALL / 3RD/7"));
  assert.ok(!essential.some(line=>line.includes("YDS")||line.includes("LAST PLAY")));
  assert.ok(all.includes("YDS NYG 100 DAL 200"));
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

test("NFL and CFB combine possession and down, prioritize red zone, and retain field position", () => {
  for (const league of ["nfl","ncaaf"] as const) {
    const fixture = eventFixture("in", {downDistanceText:"3rd & 7", possessionText:"DAL 25", possession:"1", isRedZone:true});
    Object.assign(fixture.competitions[0].competitors[0], {timeouts:0});
    const game = normalizeGame(fixture, league);
    assert.deepEqual(game.details,["NYG RED ZONE","NYG BALL / 3RD/7","AT DAL 25"]);
    assert.equal(game.priorityDetail,"NYG RED ZONE");
    assert.equal(isGameFeed({games:[game]}), true);
  }
});

test("baseball combines zero counts, outs, and runners with batter and pitcher cards", () => {
  const game = normalizeGame(eventFixture("in", {balls:0,strikes:2,outs:0,onFirst:true,onSecond:false,onThird:true,
    batter:{athlete:{shortName:"A. Judge"}},pitcher:{athlete:{shortName:"G. Cole"},statistics:[{abbreviation:"PC",displayValue:"62"}]},
    lastPlay:{text:"Foul ball",pitch:{speed:97,type:{description:"Fastball"}}},
  }), "mlb");
  assert.deepEqual(game.details,["0-2 / 0 OUT / 1ST 3RD","BAT A. JUDGE","PITCH G. COLE"]);
  assert.equal(game.priorityDetail,"0-2 / 0 OUT / 1ST 3RD");
  const unknown = normalizeGame(eventFixture(), "mlb");
  assert.ok(!unknown.details?.some(detail => /BASES EMPTY|COUNT|OUTS/.test(detail)));
  assert.deepEqual(normalizeGame(eventFixture("in",{onFirst:false,onSecond:false,onThird:false}),"mlb").details,["BASES EMPTY"]);
});

test("basketball and hockey show curated paired statistics, not arbitrary provider fields", () => {
  const summary = {boxscore:{teams:[
    {team:{id:"1"},statistics:[{name:"fouls",displayValue:"0"},{name:"shots",displayValue:"25"},{name:"unrelated",displayValue:"999"}]},
    {team:{id:"2"},statistics:[{name:"fouls",displayValue:"2"},{name:"shots",displayValue:"20"}]},
  ]}};
  for (const league of ["nba","ncaab","nhl"] as const) {
    const game = normalizeGame(eventFixture("in",{isPowerPlay:true}),league,summary);
    assert.ok(game.details?.includes(league==="nhl"?"SOG NYG 25 DAL 20":"FOULS NYG 0 DAL 2"));
    assert.ok(!game.details?.some(line=>line.includes("999")));
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

test("venue, records, rankings, arbitrary notes and scoring breakdowns do not clutter game details", () => {
  const fixture = eventFixture();
  Object.assign(fixture.competitions[0], {venue:{fullName:"Stadium"},broadcasts:[{names:["TV"]}],notes:[{headline:"Note"}],series:{summary:"Series"}});
  Object.assign(fixture.competitions[0].competitors[0], {records:[{type:"total",summary:"12-4"}],curatedRank:{current:1},
    linescores:[{value:7}],leaders:[{abbreviation:"PASS",leaders:[{displayValue:"100 YD"}]}],
    statistics:[{abbreviation:"YDS",displayValue:"100"}]});
  const game = normalizeGame(fixture,"nfl");
  assert.deepEqual(game.details, []);
});

test("detail cards wrap within 24 columns and retain game status between cards", () => {
  const game = normalizeGame(eventFixture("in",{downDistanceText:"3rd & 7",possessionText:"DAL 25"}),"nfl");
  const entry = gamePages(game,"UTC");
  assert.ok(entry.status.includes("3RD/7"));
  assert.ok(entry.status.includes("AT DAL 25"));
  assert.ok(entry.status.every(line => line.length <= 24));
  assert.equal(entry.status[0],"LIVE 7:34 - 2ND");
  assert.equal(entry.status[2],"LIVE 7:34 - 2ND");
  assert.equal(isGameFeed({games:[{...game,details:[42]}]}),false);
});

test("football down fallback and zero timeouts are compact and missing possession is not invented",()=>{
  const fixture=eventFixture("in",{down:4,distance:0});
  Object.assign(fixture.competitions[0].competitors[0],{timeouts:0});
  Object.assign(fixture.competitions[0].competitors[1],{timeouts:2});
  const game=normalizeGame(fixture,"nfl");
  assert.deepEqual(game.details,["4TH/0","TO NYG 0 DAL 2"]);
  assert.equal(game.priorityDetail,"4TH/0");
});

test("basketball uses quarter or college half, explicit bonus, and late close-game priority",()=>{
  for(const league of ["nba","ncaab"] as const){
    const fixture=eventFixture();
    Object.assign(fixture.status,{period:league==="nba"?4:2,displayClock:"1:42",clock:102});
    Object.assign(fixture.competitions[0].competitors[0],{score:"90",bonus:true,timeouts:0});
    Object.assign(fixture.competitions[0].competitors[1],{score:"92",timeouts:1});
    const game=normalizeGame(fixture,league);
    assert.equal(game.status,`${league==="nba"?"Q4":"H2"} 1:42`);
    assert.equal(game.priorityDetail,`CLOSE / ${game.status}`);
    assert.ok(game.essentialDetails?.includes("BONUS NYG"));
    assert.ok(game.details?.includes("TO NYG 0 DAL 1"));
  }
  const fixture=eventFixture();
  Object.assign(fixture.status,{period:4,displayClock:"1:42",clock:102});
  fixture.competitions[0].competitors[0].score="50";
  assert.equal(normalizeGame(fixture,"nba").priorityDetail,undefined);
});

test("overtime clocks, halftime and intermission are not confused with regulation periods",()=>{
  const fixture=eventFixture();
  Object.assign(fixture.status,{period:6,displayClock:"2:30",clock:150});
  assert.equal(normalizeGame(fixture,"nba").status,"2OT 2:30");
  assert.equal(normalizeGame(fixture,"nba").priorityDetail,"OVERTIME");
  fixture.status.type.shortDetail="Halftime";
  assert.equal(normalizeGame(fixture,"nba").status,"Halftime");
  assert.equal(normalizeGame(fixture,"nba").priorityDetail,undefined);
  fixture.status.type.shortDetail="Shootout";
  Object.assign(fixture.status.type,{name:"STATUS_SHOOTOUT"});
  Object.assign(fixture.status,{period:5});
  assert.equal(normalizeGame(fixture,"nhl").status,"SHOOTOUT");
  assert.equal(normalizeGame(fixture,"nhl").priorityDetail,"SHOOTOUT");
});

test("hockey combines identified power-play team and strength, and prioritizes penalty shots",()=>{
  const fixture=eventFixture("in",{isPowerPlay:true});
  Object.assign(fixture.competitions[0].competitors[0],{situation:{isPowerPlay:true,strength:5}});
  Object.assign(fixture.competitions[0].competitors[1],{situation:{strength:4,isEmptyNet:true}});
  const game=normalizeGame(fixture,"nhl");
  assert.equal(game.priorityDetail,"NYG PP / 5 ON 4");
  assert.ok(game.details?.includes("DAL EMPTY NET"));
  fixture.competitions[0].situation.isPenaltyShot=true;
  assert.equal(normalizeGame(fixture,"nhl").priorityDetail,"PENALTY SHOT");
  assert.deepEqual(normalizeGame(eventFixture(),"nhl").details,[]);
});

test("baseball handles loaded bases, incomplete counts, and late tied innings without invented runners",()=>{
  const fixture=eventFixture("in",{balls:3,strikes:2,outs:2,onFirst:true,onSecond:true,onThird:true});
  assert.equal(normalizeGame(fixture,"mlb").priorityDetail,"3-2 / 2 OUT / LOADED");
  const unknown=normalizeGame(eventFixture("in",{balls:2}),"mlb");
  assert.deepEqual(unknown.details,[]);
  const late=eventFixture();
  Object.assign(late.status,{period:10});
  late.status.type.shortDetail="Top of the 10th Inning";
  late.competitions[0].competitors[1].score="21";
  const game=normalizeGame(late,"mlb");
  assert.equal(game.status,"TOP 10th");
  assert.equal(game.priorityDetail,"TIED / LATE INNINGS");
});

test("pregame probable pitchers show names but no season averages, venues, or broadcast clutter",()=>{
  const fixture=eventFixture("pre");
  Object.assign(fixture.competitions[0].competitors[0],{probables:[
    {name:"probableStartingPitcher",athlete:{shortName:"G. Cole"},statistics:[{name:"ERA",displayValue:"2.50"}]},
  ]});
  assert.deepEqual(normalizeGame(fixture,"mlb").essentialDetails,["NYG SP G. COLE"]);
});

test("playoff series and game seven context get a bounded slot even during a busy live game",()=>{
  const fixture=eventFixture("in",{balls:1,strikes:2,outs:1,onFirst:true,onSecond:true,onThird:true,
    batter:{athlete:{shortName:"A. Judge"}},pitcher:{athlete:{shortName:"G. Cole"}}});
  Object.assign(fixture,{season:{type:3}});
  Object.assign(fixture.competitions[0],{series:{type:"playoff",summary:"NYG leads series 3-2"},
    notes:[{headline:"ALCS - Game 6"}]});
  const game=normalizeGame(fixture,"mlb");
  assert.ok(game.details?.includes("NYG LEADS SERIES 3-2"));
  assert.equal(game.details?.length,3);
  Object.assign(fixture.competitions[0],{notes:[{headline:"ALCS - Game 7"}]});
  assert.ok(normalizeGame(fixture,"mlb").essentialDetails?.includes("ALCS GAME 7"));
  const regular=eventFixture("pre");
  Object.assign(regular.competitions[0],{series:{type:"season",summary:"NYG leads series 2-1"},notes:[{headline:"Promotion Night - Game 7"}]});
  assert.deepEqual(normalizeGame(regular,"mlb").details,[]);
});

test("summary playoff arrays are supported without leaking regular-season series",()=>{
  const fixture=eventFixture("pre");
  const summary={header:{season:{type:3},competitions:[{series:[
    {type:"season",summary:"NYG wins series 4-0"},{type:"playoff",summary:"Series tied 2-2"},
  ],notes:[{headline:"NBA Finals - Game 5"}]}]}};
  const game=normalizeGame(fixture,"nba",summary);
  assert.deepEqual(game.details,["SERIES TIED 2-2","NBA FINALS GAME 5"]);
});

test("special game states replace NEXT or LIVE and never announce a fictitious start",()=>{
  for(const description of ["Delayed","Postponed","Suspended","Canceled"]){
    const fixture=eventFixture("pre");
    Object.assign(fixture,{date:"2026-10-20T18:00Z"});
    Object.assign(fixture.status.type,{name:`STATUS_${description.toUpperCase()}`,description,shortDetail:description});
    const game=normalizeGame(fixture,"mlb");
    const entry=gamePages(game,"America/Boise");
    assert.deepEqual(entry.status,[description.toUpperCase()]);
    assert.deepEqual(entry.matchup,["NYG AT DAL"]);
    assert.deepEqual(game.details,[]);
  }
});

test("finals retain overtime, shootout or extra innings and optionally one game standout",()=>{
  for(const [league,detail,period,expected] of [
    ["nba","Final/2OT",6,"FINAL 2OT"],["nhl","Final/SO",5,"FINAL SO"],
    ["mlb","Final",12,"FINAL / 12"],
  ] as const){
    const fixture=eventFixture("post");
    Object.assign(fixture.status,{period});
    fixture.status.type.shortDetail=detail;
    assert.equal(normalizeGame(fixture,league).status,expected);
  }
  const fixture=eventFixture("post");
  Object.assign(fixture.competitions[0].competitors[0],{leaders:[
    {name:"points",leaders:[{displayValue:"34",athlete:{shortName:"S. Curry"}}]},
    {name:"unrelated",leaders:[{displayValue:"999",athlete:{shortName:"Ignore"}}]},
  ]});
  const game=normalizeGame(fixture,"nba");
  assert.deepEqual(game.details,["34 PTS S. CURRY"]);
  assert.deepEqual(game.essentialDetails,[]);
  Object.assign(fixture.status,{period:6});
  assert.equal(normalizeGame(fixture,"nba").status,"FINAL 2OT");
});

test("critical detail repeats more often without losing clock, score, or other games",()=>{
  const game=normalizeGame(eventFixture("in",{possession:"1",down:3,distance:4,isRedZone:true,possessionText:"DAL 8"}),"nfl");
  const entry=gamePages(game,"UTC",true);
  assert.deepEqual(entry.matchup,["NYG 21 - DAL 14"]);
  assert.equal(entry.status.filter(line=>line==="NYG RED ZONE").length,2);
  assert.equal(entry.status.filter(line=>line==="NYG BALL / 3RD/4").length,1);
  assert.equal(entry.status.filter(line=>line==="AT DAL 8").length,1);
  assert.equal(entry.status.filter(line=>line.startsWith("LIVE")).length,4);
  assert.deepEqual(selectGamePage([entry,entry],2),{index:1,page:0});
});

test("curated detail limits and priority validation hold for all six sports",()=>{
  const fixture=eventFixture("in",{balls:0,strikes:0,outs:0,onFirst:false,onSecond:false,onThird:false,
    possession:"1",down:1,distance:10,possessionText:"DAL 25",isRedZone:true,isPowerPlay:true,shotClock:0,
    batter:{athlete:{shortName:"An Extremely Long Athlete Name",lastName:"Judge"}},
    pitcher:{athlete:{shortName:"G. Cole"}}});
  for(const league of LEAGUE_IDS){
    const game=normalizeGame(fixture,league);
    for(const cards of [game.details!,game.essentialDetails!]){
      assert.ok(cards.length<=3);
      assert.ok(cards.every(card=>card.length<=24&&card===card.toUpperCase()));
      assert.equal(new Set(cards).size,cards.length);
    }
    assert.equal(isGameFeed({games:[game]}),true);
  }
  assert.equal(isGameFeed({games:[{...normalizeGame(fixture,"nfl"),priorityDetail:42}]}),false);
  assert.equal(isGameFeed({games:[{...normalizeGame(fixture,"nfl"),priorityDetail:"X".repeat(25)}]}),false);
});

test("competition-level final leaders produce one labeled performance without mutating the feed",()=>{
  const fixture=eventFixture("post");
  const leaders=[
    {name:"passingYards",leaders:[{displayValue:"24/34, 312 YDS, 3 TD, 1 INT",athlete:{shortName:"C.J. Stroud"}}]},
    {name:"receivingYards",leaders:[{displayValue:"4 REC, 107 YDS, 1 TD",athlete:{shortName:"J. Noel"}}]},
  ];
  Object.assign(fixture.competitions[0],{leaders});
  const original=structuredClone(fixture);
  const game=normalizeGame(fixture,"nfl");
  assert.deepEqual(game.details,["312 PASS YD C.J. STROUD"]);
  assert.deepEqual(game.essentialDetails,[]);
  assert.deepEqual(fixture,original);
});
