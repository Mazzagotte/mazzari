import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULTS,restoreSettings} from "../lib/config.ts";
import {exportSettings,importSettings} from "../lib/settingsBackup.ts";
import {returnDeadline,applyMessageReturn} from "../lib/messageReturn.ts";
import {favoriteAwareGames,rememberFinals,restoreFinalCache,scheduleFallbacks,scheduleGames} from "../lib/favoriteGames.ts";
import {favoriteTeams,gamePages,orderGames,type Game} from "../lib/display.ts";
import {parseTeams} from "../lib/espnTeams.ts";

const now=Date.parse("2026-10-20T18:00:00Z");
const game=(id:string,state:string,team="NYY",date="2026-10-20T17:00:00Z"):Game=>({
  id,state,date,status:state==="post"?"Final":"Scheduled",
  teams:[{abbr:team,score:"4",homeAway:"away"},{abbr:"SEA",score:"2",homeAway:"home"}],
});

test("backup round-trips every preference, message, timer, and per-league favorite",()=>{
  const settings=restoreSettings({...DEFAULTS,city:"New York",timezone:"America/New_York",leagues:["mlb","nfl"],favoritesByLeague:{...DEFAULTS.favoritesByLeague,nfl:"DAL"},
    returnToDailyAt:now+3600000,displayMode:"messages",finalScoreHours:48,
    messages:[{id:"one",text:"WELCOME HOME",enabled:true,scheduled:false,start:"07:00",end:"10:00",expires:""}]});
  const text=exportSettings(settings,new Date(now));
  assert.deepEqual(importSettings(text),settings);
  assert.equal(JSON.parse(text).version,1);
  for(const invalid of ["invalid","{}","[]",JSON.stringify({app:"not-mazzari",version:1,settings}),JSON.stringify({app:"mazzari",version:2,settings}),
    JSON.stringify({app:"mazzari",version:1,settings:{...settings,lat:91}})]){
    assert.throws(()=>importSettings(invalid));
  }
});

test("message return uses exact durations, inclusive expiry and leaves messages untouched",()=>{
  assert.equal(returnDeadline("30m",new Date(now),"UTC"),now+1800000);
  assert.equal(returnDeadline("2h",new Date(now),"UTC"),now+7200000);
  const settings=restoreSettings({displayMode:"messages",returnToDailyAt:now});
  assert.equal(applyMessageReturn(settings,now-1),settings);
  assert.equal(applyMessageReturn(settings,now).displayMode,"daily");
  assert.equal(applyMessageReturn(settings,now).returnToDailyAt,0);
  assert.equal(applyMessageReturn(settings,now).messages,settings.messages);
  assert.equal(applyMessageReturn({...settings,displayMode:"clock"},now).displayMode,"clock");
  assert.equal(applyMessageReturn({...settings,returnToDailyAt:0},now).displayMode,"messages");
});

test("tomorrow morning follows city calendar dates across midnight, DST and year boundaries",()=>{
  for(const [instant,zone,expected] of [
    ["2026-10-20T18:00:00Z","America/Boise","2026-10-21T13:00:00Z"],
    ["2026-03-07T20:00:00Z","America/Boise","2026-03-08T13:00:00Z"],
    ["2026-10-31T20:00:00Z","America/Boise","2026-11-01T14:00:00Z"],
    ["2026-12-31T23:00:00Z","Asia/Tokyo","2027-01-01T22:00:00Z"],
    ["2026-10-20T18:00:00Z","Pacific/Kiritimati","2026-10-21T17:00:00Z"],
  ])assert.equal(returnDeadline("morning",new Date(instant),zone),Date.parse(expected));
});

test("new settings migrate safely and reject invalid timer or retention values",()=>{
  assert.equal(restoreSettings({}).returnToDailyAt,0);
  assert.equal(restoreSettings({}).finalScoreHours,24);
  for(const value of [-1,NaN,Infinity,1.5,"tomorrow",8640000000000001])assert.throws(()=>restoreSettings({returnToDailyAt:value}));
  for(const value of [-1,1,25,Infinity,"24"])assert.throws(()=>restoreSettings({finalScoreHours:value}));
});

test("team directory resolves IDs rather than ESPN's ambiguous abbreviation aliases",()=>{
  assert.deepEqual(parseTeams({sports:[{leagues:[{teams:[{team:{id:"68",abbreviation:"BOIS",displayName:"Boise State"}}]}]}]}),[{id:"68",abbr:"BOIS",name:"Boise State"}]);
  assert.throws(()=>parseTeams({sports:[]}));
  assert.throws(()=>parseTeams({sports:[{leagues:[{teams:[{team:{abbreviation:"BOIS"}}]}]}]}));
});

