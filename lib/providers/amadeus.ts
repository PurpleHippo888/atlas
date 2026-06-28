/**
 * Amadeus Tier-2 provider (optional).
 *
 * Activated when both env vars are set:
 *   AMADEUS_CLIENT_ID
 *   AMADEUS_CLIENT_SECRET
 *
 * IMPORTANT -- self-service sunset (2026-07-17):
 *   The Amadeus "for Developers" self-service portal, including its test
 *   environment (test.api.amadeus.com), is being decommissioned on
 *   2026-07-17. After that date only the Enterprise APIs remain available,
 *   served from api.amadeus.com and provisioned through the Amadeus Enterprise
 *   portal. To keep live fares working past the sunset, obtain Enterprise
 *   credentials and set AMADEUS_ENV=production.
 *
 *   This is a soft dependency: whenever Amadeus is unreachable Atlas silently
 *   falls back to distance-estimated fares, so a decommissioned self-service
 *   key simply degrades results to "estimated" rather than breaking the app.
 *
 * Endpoints:
 *   AMADEUS_ENV=production   -> https://api.amadeus.com       (Enterprise)
 *   (unset / any other value) -> https://test.api.amadeus.com (self-service, deprecated)
 *
 * APIs used:
 *   POST /v1/security/oauth2/token        -- OAuth2 client credentials
 *   GET  /v1/shopping/flight-destinations -- Flight Inspiration Search
 */

import { cacheGet, cacheSet, TTL } from "@/lib/cache";

const IS_PRODUCTION = process.env.AMADEUS_ENV === "production";

const BASE = IS_PRODUCTION
  ? "https://api.amadeus.com"
  : "https://test.api.amadeus.com";

// Date the self-service portal (and its test endpoint) is decommissioned.
const SELF_SERVICE_SUNSET = "2026-07-17";
let warnedSelfService = false;

/** Warn once if we are talking to the deprecated self-service endpoint. */
function warnIfSelfService(): void {
  if (IS_PRODUCTION || warnedSelfService) return;
  warnedSelfService = true;
  console.warn(
    `[amadeus] Using the self-service endpoint (${BASE}). The Amadeus for ` +
    `Developers self-service portal is being decommissioned on ${SELF_SERVICE_SUNSET}; ` +
    `afterwards only the Enterprise APIs (api.amadeus.com) remain. Provision ` +
    `Enterprise credentials and set AMADEUS_ENV=production to keep live fares.`
  );
}

export function isAmadeusEnabled(): boolean {
  return !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  warnIfSelfService();

  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID!,
      client_secret: process.env.AMADEUS_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`Amadeus token error: ${res.status}`);
  const data: TokenResponse = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface AmadeusDestination {
  iata: string;
  priceUsd: number;
  departureDate: string;
  confidence: "live";
}

/**
 * Flight Inspiration Search: cheapest one-way fares from origin.
 * Returns up to 10 destinations with real prices.
 * Cached 6h (same as TTL.PRICES).
 */
export async function getFlightInspiration(
  originIata: string,
  maxPrice?: number
): Promise<AmadeusDestination[]> {
  if (!isAmadeusEnabled()) return [];

  const key = `amadeus:inspiration:${originIata}:${maxPrice ?? "any"}`;
  const cached = cacheGet<AmadeusDestination[]>(key);
  if (cached) return cached;

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({ origin: originIata, oneWay: "true" });
    if (maxPrice) params.set("maxPrice", String(maxPrice));

    const res = await fetch(
      `${BASE}/v1/shopping/flight-destinations?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) return [];
    const json = await res.json();

    const results: AmadeusDestination[] = (json.data ?? []).map(
      (d: { destination: string; price: { total: string }; departureDate: string }) => ({
        iata: d.destination,
        priceUsd: parseFloat(d.price.total),
        departureDate: d.departureDate,
        confidence: "live" as const,
      })
    );

    cacheSet(key, results, TTL.PRICES);
    return results;
  } catch {
    return [];
  }
}

/**
 * Check Amadeus connectivity. Returns true if token fetch succeeds.
 */
export async function probeAmadeus(): Promise<boolean> {
  if (!isAmadeusEnabled()) return false;
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}
