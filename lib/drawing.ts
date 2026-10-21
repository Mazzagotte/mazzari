import {boardCells} from "./boardLayout.ts";
import {validExpiration} from "./messages.ts";

export const DRAWING_COLUMNS=32;
export const DRAWING_ROWS=20;
export const CAPTION_LIMIT=24;
export type Reveal="sweep"|"center"|"outline";
export type DrawingDate={kind:"countdown"|"anniversary";date:string;label:string};
export type Drawing={pixels:string[];caption:string;signature?:string;style?:"solid"|"outline";reveal?:Reveal;occasion?:DrawingDate};
type Shape=(x:number,y:number)=>boolean;

function raster(shape:Shape):string[] {
  return Array.from({length:DRAWING_ROWS},(_,r)=>
    Array.from({length:DRAWING_COLUMNS},(_,c)=>shape(c+.5,r+.5)?"1":"0").join(""));
}

function ellipse(x:number,y:number,cx:number,cy:number,rx:number,ry=rx):boolean {
  return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
}

function line(x:number,y:number,x1:number,y1:number,x2:number,y2:number,width=1):boolean {
  const dx=x2-x1,dy=y2-y1;
  const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-x1-t*dx,y-y1-t*dy)<=width/2;
}

function polygon(points:readonly (readonly [number,number])[]):Shape {
  return (x,y)=>{
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [xi,yi]=points[i],[xj,yj]=points[j];
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  };
}

function heart(x:number,y:number):boolean {
  const nx=(x-16)/12,ny=(10-y)/8;
  return (nx*nx+ny*ny-1)**3-nx*nx*ny**3<=0;
}

export function heartDrawing():Drawing {
  return {pixels:raster(heart),caption:""};
}

const star=polygon(Array.from({length:10},(_,i)=>{
  const angle=-Math.PI/2+i*Math.PI/5,radius=i%2?4:9;
  return [16+Math.cos(angle)*radius,10+Math.sin(angle)*radius] as const;
}));
const catHead=polygon([[7,10],[6,2],[12,5],[20,5],[26,2],[25,10],[25,14],[22,18],[10,18],[7,14]]);

export const DRAWING_TEMPLATES=[
  {id:"heart",label:"Heart",pixels:heartDrawing().pixels},
  {id:"smiley",label:"Smiley face",pixels:raster((x,y)=>{
    const radius=Math.hypot(x-16,y-10);
    return (radius>=8&&radius<=9)||
      ellipse(x,y,12.5,7,1,1.5)||ellipse(x,y,19.5,7,1,1.5)||
      (y>=11.5&&radius>=5&&radius<=6);
  })},
  {id:"star",label:"Star",pixels:raster(star)},
  {id:"flower",label:"Flower",pixels:raster((x,y)=>{
    const center=ellipse(x,y,16,7.5,2);
    const petals=Array.from({length:6},(_,i)=>{
      const angle=i*Math.PI/3;
      return ellipse(x,y,16+Math.cos(angle)*4,7.5+Math.sin(angle)*4,3);
    }).some(Boolean);
    return (petals&&!ellipse(x,y,16,7.5,2.8))||center||
      line(x,y,16,13,16,19,1.5)||
      ellipse(x,y,12.5,15,3,1.3)||ellipse(x,y,19.5,17,3,1.3);
  })},
  {id:"butterfly",label:"Butterfly",pixels:raster((x,y)=>{
    const wings=ellipse(x,y,9,7,6,5)||ellipse(x,y,23,7,6,5)||
      ellipse(x,y,11,14.5,4.5,3.5)||ellipse(x,y,21,14.5,4.5,3.5);
    const spots=ellipse(x,y,8.5,6.5,2,1.5)||ellipse(x,y,23.5,6.5,2,1.5)||
      ellipse(x,y,10.5,14.5,1.5)||ellipse(x,y,21.5,14.5,1.5);
    return (wings&&!spots)||ellipse(x,y,16,11,1,7)||
      line(x,y,16,5,13,1)||line(x,y,16,5,19,1);
  })},
  {id:"coffee",label:"Coffee cup",pixels:raster((x,y)=>{
    const cup=(x>=6&&x<=23&&y>=8&&y<=12)||ellipse(x,y,14.5,12,8.5,5);
    const inside=(x>=7.5&&x<=21.5&&y>=9.5&&y<=12)||ellipse(x,y,14.5,12,7,3.5);
    const handle=ellipse(x,y,24,11,4,3)&&!ellipse(x,y,24,11,2.5,1.5);
    const steam=[10,15,20].some(cx=>y>=1&&y<=6&&Math.abs(x-cx-Math.sin(y*1.3))<.65);
    return (cup&&!inside)||handle||steam||line(x,y,5,18.5,26,18.5,1.5);
  })},
  {id:"letter",label:"Love letter",pixels:raster((x,y)=>{
    const border=(x>=3&&x<=29&&y>=4&&y<=18)&&
      (x<4.3||x>27.7||y<5.3||y>16.7);
    const seal=heart(16+(x-16)*4,10+(y-10)*4);
    const fold=line(x,y,4,5,16,12)||line(x,y,28,5,16,12)||
      line(x,y,4,17,11,11)||line(x,y,28,17,21,11);
    return border||seal||fold;
  })},
  {id:"cat",label:"Cat",pixels:raster((x,y)=>{
    const outline=catHead(x,y)&&(!catHead(x-1.2,y)||!catHead(x+1.2,y)||
      !catHead(x,y-1.2)||!catHead(x,y+1.2));
    const eyes=ellipse(x,y,12,9,1,1.5)||ellipse(x,y,20,9,1,1.5);
    const nose=polygon([[14.5,12],[17.5,12],[16,13.5]])(x,y);
    return outline||eyes||nose||line(x,y,16,13,14,15)||line(x,y,16,13,18,15)||
      line(x,y,10,12,2,10.5)||line(x,y,10,13.5,2,14.5)||
      line(x,y,22,12,30,10.5)||line(x,y,22,13.5,30,14.5);
  })},
] as const;