test("team schedule normalization handles nested scores and finds the next future matchup",()=>{
  const event=(id:string,date:string,state="pre")=>({id,date,competitions:[{status:{type:{state,shortDetail:state==="post"?"Final":"Scheduled"}},competitors:[
    {team:{abbreviation:"NYY"},score:{value:0,displayValue:"0"},homeAway:"away"},
    {team:{abbreviation:"SEA"},score:{value:2,displayValue:"2"},homeAway:"home"},
  ]}]});
  const games=scheduleGames({events:[event("old","2026-10-19T17:00:00Z","post"),event("later","2026-10-24T17:00:00Z"),event("next","2026-10-21T17:00:00Z")]},"mlb","NYY",now);
  assert.deepEqual(games.map(game=>game.id),["next"]);
  assert.equal(games[0].teams[1].score,"2");
  assert.deepEqual(scheduleGames({events:[]},"mlb","NYY",now),[]);
  assert.throws(()=>scheduleGames({},"mlb","NYY",now));
  assert.throws(()=>scheduleGames({events:[event("wrong","2026-10-21T17:00:00Z")]},"mlb","DAL",now));
  assert.ok(gamePages(games[0],"America/Boise").status.join(" ").includes("OCT 21"));
});

test("off-season fallback checks remaining season phases and next-season preseason/regular games",()=>{
  assert.deepEqual(scheduleFallbacks({season:{year:2026,type:2}}),[
    "season=2026&seasontype=3","season=2027&seasontype=1","season=2027&seasontype=2",
  ]);
  assert.deepEqual(scheduleFallbacks({season:{year:2026,type:3}}),[
    "season=2027&seasontype=1","season=2027&seasontype=2",
  ]);
  assert.throws(()=>scheduleFallbacks({}));
  assert.throws(()=>scheduleFallbacks({season:{year:"2026",type:3}}));
});

test("unannounced start times stay TBD without inventing midnight or shifting the calendar day",()=>{
  const scheduled=game("tbd","pre","NYY","2027-02-19T05:00:00Z");
  const entry=gamePages({...scheduled,startTimeTbd:true},"America/Boise");
  assert.deepEqual(entry.status,["NEXT FEB 19 TIME TBD"]);
  const status=entry.status.join(" ");
  assert.ok(status.includes("FEB 19"));
  assert.ok(status.includes("TIME TBD"));
  assert.ok(!status.includes("PM")&&!status.includes("AM"));
});

test("upcoming game date and complete local start time fit together on one rotation page",()=>{
  const scheduled=game("start","pre","NYY","2026-10-24T00:00:00Z");
  assert.deepEqual(gamePages(scheduled,"America/Boise").status,["NEXT OCT 23 6:00 PM"]);
  for(const timezone of ["America/Boise","America/New_York","Europe/London","Asia/Kolkata","Pacific/Auckland"]){
    for(const date of ["2026-09-30T00:59:00Z","2026-12-31T12:59:00Z","2027-01-01T07:05:00Z"]){
      const entry=gamePages({...scheduled,date},timezone);
      assert.equal(entry.status.length,1);
      assert.ok(entry.status[0].length<=24);
      assert.match(entry.status[0],/^NEXT [A-Z]{3} \d{1,2} \d{1,2}:\d{2} [AP]M$/);
    }
  }
});

test("favorite fallback is per-team, deduplicated, local-date aware and never overrides live matchups",()=>{
  const upcoming=game("next","pre","NYY","2026-10-24T17:00:00Z"),dal=game("dal","pre","DAL","2026-10-25T17:00:00Z");
  assert.deepEqual(favoriteTeams(" nyy ,NYY, dal "),["NYY","DAL"]);
  const merged=favoriteAwareGames([game("live","in")],[upcoming,dal],[],"NYY,DAL",24,now);
  assert.deepEqual(orderGames(merged,"NYY,DAL",true).map(game=>game.id),["live","dal"]);
  assert.deepEqual(favoriteAwareGames([], [upcoming,upcoming],[],"NYY,SEA",24,now).map(game=>game.id),["next"]);
  assert.equal(favoriteAwareGames([], [game("past","pre")],[],"NYY",24,now).length,0);
  assert.deepEqual(favoriteAwareGames([game("other","in","BOS")],[upcoming],[],"",24,now).map(game=>game.id),["other"]);
});

test("finals survive reloads, do not restart on polls, expire exactly and reveal the next game",()=>{
  const final=game("final","post"),next=game("next","pre","NYY","2026-10-24T17:00:00Z");
  const saved=rememberFinals([],[final],"NYY",now);
  const restored=restoreFinalCache(JSON.parse(JSON.stringify({mlb:saved})),now).mlb!;
  const repolled=rememberFinals(restored,[final],"NYY",now+10000);
  assert.equal(repolled[0].observedAt,now);
  assert.deepEqual(favoriteAwareGames([], [next],repolled,"NYY",24,now+86400000-1).map(game=>game.id),["final"]);
  assert.deepEqual(favoriteAwareGames([final], [next],repolled,"NYY",24,now+86400000).map(game=>game.id),["next"]);
  assert.equal(favoriteAwareGames([final],[],repolled,"NYY",0,now).length,0);
  assert.equal(favoriteAwareGames([],[],repolled,"DAL",24,now).length,0);
  assert.equal(rememberFinals(repolled,[game("final","in")],"NYY",now).length,0);
  assert.throws(()=>restoreFinalCache({mlb:[{game:final,observedAt:"invalid"}]},now));
  assert.throws(()=>restoreFinalCache({mlb:[{game:final,observedAt:now+86400000}]},now));
});
