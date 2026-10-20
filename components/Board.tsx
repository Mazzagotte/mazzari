"use client";
import {memo,type CSSProperties} from "react";
import {Flap} from "./Flap";
import {boardText,MAX_COLUMNS} from "../lib/boardLayout";
function BoardComponent({lines,columns=MAX_COLUMNS,speed,onFlip,reducedMotion,sectionStarts=[],emphasizeClock=false}:{lines:string[];columns?:number;speed:number;onFlip:()=>void;reducedMotion:boolean;sectionStarts?:number[];emphasizeClock?:boolean}){
 const rows=lines.map((_,index)=>`minmax(0, ${emphasizeClock&&index===0?1.35:1}fr)`).join(" ");
 const style:CSSProperties & {"--board-columns":number;"--flap-font":string;"--clock-font":string}={
  "--board-columns":columns,"--flap-font":`${2.8*MAX_COLUMNS/columns}cqw`,"--clock-font":`${3.35*MAX_COLUMNS/columns}cqw`,
 };
 return <div className="board" role="img" aria-label={lines.filter(Boolean).join(" | ")} style={style}><div className="board-inner" aria-hidden="true" style={{gridTemplateRows:rows}}>{lines.map((line,r)=><div className={`flap-row${r>0&&sectionStarts.includes(r)?" section-start":""}${emphasizeClock&&r===0?" clock-row":""}`} key={r}>{[...boardText(line).padEnd(columns," ")].map((char,c)=><Flap key={`${r}-${c}`} char={char} speed={speed} onFlip={onFlip} reducedMotion={reducedMotion} delay={c*18}/>)}</div>)}</div></div>;
}
export const Board=memo(BoardComponent);
