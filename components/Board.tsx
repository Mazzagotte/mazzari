"use client";
import {memo} from "react";
import {Flap} from "./Flap";
export const COLS=24;
function fmt(input:string){const upper=input.toUpperCase().replace(/[^ A-Z0-9:.-/+!?%°]/g," ");return upper.slice(0,COLS).padEnd(COLS," ")}
function BoardComponent({lines,speed,onFlip,reducedMotion,sectionStarts=[],emphasizeClock=false}:{lines:string[];speed:number;onFlip:()=>void;reducedMotion:boolean;sectionStarts?:number[];emphasizeClock?:boolean}){
 const rows=lines.map((_,index)=>`minmax(0, ${emphasizeClock&&index===0?1.35:1}fr)`).join(" ");
 return <div className="board" role="img" aria-label={lines.filter(Boolean).join(" | ")}><div className="board-inner" aria-hidden="true" style={{gridTemplateRows:rows}}>{lines.map((line,r)=><div className={`flap-row${r>0&&sectionStarts.includes(r)?" section-start":""}${emphasizeClock&&r===0?" clock-row":""}`} key={r}>{[...fmt(line)].map((char,c)=><Flap key={`${r}-${c}`} char={char} speed={speed} onFlip={onFlip} reducedMotion={reducedMotion} delay={c*18}/>)}</div>)}</div></div>;
}
export const Board=memo(BoardComponent);
