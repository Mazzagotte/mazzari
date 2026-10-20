import {NextRequest,NextResponse} from "next/server";
import {LEAGUES, type League} from "../../../lib/config";
import {normalizeGame} from "../../../lib/scores";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const league=request.nextUrl.searchParams.get("league") || "mlb";
 if(!Object.hasOwn(LEAGUES,league))return NextResponse.json({error:"Invalid league"},{status:400});
 const {sport,code}=LEAGUES[league as League];
 const url=`https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/scoreboard?limit=100${league==="ncaaf"?"&groups=80":""}`;
 try {const response=await fetch(url,{next:{revalidate:30},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(String(response.status));const json=await response.json();
 if(!Array.isArray(json.events))throw new Error("Invalid scoreboard response");
 const games=json.events.map((event:unknown)=>normalizeGame(event,league as League));
 const summaryBudget=AbortSignal.timeout(5000);
 let next=0;
 async function enrichLiveGames(){
  while(next<games.length){
   const index=next++;
   if(games[index].state!=="in")continue;
   try{
    summaryBudget.throwIfAborted();
    const summary=await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${code}/summary?event=${encodeURIComponent(games[index].id)}`,{next:{revalidate:30},signal:AbortSignal.any([summaryBudget,AbortSignal.timeout(4000)])});
    if(!summary.ok)throw new Error(`Summary HTTP ${summary.status}`);
    const data=await summary.json();
    if(!data.header)throw new Error("Invalid game summary");
    games[index]=normalizeGame(json.events[index],league as League,data);
   }catch(error){
    console.error(`Extra stats unavailable for ${league} game ${games[index].id}`,error);
    games[index].details=[...(games[index].details||[]).slice(0,2),"DETAILS UNAVAILABLE"];
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(4,games.length)},()=>enrichLiveGames()));
 return NextResponse.json({league,games});
 }catch(error){console.error(`Scores unavailable for ${league}`,error);return NextResponse.json({error:"Scores unavailable",games:[]},{status:503});}
}
