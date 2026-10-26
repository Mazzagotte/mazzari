import { NextRequest, NextResponse } from "next/server";
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
    const response = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Weather service ${response.status}`);
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "Weather unavailable" }, { status: 503 });
  }
}
