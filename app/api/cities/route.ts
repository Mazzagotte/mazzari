import {NextRequest, NextResponse} from "next/server";

export async function GET(request:NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({error:"Enter between 2 and 100 characters."}, {status:400});
  }
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  try {
    const response = await fetch(url, {next:{revalidate:86400}, signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(`City search HTTP ${response.status}`);
    const data = await response.json();
    return NextResponse.json({cities:(data.results || []).map((city:{
      id:number; name:string; admin1?:string; country?:string; latitude:number; longitude:number; timezone?:string;
    }) => ({
      id:city.id, label:[city.name, city.admin1, city.country].filter(Boolean).join(", "),
      lat:city.latitude, lon:city.longitude, timezone:city.timezone,
    }))});
  } catch (error) {
    console.error("City search failed", error);
    return NextResponse.json({error:"City search is unavailable. You can enter coordinates manually."}, {status:503});
  }
}
