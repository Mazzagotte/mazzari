"use client";
import {useEffect,useRef,useState} from "react";
import {DEFAULTS,Settings,LEAGUES,LEAGUE_IDS,leagueLabel,type League} from "../lib/config";
import {X} from "lucide-react";
import {DisplaySettings,MessageSettings} from "./MessageSettings";
import Image from "next/image";
import {MakerWordmark} from "./MakerWordmark";
import {SettingsBackup} from "./SettingsBackup";
export function SettingsPanel({settings,onChange,onEnableSound,onClose,awakeStatus,onRetryAwake}:{settings:Settings;onChange:(next:Settings)=>void;onEnableSound:()=>void;onClose:()=>void;awakeStatus:string;onRetryAwake:()=>void}){
 const update=<K extends keyof Settings>(key:K,value:Settings[K])=>onChange({...settings,[key]:value});
 const [query,setQuery]=useState(""),[cities,setCities]=useState<{id:number;label:string;lat:number;lon:number;timezone?:string}[]>([]);
 const [searching,setSearching]=useState(false),[error,setError]=useState(""),[searched,setSearched]=useState(false);
 const [confirmReset,setConfirmReset]=useState(false);
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
   const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('summary, button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled), textarea:not(:disabled)')||[]).filter(control=>control.getClientRects().length>0);
   if(!controls?.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
 }}><header><div className="settings-identity"><Image src="/maker-mark.svg" width={32} height={32} alt=""/><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" className="icon-btn" onClick={onClose}><X/></button></header>
 <p className="settings-save-note">Changes save automatically in this browser.</p>
 <div className="settings-content">
 <details className="settings-section" open><summary>Display<span>Mode, clock &amp; layout</span></summary><div className="settings-section-body">
 <DisplaySettings settings={settings} onChange={onChange}/>
 <label className="check"><input type="checkbox" checked={settings.time24} onChange={e=>update("time24",e.target.checked)}/>24-hour clock</label><label className="check"><input type="checkbox" checked={settings.showSeconds} onChange={e=>update("showSeconds",e.target.checked)}/>Show seconds</label>
 <p className="hint">Game start times include AM/PM for clarity, in your selected city&apos;s timezone.</p>
 </div></details>
 <details className="settings-section"><summary>Location &amp; weather<span>{settings.city}</span></summary><div className="settings-section-body">
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
 <p className="hint">Timezone: {settings.timezone}. Used by the clock, game times and schedules.</p>
 <label>Temperature<select value={settings.unit} onChange={e=>update("unit",e.target.value as Settings["unit"])}><option value="fahrenheit">Fahrenheit °F</option><option value="celsius">Celsius °C</option></select></label>
 <label className="check"><input type="checkbox" checked={settings.showWeather} onChange={e=>update("showWeather",e.target.checked)}/>Current weather</label><label className="check"><input type="checkbox" checked={settings.showForecast} onChange={e=>update("showForecast",e.target.checked)}/>Today's forecast</label>
 </div></details>
 <details className="settings-section"><summary>Sports<span>{settings.leagues.length?settings.leagues.map(leagueLabel).join(" / "):"No leagues selected"}</span></summary><div className="settings-section-body">
 <p className="hint">Each league gets its own section. The complete board fits your screen without scrolling. More leagues mean smaller lettering, especially on phones.</p>
 <div className="league-options">{LEAGUE_IDS.map(league=><label className="check" key={league}><input type="checkbox" checked={settings.leagues.includes(league)} onChange={e=>update("leagues",LEAGUE_IDS.filter(id=>id===league?e.target.checked:settings.leagues.includes(id)))}/>{LEAGUES[league].name}</label>)}</div>
 <div className="two"><button className="reset" onClick={()=>update("leagues",[...LEAGUE_IDS])}>All leagues</button><button className="reset" onClick={()=>update("leagues",[])}>No sports</button></div>
 {settings.displayMode!=="daily"&&<p className="hint">Sports are paused in this display mode. Your selections stay saved.</p>}
 <h3>GAME DETAILS</h3>
 <label className="check"><input type="checkbox" checked={settings.favoritesOnly} onChange={e=>update("favoritesOnly",e.target.checked)}/>Favorites only</label>
 <p className="hint">Only shows your saved teams. When there is no current matchup or retained final, looks for their next scheduled game. No match means No favorite games, never unrelated teams.</p>
 <label>Keep favorite final scores<select value={settings.finalScoreHours} onChange={e=>update("finalScoreHours",Number(e.target.value))}><option value="0">Do not retain</option>{[6,12,24,48].map(hours=><option key={hours} value={hours}>{hours} hours</option>)}</select></label>
 <p className="hint">Favorites show their next scheduled game when there is no current matchup or retained final. Finals are kept from when this browser first sees them completed, including across reloads. Live favorite games take priority. Schedules depend on ESPN availability.</p>
 <label className="check"><input type="checkbox" checked={settings.essentialDetails} onChange={e=>update("essentialDetails",e.target.checked)}/>Essential game details only</label>
 <p className="hint">Keeps game situations and playoff context in up to three compact cards. Important moments repeat more often. Turn off to add selected game statistics and a final-game standout when available.</p>
 {settings.leagues.map(league=><LeagueFavorites key={league} league={league} value={settings.favoritesByLeague[league]} onChange={value=>update("favoritesByLeague",{...settings.favoritesByLeague,[league]:value})}/>)}
 </div></details>
 <details className="settings-section"><summary>Personal messages<span>{settings.messages.length?`${settings.messages.length} saved`:"Add a personal touch"}</span></summary><div className="settings-section-body"><MessageSettings settings={settings} onChange={onChange}/></div></details>
 <details className="settings-section"><summary>Screen &amp; sound<span>Evening, motion &amp; audio</span></summary><div className="settings-section-body">
 <h3>EVENING &amp; SCREEN</h3>
 <label className="check"><input type="checkbox" checked={settings.eveningDimming} onChange={e=>update("eveningDimming",e.target.checked)}/>Scheduled evening dimming</label>
 {settings.eveningDimming&&<>
 <div className="two"><label>Dim from<input type="time" value={settings.eveningStart} onChange={e=>{if(e.target.value)update("eveningStart",e.target.value)}}/></label><label>Dim until<input type="time" value={settings.eveningEnd} onChange={e=>{if(e.target.value)update("eveningEnd",e.target.value)}}/></label></div>
 <label>Evening brightness · {Math.round(settings.eveningBrightness*100)}%<input type="range" min=".2" max=".8" step=".05" value={settings.eveningBrightness} onChange={e=>update("eveningBrightness",Number(e.target.value))}/></label>
 <p className="hint">Uses your city&apos;s local time, including overnight windows. Equal times dim all day. Evening mode also mutes sound; Settings and controls stay at normal brightness.</p>
 </>}
 <label className="check"><input type="checkbox" checked={settings.keepAwake} onChange={e=>update("keepAwake",e.target.checked)}/>Keep screen awake</label>
 {settings.keepAwake&&<><p className="hint" role="status">{awakeStatus}</p><button className="reset" onClick={onRetryAwake}>Retry screen awake</button><p className="hint">Requires a supported browser and a visible display. Power-saving settings may override it. This does not prevent screen burn-in.</p></>}
 <h3>SOUND & MOTION</h3><label className="check"><input type="checkbox" checked={settings.sound} onChange={e=>{if(e.target.checked)onEnableSound();update("sound",e.target.checked)}}/>Mechanical sound</label>
 <label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={e=>update("reducedMotion",e.target.checked)}/>Reduced motion</label><p className="hint">System reduced-motion preferences are also respected. Reduced motion disables flap animation and click sounds.</p>
 <label className="check"><input type="checkbox" checked={settings.quietHours} onChange={e=>update("quietHours",e.target.checked)}/>Quiet hours</label>
 {settings.quietHours&&<><div className="two"><label>Quiet start<input type="time" required value={settings.quietStart} onChange={e=>{if(e.target.value)update("quietStart",e.target.value)}}/></label><label>Quiet end<input type="time" required value={settings.quietEnd} onChange={e=>{if(e.target.value)update("quietEnd",e.target.value)}}/></label></div><p className="hint">Uses the selected board timezone. Equal start and end times mute all day.</p></>}
 <label>Volume · {Math.round(settings.volume*100)}%<input type="range" min="0" max="1" step="0.05" disabled={!settings.sound||settings.reducedMotion} value={settings.volume} onChange={e=>update("volume",Number(e.target.value))}/></label>
 <label>Animation speed · {settings.speed} ms per step<input type="range" min="40" max="180" step="5" disabled={settings.reducedMotion} value={220-settings.speed} onChange={e=>update("speed",220-Number(e.target.value))}/><span className="range-captions"><span>Slower</span><span>Faster</span></span></label>
 </div></details>
 <details className="settings-section"><summary>Backup &amp; reset<span>Transfer or restore preferences</span></summary><div className="settings-section-body">
 <SettingsBackup settings={settings} onChange={onChange}/>
 <div className="settings-reset"><h3>RESET THIS BROWSER</h3><p className="hint">Restoring defaults removes your saved messages, favorite teams and display preferences. Export a backup first if you want to keep them.</p>
 {!confirmReset?<button className="reset" onClick={()=>setConfirmReset(true)}>Restore defaults...</button>:<div className="backup-confirm" role="group" aria-label="Confirm restoring defaults"><p className="hint">Replace your settings with the defaults? This cannot be undone without a backup.</p><div className="two"><button className="reset" onClick={()=>{onChange({...DEFAULTS,leagues:[...DEFAULTS.leagues],favoritesByLeague:{...DEFAULTS.favoritesByLeague},messages:[]});setConfirmReset(false)}}>Confirm reset</button><button className="reset" onClick={()=>setConfirmReset(false)}>Cancel reset</button></div></div>}
 </div><p className="hint">Each browser, kiosk profile and website address has separate preferences. No account is required.</p>
 </div></details>
 <section className="maker-about" aria-labelledby="maker-about-title"><h3 id="maker-about-title">ABOUT</h3><MakerWordmark/><p>MAZZARI No. 1</p><p className="hint">A personal information instrument.<br/>Designed by Mazzagotte.dev.</p></section>
 </div></aside></div>
}

