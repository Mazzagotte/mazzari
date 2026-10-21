"use client";
import {useRef,useState} from "react";
import type {Settings} from "../lib/config";
import {exportSettings,importSettings} from "../lib/settingsBackup";
import {applyMessageReturn} from "../lib/messageReturn";

export function SettingsBackup({settings,onChange}:{settings:Settings;onChange:(next:Settings)=>void}) {
  const input=useRef<HTMLInputElement>(null);
  const [pending,setPending]=useState<Settings|null>(null),[status,setStatus]=useState(""),[error,setError]=useState("");
  const [reading,setReading]=useState(false);
  const exportFile=()=>{
    setError("");setStatus("");
    try{
      const blob=new Blob([exportSettings(settings)],{type:"application/json"});
      const url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download=`mazzari-settings-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      setStatus("Backup download requested. Keep this file private: it includes your messages, drawings, scheduled cards and location.");
    }catch(error){console.error("Settings export failed",error);setError("Settings could not be exported.");}
  };
  return <section>
    <h3>BACKUP & RESTORE</h3>
    <p className="hint">Transfer your city, teams, messages, drawings, saved cards, surprise schedules and preferences between browsers, including your separate kiosk profile. Backups contain personal information. Live feeds and saved final scores are not included.</p>
    <div className="two"><button className="reset" onClick={exportFile}>Export settings</button><button className="reset" disabled={reading} onClick={()=>input.current?.click()}>{reading?"Reading backup...":"Import settings"}</button></div>
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Settings backup file" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value="";
      if(!file)return;
      setPending(null);setStatus("");setError("");setReading(true);
      try{
        if(file.size>1024*1024)throw new Error("Backup is too large. Choose a file smaller than 1 MB.");
        setPending(importSettings(await file.text()));
      }catch(error){console.error("Settings import failed",error);setError(error instanceof Error?error.message:"Backup could not be read.");}
      finally{setReading(false);}
    }}/>
    {pending&&<div className="backup-confirm">
      <p className="hint">Replace this browser&apos;s settings with the backup for {pending.city}? It contains {pending.messages.length} personal messages, {pending.cards.length} saved cards, a drawing and {pending.leagues.length} enabled leagues. An expired Message or Drawing board return timer returns to Daily board immediately. Active surprise schedules resume for their remaining duration; expired surprises are not replayed.</p>
      <div className="two"><button className="reset" onClick={()=>{onChange(applyMessageReturn(pending,Date.now()));setPending(null);setStatus("Backup restored in this browser.");}}>Replace settings</button><button className="reset" onClick={()=>setPending(null)}>Cancel import</button></div>
    </div>}
    {error&&<p role="alert" className="hint">{error}</p>}
    {status&&<p role="status" className="hint">{status}</p>}
  </section>;
}
