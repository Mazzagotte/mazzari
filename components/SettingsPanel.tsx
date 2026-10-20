"use client";
import {useEffect,useRef,useState} from "react";
import {DEFAULTS,Settings,LEAGUES,LEAGUE_IDS,leagueLabel,type League} from "../lib/config";
import {X} from "lucide-react";
import {MessageSettings} from "./MessageSettings";
import Image from "next/image";
import {MakerWordmark} from "./MakerWordmark";
import {SettingsBackup} from "./SettingsBackup";
export function SettingsPanel({settings,onChange,onClose,awakeStatus,onRetryAwake}:{settings:Settings;onChange:(next:Settings)=>void;onClose:()=>void;awakeStatus:string;onRetryAwake:()=>void}){
 const update=<K extends keyof Settings>(key:K,value:Settings[K])=>onChange({...settings,[key]:value});
 const [query,setQuery]=useState(""),[cities,setCities]=useState<{id:number;label:string;lat:number;lon:number;timezone?:string}[]>([]);
 const [searching,setSearching]=useState(false),[error,setError]=useState(""),[searched,setSearched]=useState(false);
 const dialog=useRef<HTMLElement>(null);
 const searchController=useRef<AbortController|null>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  return()=>{searchController.current?.abort();previous?.focus()};
 },[]);
 const search=async()=>{
  searchController.current?.abort();
  const controller=new AbortController();searchController.current=controller;
  setSearching(true);setError("");setCities([]);setSearched(false);
  try{
   const response=await fetch(`/api/cities?q=${encodeURIComponent(query)}`,{signal:controller.signal});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"City search failed.");
   setCities(data.cities);setSearched(true);
  }catch(error){if(!controller.signal.aborted){console.error(error);setError(error instanceof Error?error.message:"City search failed.")}}
  finally{if(!controller.signal.aborted)setSearching(false)}
 };
 return <div className="settings-shade" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside ref={dialog} className="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={e=>{
  if(e.key==="Escape"){e.stopPropagation();onClose()}
  if(e.key==="Tab"){
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled)')||[]).filter(control=>control.getClientRects().length>0);
   if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 }}><header><div className="settings-identity"><Image src="/maker-mark.svg" width={32} height={32} alt=""/><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" className="icon-btn" onClick={onClose}><X/></button></header>
 <div className="settings-content"><MessageSettings settings={settings} onChange={onChange}/><h3>LOCATION</h3>
 <p className="selected-city" aria-live="polite">{settings.city}</p>
 <form onSubmit={e=>{e.preventDefault();void search()}}><label>Find a city<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Boise, London, Tokyo..." minLength={2} maxLength={100} required/></label><button className="reset" type="submit" disabled={searching}>{searching?"Searching...":"Search cities"}</button></form>
 {error&&<p role="alert" className="hint">{error}</p>}
 {searched&&!cities.length&&<p role="status" className="hint">No matching cities found.</p>}
 <div className="city-results">{cities.map(city=><button key={city.id} onClick={()=>{
  if(!city.timezone){setError("This city has no timezone information. Please choose another result.");return}
  try{new Intl.DateTimeFormat("en-US",{timeZone:city.timezone}).format()}
  catch(error){console.error(error);setError("This city's timezone is not supported. Please choose another result.");return}
  onChange({...settings,city:city.label,lat:city.lat,lon:city.lon,timezone:city.timezone});setCities([]);setSearched(false);setQuery("");setError("");
 }}>{city.label}</button>)}</div>
 <p className="hint">Choose a city to set weather and local time automatically.</p>
 <h3>TIME & WEATHER</h3>
 <label>Temperature<select value={settings.unit} onChange={e=>update("unit",e.target.value as Settings["unit"])}><option value="fahrenheit">Fahrenheit °F</option><option value="celsius">Celsius °C</option></select></label>
 <label className="check"><input type="checkbox" checked={settings.time24} onChange={e=>update("time24",e.target.checked)}/>24-hour clock</label><label className="check"><input type="checkbox" checked={settings.showSeconds} onChange={e=>update("showSeconds",e.target.checked)}/>Show seconds</label>
 <label className="check"><input type="checkbox" checked={settings.showWeather} onChange={e=>update("showWeather",e.target.checked)}/>Current weather</label><label className="check"><input type="checkbox" checked={settings.showForecast} onChange={e=>update("showForecast",e.target.checked)}/>Today's forecast</label>
 <h3>SPORTS LEAGUES</h3><p className="hint">Select any combination, or none. Each selected league gets its own visible scoreboard. Games rotate within each league; selecting more leagues makes the board text smaller.</p>
 <label className="check"><input type="checkbox" checked={settings.favoritesOnly} onChange={e=>update("favoritesOnly",e.target.checked)}/>Favorites only</label>
 <p className="hint">Uses your saved teams for each league. If none are on the scoreboard, shows No favorite games. Select teams below for each enabled league.</p>
 <label>Keep favorite final scores<select value={settings.finalScoreHours} onChange={e=>update("finalScoreHours",Number(e.target.value))}><option value="0">Do not retain</option>{[6,12,24,48].map(hours=><option key={hours} value={hours}>{hours} hours</option>)}</select></label>
 <p className="hint">Favorites show their next scheduled game when there is no current matchup or retained final. Finals are kept from when this browser first sees them completed, including across reloads. Live favorite games take priority. Schedules depend on ESPN availability.</p>
 <label className="check"><input type="checkbox" checked={settings.essentialDetails} onChange={e=>update("essentialDetails",e.target.checked)}/>Essential game details only</label>
 <p className="hint">Keeps the clock, down/distance, possession, baseball count/outs/runners, and power-play information. Turn off to include extra game statistics and last-play descriptions.</p>
 {LEAGUE_IDS.map(league=><label className="check" key={league}><input type="checkbox" checked={settings.leagues.includes(league)} onChange={e=>update("leagues",LEAGUE_IDS.filter(id=>id===league?e.target.checked:settings.leagues.includes(id)))}/>{LEAGUES[league].name}</label>)}
 <div className="two"><button className="reset" onClick={()=>update("leagues",[...LEAGUE_IDS])}>All leagues</button><button className="reset" onClick={()=>update("leagues",[])}>No sports</button></div>
 {settings.leagues.map(league=><LeagueFavorites key={league} league={league} value={settings.favoritesByLeague[league]} onChange={value=>update("favoritesByLeague",{...settings.favoritesByLeague,[league]:value})}/>)}
 <h3>EVENING & SCREEN</h3>
 <label className="check"><input type="checkbox" checked={settings.eveningDimming} onChange={e=>update("eveningDimming",e.target.checked)}/>Scheduled evening dimming</label>
 {settings.eveningDimming&&<>
 <div className="two"><label>Dim from<input type="time" value={settings.eveningStart} onChange={e=>{if(e.target.value)update("eveningStart",e.target.value)}}/></label><label>Dim until<input type="time" value={settings.eveningEnd} onChange={e=>{if(e.target.value)update("eveningEnd",e.target.value)}}/></label></div>
 <label>Evening brightness · {Math.round(settings.eveningBrightness*100)}%<input type="range" min=".2" max=".8" step=".05" value={settings.eveningBrightness} onChange={e=>update("eveningBrightness",Number(e.target.value))}/></label>
 <p className="hint">Uses your city&apos;s local time, including overnight windows. Equal times dim all day. Evening mode also mutes sound; Settings and controls stay at normal brightness.</p>
 </>}
 <label className="check"><input type="checkbox" checked={settings.keepAwake} onChange={e=>update("keepAwake",e.target.checked)}/>Keep screen awake</label>
 {settings.keepAwake&&<><p className="hint" role="status">{awakeStatus}</p><button className="reset" onClick={onRetryAwake}>Retry screen awake</button><p className="hint">Requires a supported browser and a visible display. Power-saving settings may override it. This does not prevent screen burn-in.</p></>}
 <h3>SOUND & MOTION</h3><label className="check"><input type="checkbox" checked={settings.sound} onChange={e=>update("sound",e.target.checked)}/>Mechanical sound</label>
 <label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={e=>update("reducedMotion",e.target.checked)}/>Reduced motion</label><p className="hint">System reduced-motion preferences are also respected. Reduced motion disables flap animation and click sounds.</p>
 <label className="check"><input type="checkbox" checked={settings.quietHours} onChange={e=>update("quietHours",e.target.checked)}/>Quiet hours</label>
 {settings.quietHours&&<><div className="two"><label>Quiet start<input type="time" required value={settings.quietStart} onChange={e=>{if(e.target.value)update("quietStart",e.target.value)}}/></label><label>Quiet end<input type="time" required value={settings.quietEnd} onChange={e=>{if(e.target.value)update("quietEnd",e.target.value)}}/></label></div><p className="hint">Uses the selected board timezone. Equal start and end times mute all day.</p></>}
 <label>Volume · {Math.round(settings.volume*100)}%<input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={e=>update("volume",Number(e.target.value))}/></label>
 <label>Animation speed<input type="range" min="40" max="180" step="5" value={220-settings.speed} onChange={e=>update("speed",220-Number(e.target.value))}/></label>
 <SettingsBackup settings={settings} onChange={onChange}/>
 <button className="reset" onClick={()=>onChange({...DEFAULTS})}>Restore defaults</button><p className="hint">Settings stay in this browser. The board can be viewed without signing in.</p>
 <section className="maker-about" aria-labelledby="maker-about-title"><h3 id="maker-about-title">ABOUT</h3><MakerWordmark/><p>MAZZARI No. 1</p><p className="hint">A personal information instrument.<br/>Designed by Mazzagotte.dev.</p></section>
 </div></aside></div>
}