export function isDrawing(value:unknown):value is Drawing {
  if(!value||typeof value!=="object"||!("pixels" in value)||!("caption" in value))return false;
  if(!Array.isArray(value.pixels))return false;
  const columns=value.pixels.length===10?16:DRAWING_COLUMNS;
  return (value.pixels.length===10||value.pixels.length===DRAWING_ROWS)&&
    value.pixels.every(row=>typeof row==="string"&&row.length===columns&&/^[01]+$/.test(row))&&
    typeof value.caption==="string"&&value.caption.length<=CAPTION_LIMIT&&
    (!("signature" in value)||(typeof value.signature==="string"&&value.signature.length<=CAPTION_LIMIT))&&
    (!("style" in value)||value.style==="solid"||value.style==="outline")&&
    (!("reveal" in value)||value.reveal==="sweep"||value.reveal==="center"||value.reveal==="outline")&&
    (!("occasion" in value)||isDrawingDate(value.occasion));
}

function isDrawingDate(value:unknown):value is DrawingDate {
  return !!value&&typeof value==="object"&&"kind" in value&&(value.kind==="countdown"||value.kind==="anniversary")&&
    "date" in value&&typeof value.date==="string"&&!!value.date&&validExpiration(value.date)&&
    "label" in value&&typeof value.label==="string"&&value.label.length<=CAPTION_LIMIT;
}

export function upgradeDrawing(drawing:Drawing):Drawing {
  const pixels=drawing.pixels.length===10?
    drawing.pixels.flatMap(row=>{
      const enlarged=[...row].map(cell=>cell.repeat(2)).join("");
      return [enlarged,enlarged];
    }):[...drawing.pixels];
  return {...drawing,pixels,...(drawing.occasion?{occasion:{...drawing.occasion}}:{})};
}

export function outlinePixels(pixels:readonly string[]):string[] {
  return pixels.map((row,r)=>[...row].map((cell,c)=>cell==="1"&&
    [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([y,x])=>pixels[y]?.[x]!=="1")?"1":"0").join(""));
}

export function localDate(now:Date,zone:string):string {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=(type:string)=>parts.find(item=>item.type===type)!.value;
  return `${part("year").padStart(4,"0")}-${part("month")}-${part("day")}`;
}

export function occasionLines(occasion:DrawingDate,now:Date,zone:string):string[] {
  const today=localDate(now,zone);
  const days=Math.round((Date.parse(`${occasion.date}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
  let text:string;
  if(occasion.kind==="anniversary"&&days<=0){
    const years=Number(today.slice(0,4))-Number(occasion.date.slice(0,4))-(today.slice(5)<occasion.date.slice(5)?1:0);
    text=`${years} ${years===1?"YEAR":"YEARS"} TOGETHER`;
  }else if(days===0)text="TODAY IS THE DAY";
  else text=`${Math.abs(days)} ${Math.abs(days)===1?"DAY":"DAYS"} ${days>0?"UNTIL":"SINCE"}`;
  return [text,...(occasion.label.trim()?[occasion.label]:[])];
}

export function revealDelay(reveal:Reveal,r:number,c:number,pixels:readonly string[]):number {
  if(reveal==="center")return Math.round(Math.hypot((c-15.5)*.65,r-9.5)*55);
  if(reveal==="outline"){
    const edge=pixels[r]?.[c]==="1"&&[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].some(([y,x])=>pixels[y]?.[x]!=="1");
    return (edge?0:650)+c*15;
  }
  return c*24;
}

export function drawingLayout(drawing:Drawing,now=new Date(),zone="UTC") {
  const source=drawing.style==="outline"?outlinePixels(drawing.pixels):drawing.pixels;
  const pixels=source.map(row=>[...row].map(cell=>cell==="1"));
  const lines=drawing.pixels.map(()=>" ".repeat(DRAWING_COLUMNS));
  const text=[drawing.caption,...(drawing.occasion?occasionLines(drawing.occasion,now,zone):[]),
    drawing.signature?`- ${drawing.signature}`:""].map(line=>boardCells(line.replace(/[\r\n]/g," "),DRAWING_COLUMNS)).filter(cells=>cells.length);
  if(text.length){
    lines.push(" ".repeat(DRAWING_COLUMNS),...text.map(cells=>" ".repeat(Math.floor((DRAWING_COLUMNS-cells.length)/2))+cells.join("")));
  }
  return {lines,columns:DRAWING_COLUMNS,sectionStarts:[],pixels,source};
}
