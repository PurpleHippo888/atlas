/**
 * OpenFlights dataset loader.
 * Loads airports.json (bundled in /data) into memory once at module init.
 * All airport lookups are O(1) via IATA-indexed Map.
 */

import { readFileSync } from "fs";
import path from "path";

export interface Airport {
  iata: string;
  name: string | null; // some bundled rows have no name; callers fall back to IATA
  lat: number;
  lon: number;
  iso: string;       // 2-letter country code
  continent: string; // OC, EU, NA, SA, AS, AF, AN
  size: "large" | "medium" | "small";
}

// --- Module-level singleton ---------------------------------------------------

let _airports: Airport[] | null = null;
let _byIata: Map<string, Airport> | null = null;

function loadAirports(): Airport[] {
  if (_airports) return _airports;

  const filePath = path.join(process.cwd(), "data", "airports.json");
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Airport[];

  // The bundled dataset contains a handful of duplicate IATA codes and a few
  // rows without an IATA. Keep the first occurrence of each code so that array
  // iteration and IATA lookups stay consistent -- this prevents duplicate React
  // keys downstream and avoids the same airport appearing twice in results.
  const byIata = new Map<string, Airport>();
  for (const ap of parsed) {
    if (!ap.iata || byIata.has(ap.iata)) continue;
    byIata.set(ap.iata, ap);
  }

  _byIata = byIata;
  _airports = Array.from(byIata.values());
  return _airports;
}

// --- Public API ---------------------------------------------------------------

/** All airports with IATA codes and coordinates. */
export function getAllAirports(): Airport[] {
  return loadAirports();
}

/** Lookup a single airport by IATA code. */
export function getAirportByIata(iata: string): Airport | undefined {
  loadAirports();
  return _byIata!.get(iata.toUpperCase());
}

/**
 * Return airports "reachable" from an origin using a size-based heuristic.
 *
 * Heuristic (used when no Amadeus key is configured):
 *  - Large origin -> connects to all large + medium airports worldwide,
 *    plus small airports within 2000 km.
 *  - Medium origin -> connects to all large airports, same-continent medium,
 *    plus small airports within 800 km.
 *  - Small origin -> connects to all large airports, same-continent medium
 *    within 1500 km, small within 500 km.
 *
 * Always clearly labelled "estimated" by callers.
 */
export function getReachableAirports(
  originIata: string,
  options: { maxResults?: number } = {}
): Airport[] {
  const origin = getAirportByIata(originIata);
  if (!origin) return [];

  const all = getAllAirports();
  const { maxResults = 500 } = options;

  const scored: Array<{ airport: Airport; score: number }> = [];

  for (const ap of all) {
    if (ap.iata === origin.iata) continue;
    const dist = haversineKm(origin.lat, origin.lon, ap.lat, ap.lon);
    let include = false;

    if (origin.size === "large") {
      include =
        ap.size === "large" ||
        ap.size === "medium" ||
        (ap.size === "small" && dist <= 2000);
    } else if (origin.size === "medium") {
      include =
        ap.size === "large" ||
        (ap.size === "medium" && ap.continent === origin.continent) ||
        (ap.size === "small" && dist <= 800);
    } else {
      include =
        ap.size === "large" ||
        (ap.size === "medium" && ap.continent === origin.continent && dist <= 1500) ||
        (ap.size === "small" && ap.continent === origin.continent && dist <= 500);
    }

    if (include) {
      // Score: large airports first, then by distance ascending
      const sizeScore = ap.size === "large" ? 0 : ap.size === "medium" ? 1 : 2;
      scored.push({ airport: ap, score: sizeScore * 100000 + dist });
    }
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, maxResults).map((s) => s.airport);
}

// --- Geo helpers -------------------------------------------------------------

export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