function LeagueFavorites({league,value,onChange}:{league:League;value:string;onChange:(value:string)=>void}){
 const [teams,setTeams]=useState<{abbr:string;name:string}[]>([]),[error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`/api/teams?league=${league}`,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error("Team list is unavailable. Enter abbreviations manually.");
   const data=await response.json();
   if(!Array.isArray(data.teams))throw new Error("Invalid team list. Enter abbreviations manually.");
   setTeams(data.teams);
  }).catch(error=>{if(!controller.signal.aborted){console.error(error);setError(error.message)}});
  return()=>controller.abort();
 },[league]);
 const favorites=value.split(",").map(team=>team.trim()).filter(Boolean);
 return <section><fieldset className="team-picker"><legend>{LEAGUES[league].name} favorites</legend>
 {error?<p role="alert" className="hint">{error}</p>:!teams.length?<p className="hint">Loading teams...</p>:teams.map(team=><label className="check" key={team.abbr}><input type="checkbox" checked={favorites.includes(team.abbr)} onChange={e=>onChange((e.target.checked?[...favorites,team.abbr]:favorites.filter(abbr=>abbr!==team.abbr)).join(", "))}/>{team.name} ({team.abbr})</label>)}
 </fieldset><label>{leagueLabel(league)} favorite abbreviations<input placeholder="Comma-separated abbreviations" value={value} onChange={e=>onChange(e.target.value.toUpperCase())}/></label></section>;
}
