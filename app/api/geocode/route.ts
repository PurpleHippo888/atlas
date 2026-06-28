/**
 * GET /api/geocode?q=New+York
 * Geocodes a location string using Open-Meteo Geocoding API (keyless).
 * Falls back to Nominatim (OSM) if Open-Meteo returns no results.
 *
 * Returns up to 5 candidate locations with lat/lon + nearest airport IATA.
 */

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";
import { getAllAirports, haversineKm } from "@/lib/openflights";

export const dynamic = "force-dynamic";

interface GeoResult {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  nearestAirport: {
    iata: string;
    name: string;
    distanceKm: number;
  } | null;
}

function findNearestAirport(lat: number, lon: number, maxKm = 200) {
  const airports = getAllAirports();
  let best: { iata: string; name: string; distanceKm: number } | null = null;
  let bestDist = Infinity;

  for (const ap of airports) {
    if (ap.size === "small") continue; // skip tiny strips
    const d = haversineKm(lat, lon, ap.lat, ap.lon);
    if (d < bestDist && d <= maxKm) {
      bestDist = d;
      best = { iata: ap.iata, name: ap.name ?? ap.iata, distanceKm: Math.round(d) };
    }
  }
  return best;
}

async function geocodeOpenMeteo(q: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Open-Meteo geocoding HTTP ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) return [];

  return data.results.map((r: {
    name: string;
    country: string;
    country_code: string;
    latitude: number;
    longitude: number;
    admin1?: string;
  }) => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    nearestAirport: findNearestAirport(r.latitude, r.longitude),
  }));
}

async function geocodeNominatim(q: string): Promise<GeoResult[]> {
  const nominatimUrl =
    process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
  const url = `${nominatimUrl}/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": "Atlas-Travel-Dashboard/0.1 (self-hosted; geocoding fallback)",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = await res.json();

  return data.map((r: {
    display_name: string;
    address?: { country?: string; country_code?: string };
    lat: string;
    lon: string;
  }) => ({
    name: r.display_name,
    country: r.address?.country ?? "",
    countryCode: (r.address?.country_code ?? "").toUpperCase(),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    nearestAirport: findNearestAirport(parseFloat(r.lat), parseFloat(r.lon)),
  }));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = `geocode:${q.toLowerCase()}`;
  const cached = cacheGet<GeoResult[]>(cacheKey);
  if (cached) return NextResponse.json({ results: cached, cached: true });

  let results: GeoResult[] = [];
  let source = "open-meteo";

  try {
    results = await geocodeOpenMeteo(q);
  } catch (err) {
    console.warn("[geocode] Open-Meteo failed, trying Nominatim:", err);
    source = "nominatim-fallback";
  }

  if (results.length === 0) {
    try {
      results = await geocodeNominatim(q);
      source = "nominatim";
    } catch (err) {
      console.error("[geocode] Nominatim also failed:", err);
    }
  }

  if (results.length > 0) {
    cacheSet(cacheKey, results, TTL.GEOCODE);
  }

  return NextResponse.json({ results, source });
}
