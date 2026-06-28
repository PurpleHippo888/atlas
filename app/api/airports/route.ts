/**
 * GET /api/airports
 * Returns all airports (or airports reachable from ?origin=IATA) as GeoJSON.
 *
 * Query params:
 *   origin=JFK          -> reachable airports from JFK (heuristic-estimated)
 *   iata=JFK,LHR,SYD   -> specific airports by IATA code
 *   size=large,medium   -> filter by size (comma-separated)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllAirports, getAirportByIata, getReachableAirports, type Airport } from "@/lib/openflights";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function airportToFeature(ap: Airport, props?: Record<string, unknown>) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [ap.lon, ap.lat] },
    properties: {
      iata: ap.iata,
      name: ap.name,
      iso: ap.iso,
      continent: ap.continent,
      size: ap.size,
      ...props,
    },
  };
}

export async function GET(req: NextRequest) {
  // The no-origin response serialises the entire dataset, so cap it per IP.
  if (!checkRateLimit(getClientIp(req), 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const origin = searchParams.get("origin");
  const iataParam = searchParams.get("iata");
  const sizeParam = searchParams.get("size");

  let airports: Airport[];

  if (iataParam) {
    airports = iataParam
      .split(",")
      .map((c) => getAirportByIata(c.trim()))
      .filter(Boolean) as Airport[];
  } else if (origin) {
    airports = getReachableAirports(origin, { maxResults: 600 });
  } else {
    airports = getAllAirports();
  }

  if (sizeParam) {
    const allowed = new Set(sizeParam.split(",").map((s) => s.trim()));
    airports = airports.filter((a) => allowed.has(a.size));
  }

  const geojson = {
    type: "FeatureCollection",
    features: airports.map((ap) =>
      airportToFeature(ap, origin ? { reachable: true } : undefined)
    ),
    meta: {
      count: airports.length,
      estimated: !!origin,
    },
  };

  return NextResponse.json(geojson, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
