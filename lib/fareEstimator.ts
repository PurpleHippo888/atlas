/**
 * Keyless distance-band fare estimator.
 * Produces a rough economy fare in USD based on great-circle distance.
 * ALWAYS labelled "estimated" - never presented as a real quote.
 *
 * Model:
 *   Base fare + tiered per-km rate * regional cost factor
 *   Short-haul (<1500 km):  $0.18/km, base $60
 *   Medium-haul (1500-4000): $0.12/km, base $150
 *   Long-haul (>4000 km):   $0.08/km, base $250
 *
 * Regional cost factors applied to destination region.
 */

export interface FareEstimate {
  usd: number;
  confidence: "estimated";
  model: "distance-band";
  distanceKm: number;
}

// Per-continent cost adjustment (rough market factor)
const CONTINENT_FACTOR: Record<string, number> = {
  EU: 0.95,
  NA: 1.00,
  SA: 1.05,
  AS: 0.90,
  OC: 1.15,
  AF: 1.10,
  AN: 1.50,
};

export function estimateFareUsd(
  distanceKm: number,
  destContinent: string
): FareEstimate {
  const factor = CONTINENT_FACTOR[destContinent] ?? 1.0;
  let base: number;
  let perKm: number;

  if (distanceKm < 1500) {
    base = 60;
    perKm = 0.18;
  } else if (distanceKm < 4000) {
    base = 150;
    perKm = 0.12;
  } else {
    base = 250;
    perKm = 0.08;
  }

  const raw = (base + perKm * distanceKm) * factor;
  // Round to nearest $5
  const usd = Math.round(raw / 5) * 5;

  return { usd, confidence: "estimated", model: "distance-band", distanceKm };
}

/**
 * Estimate flight duration from distance.
 * Formula: distance / 800 km/h + 0.5h (taxi/climb) + connection penalty
 */
export function estimateFlightHours(
  distanceKm: number,
  isDirect: boolean
): number {
  const flightTime = distanceKm / 800 + 0.5;
  const connectionPenalty = isDirect ? 0 : distanceKm < 2000 ? 1.5 : 2.5;
  return Math.round((flightTime + connectionPenalty) * 10) / 10;
}