function LeagueFavorites({league,value,onChange}:{league:League;value:string;onChange:(value:string)=>void}){
 const [teams,setTeams]=useState<{abbr:string;name:string}[]>([]),[error,setError]=useState("");
 const [filter,setFilter]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  fetch(`/api/teams?league=${league}`,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error("Team list is unavailable. Enter abbreviations manually.");
   const data=await response.json();
   if(!Array.isArray(data.teams)||!data.teams.every((team:unknown)=>team!==null&&typeof team==="object"&&"abbr" in team&&typeof team.abbr==="string"&&"name" in team&&typeof team.name==="string"))throw new Error("Invalid team list. Enter abbreviations manually.");
   setTeams(data.teams);
  }).catch(error=>{if(!controller.signal.aborted){console.error(error);setError(error.message)}});
  return()=>controller.abort();
 },[league]);
 const favorites=Array.from(new Set(value.toUpperCase().split(",").map(team=>team.trim()).filter(Boolean)));
 const matches=teams.filter(team=>`${team.name} ${team.abbr}`.toLowerCase().includes(filter.trim().toLowerCase()));
 return <details className="favorite-section"><summary>{LEAGUES[league].name} favorites<span>{favorites.length?favorites.join(", "):"No favorites selected"}</span></summary>
 <p className="hint">Selections stay saved when this league is turned off.</p>
 {!error&&!!teams.length&&<label>Find {leagueLabel(league)} teams<input type="search" placeholder="Team name or abbreviation" value={filter} onChange={e=>setFilter(e.target.value)}/></label>}
 <fieldset className="team-picker"><legend>{LEAGUES[league].name} teams</legend>
 {error?<p role="alert" className="hint">{error}</p>:!teams.length?<p className="hint" role="status">Loading teams...</p>:matches.length?matches.map(team=><label className="check" key={team.abbr}><input type="checkbox" checked={favorites.includes(team.abbr.toUpperCase())} onChange={e=>onChange((e.target.checked?[...favorites,team.abbr.toUpperCase()]:favorites.filter(abbr=>abbr!==team.abbr.toUpperCase())).join(", "))}/>{team.name} ({team.abbr})</label>):<p className="hint" role="status">No teams match your search.</p>}
 </fieldset>
 <details className="settings-help" open={!!error}><summary>Enter abbreviations manually</summary><label>{leagueLabel(league)} favorite abbreviations<input placeholder="Comma-separated abbreviations" value={value} onChange={e=>onChange(e.target.value.toUpperCase())}/></label><p className="hint">Use ESPN team abbreviations separated by commas. Manual entry is available if the team list cannot load.</p></details></details>;
}
