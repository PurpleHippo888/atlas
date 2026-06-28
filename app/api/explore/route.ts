/**
 * GET /api/explore
 * Returns ranked destinations from an origin with estimated fares and flight times.
 *
 * Tier-1 (keyless): distance-based fare heuristic, labelled "estimated".
 * Tier-2 (optional): when AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET are set,
 *   real fares from Amadeus Flight Inspiration Search replace estimates for
 *   covered destinations, labelled "live".
 *
 * Query params:
 *   origin=JFK       IATA code (required)
 *   currency=USD     display currency (default USD)
 *   maxBudget=500    max estimated fare in display currency
 *   maxHours=12      max estimated flight hours
 *   directOnly=true  only estimated-direct routes
 *   continent=EU,AS  filter by continent (comma-separated)
 *   limit=100        max results (default 100, max 300)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAirportByIata, getReachableAirports, haversineKm } from "@/lib/openflights";
import { estimateFareUsd, estimateFlightHours } from "@/lib/fareEstimator";
import { isAmadeusEnabled, getFlightInspiration } from "@/lib/providers/amadeus";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MILITARY_PATTERNS = [
  /\bRAF\b/i, /\bAFB\b/i, /air force base/i, /\bNAES\b/i,
  /naval air/i, /\bnaval\b/i, /army air/i, /military/i,
  /\bNAS\b/, /Mc Guire/, /Lakehurst/, /Fairford/,
];

function isCommercialAirport(name: string | null): boolean {
  // Rows without a name can't be matched against the military patterns;
  // treat them as commercial rather than crashing on a null.
  if (!name) return true;
  return !MILITARY_PATTERNS.some((re) => re.test(name));
}

/** Parse a non-negative numeric query param, returning fallback when absent/invalid. */
function parseNonNegative(value: string | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const dynamic = "force-dynamic";

export interface DestinationResult {
  iata: string;
  name: string;
  lat: number;
  lon: number;
  iso: string;
  continent: string;
  size: string;
  distanceKm: number;
  flightHours: number;
  isDirect: boolean;
  fareUsd: number;
  fareDisplay: number;
  currency: string;
  confidence: "estimated" | "live";
}

export async function GET(req: NextRequest) {
  // Rate limit: 30 requests/min per IP for the explore endpoint
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const p = req.nextUrl.searchParams;
  const originIata = p.get("origin")?.toUpperCase();
  if (!originIata) {
    return NextResponse.json({ error: "origin required" }, { status: 400 });
  }

  const origin = getAirportByIata(originIata);
  if (!origin) {
    return NextResponse.json({ error: "unknown origin IATA" }, { status: 404 });
  }

  const currency = (p.get("currency") ?? "USD").toUpperCase();
  const maxBudget = parseNonNegative(p.get("maxBudget"), Infinity);
  const maxHours = parseNonNegative(p.get("maxHours"), Infinity);
  const directOnly = p.get("directOnly") === "true";
  const continents = p.get("continent")?.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) ?? [];
  const limitParsed = parseNonNegative(p.get("limit"), 100);
  const limit = Math.min(limitParsed > 0 ? limitParsed : 100, 300);

  const reachable = getReachableAirports(originIata, { maxResults: 600 });

  // FX rate
  let fxRate = 1;
  if (currency !== "USD") {
    try {
      const fxRes = await fetch(
        `${req.nextUrl.origin}/api/fx?from=USD&to=${currency}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        fxRate = fxData.rate ?? 1;
      }
    } catch {
      // graceful fallback
    }
  }

  // Tier-2: Amadeus live fares
  const amadeusMap = new Map<string, number>();
  if (isAmadeusEnabled()) {
    try {
      const inspirations = await getFlightInspiration(
        originIata,
        maxBudget < Infinity ? Math.round(maxBudget / fxRate) : undefined
      );
      for (const d of inspirations) amadeusMap.set(d.iata, d.priceUsd);
    } catch {
      // fall through to estimates
    }
  }

  const results: DestinationResult[] = [];

  for (const ap of reachable) {
    if (ap.iata === originIata) continue;
    if (ap.size === "small") continue;
    if (!isCommercialAirport(ap.name)) continue;

    const distanceKm = haversineKm(origin.lat, origin.lon, ap.lat, ap.lon);
    if (distanceKm < 80) continue;

    const isDirect =
      (origin.size === "large" && ap.size === "large") ||
      (origin.size === "large" && ap.size === "medium" && distanceKm < 5000) ||
      (origin.size === "medium" && ap.size === "large") ||
      (origin.size === "medium" && ap.continent === origin.continent && ap.size === "medium");

    if (directOnly && !isDirect) continue;

    const flightHours = estimateFlightHours(distanceKm, isDirect);
    if (flightHours > maxHours) continue;

    const livePrice = amadeusMap.get(ap.iata);
    const fareUsd = livePrice ?? estimateFareUsd(distanceKm, ap.continent).usd;
    const confidence: "estimated" | "live" = livePrice !== undefined ? "live" : "estimated";
    const fareDisplay = Math.round(fareUsd * fxRate);

    if (fareDisplay > maxBudget) continue;
    if (continents.length > 0 && !continents.includes(ap.continent)) continue;

    results.push({
      iata: ap.iata, name: ap.name ?? ap.iata, lat: ap.lat, lon: ap.lon,
      iso: ap.iso, continent: ap.continent, size: ap.size,
      distanceKm: Math.round(distanceKm), flightHours, isDirect,
      fareUsd, fareDisplay, currency, confidence,
    });
  }

  results.sort((a, b) =>
    (a.fareDisplay / 100 + a.flightHours * 5) - (b.fareDisplay / 100 + b.flightHours * 5)
  );

  return NextResponse.json({
    origin: { iata: originIata, name: origin.name, lat: origin.lat, lon: origin.lon },
    results: results.slice(0, limit),
    meta: {
      total: results.length,
      tier: isAmadeusEnabled() ? "amadeus+estimated" : "estimated",
      currency, fxRate,
      filters: { maxBudget, maxHours, directOnly, continents },
    },
  });
}
