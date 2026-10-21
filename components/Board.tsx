"use client";
import {memo,type CSSProperties} from "react";
import {Flap} from "./Flap";
import {boardCells,MAX_COLUMNS} from "../lib/boardLayout";
import {revealDelay,type Reveal} from "../lib/drawing";
function BoardComponent({lines,columns=MAX_COLUMNS,speed,onFlip,reducedMotion,sectionStarts=[],emphasizeClock=false,pixels,description,reveal="sweep",artSource}:{lines:string[];columns?:number;speed:number;onFlip:()=>void;reducedMotion:boolean;sectionStarts?:number[];emphasizeClock?:boolean;pixels?:boolean[][];description?:string;reveal?:Reveal;artSource?:string[]}){
 const rows=lines.map((_,index)=>`minmax(0, ${emphasizeClock&&index===0?1.35:1}fr)`).join(" ");
 const style:CSSProperties & {"--board-columns":number;"--flap-font":string;"--clock-font":string}={
  "--board-columns":columns,"--flap-font":`${2.8*MAX_COLUMNS/columns}cqw`,"--clock-font":`${3.35*MAX_COLUMNS/columns}cqw`,
 };
 return <div className="board" role="img" aria-label={description||lines.filter(Boolean).join(" | ")} style={style}><div className="board-inner" aria-hidden="true" style={{gridTemplateRows:rows}}>{lines.map((line,r)=>{
  const cells=boardCells(line,columns);
  return <div className={`flap-row${r>0&&sectionStarts.includes(r)?" section-start":""}${emphasizeClock&&r===0?" clock-row":""}`} key={r}>{Array.from({length:columns},(_,c)=><Flap key={`${r}-${c}`} char={pixels?.[r]?.[c]?"#":cells[c]||" "} speed={speed} onFlip={onFlip} reducedMotion={reducedMotion} delay={artSource?revealDelay(reveal,r,c,artSource):c*18}/>)}</div>;
 })}</div></div>;
}
export const Board=memo(BoardComponent);
