/**
 * GET /api/climate?lat=51.5&lon=-0.1
 * Returns 12-month climate normals (temp + precip) and season bar
 * from Open-Meteo Climate API (keyless, CC-BY 4.0 non-commercial).
 *
 * Uses ERA5 reanalysis: 30-year climatology (1991-2020 period).
 * Cached 30 days (climate data is stable).
 */

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { buildSeasonBar } from "@/lib/seasonModel";

export const dynamic = "force-dynamic";

interface ClimateResponse {
  months: ReturnType<typeof buildSeasonBar>;
  source: string;
  cached?: boolean;
}

async function fetchClimateNormals(lat: number, lon: number) {
  // Open-Meteo Climate API: daily normals -> aggregate to monthly
  const url = [
    "https://climate-api.open-meteo.com/v1/climate",
    `?latitude=${lat}&longitude=${lon}`,
    "&start_date=1991-01-01&end_date=2020-12-31",
    "&models=ERA5",
    "&daily=temperature_2m_mean,precipitation_sum",
    "&timezone=UTC",
  ].join("");

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo climate HTTP ${res.status}`);
  const data = await res.json();

  const dates: string[] = data.daily?.time ?? [];
  const temps: number[] = data.daily?.temperature_2m_mean ?? [];
  const precips: number[] = data.daily?.precipitation_sum ?? [];

  // Aggregate to monthly averages
  const monthlyTemp = Array(12).fill(0);
  const monthlyPrecip = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);

  for (let i = 0; i < dates.length; i++) {
    const m = new Date(dates[i]).getMonth(); // 0-11
    if (!isNaN(temps[i])) { monthlyTemp[m] += temps[i]; monthlyCounts[m]++; }
    if (!isNaN(precips[i])) monthlyPrecip[m] += precips[i];
  }

  const avgTemps = monthlyTemp.map((t, i) => monthlyCounts[i] > 0 ? t / monthlyCounts[i] : 15);
  // precip is already monthly sum (daily values summed per month)
  const avgPrecip = monthlyPrecip.map((p, i) => monthlyCounts[i] > 0 ? p / (monthlyCounts[i] / 30) : 60);

  return { avgTemps, avgPrecip };
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const cacheKey = `climate:${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const cached = cacheGet<ClimateResponse>(cacheKey);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const { avgTemps, avgPrecip } = await fetchClimateNormals(lat, lon);
    const months = buildSeasonBar(lat, avgTemps, avgPrecip);
    const result: ClimateResponse = { months, source: "open-meteo-era5" };
    cacheSet(cacheKey, result, TTL.CLIMATE);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[climate]", err);
    // Fallback: simple sinusoidal climatology (~15C annual mean, +/-8C seasonal
    // swing, phase-shifted by hemisphere so Jan is cold in the north / warm in
    // the south). Used only when Open-Meteo is unreachable.
    const fallbackTemps = Array(12).fill(0).map((_, i) => {
      const seasonalSwing = 8 * Math.sin(((i - 3) * Math.PI) / 6) * (lat > 0 ? 1 : -1);
      return 15 + seasonalSwing;
    });
    const fallbackPrecip = Array(12).fill(80);
    const months = buildSeasonBar(lat, fallbackTemps, fallbackPrecip);
    return NextResponse.json({ months, source: "heuristic-fallback" });
  }
}
