import { NextRequest, NextResponse } from "next/server";
import { isWeather } from "../../../lib/feeds";
import { cached } from "../../../lib/serverCache";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lat = Number(q.get("lat")),
    lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  const unit = q.get("unit") === "celsius" ? "celsius" : "fahrenheit";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  Object.entries({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
    temperature_unit: unit,
    wind_speed_unit: "mph",
    timezone: "auto",
    forecast_days: "2",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const data = await cached(url.toString(), { ttlMs: 300000, staleMs: 3600000 }, async () => {
      const response = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Weather service ${response.status}`);
      const json: unknown = await response.json();
      if (!isWeather(json)) throw new Error("Unexpected weather response shape");
      return json;
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Weather unavailable", error);
    return NextResponse.json({ error: "Weather unavailable" }, { status: 503 });
  }
}
