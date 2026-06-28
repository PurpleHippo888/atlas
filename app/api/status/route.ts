/**
 * GET /api/status
 * Health-checks each provider. Returns live/estimated/unavailable per provider.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAmadeusEnabled, probeAmadeus } from "@/lib/providers/amadeus";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

type ProviderStatus = "live" | "estimated" | "unavailable";

interface ProviderResult {
  name: string;
  label: string;
  status: ProviderStatus;
  latencyMs?: number;
  note?: string;
}

async function probe(url: string, timeoutMs = 3000): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok || res.status < 500, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

export async function GET(req: NextRequest) {
  // Each call fans out to several upstream probes, so cap it per IP.
  if (!checkRateLimit(getClientIp(req), 20, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const [meteo, fx, countries, nominatim] = await Promise.all([
    probe("https://climate-api.open-meteo.com/v1/climate?latitude=51&longitude=0&models=EC_Earth3P_HR&start_date=2000-01-01&end_date=2000-01-02&daily=temperature_2m_mean"),
    probe("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json"),
    probe("https://restcountries.com/v3.1/alpha/US?fields=name"),
    probe("https://nominatim.openstreetmap.org/search?q=London&format=json&limit=1"),
  ]);

  const amadeusEnabled = isAmadeusEnabled();
  let amadeusOk = false;
  if (amadeusEnabled) {
    amadeusOk = await probeAmadeus();
  }

  const providers: ProviderResult[] = [
    {
      name: "airports",
      label: "Airports DB",
      status: "live",
      note: "Bundled OpenFlights dataset (6345 airports)",
    },
    {
      name: "fares",
      label: "Fares",
      status: amadeusEnabled && amadeusOk ? "live" : "estimated",
      note: amadeusEnabled && amadeusOk
        ? "Amadeus Flight Inspiration Search"
        : amadeusEnabled
          ? "Amadeus key set but unreachable -- using distance heuristic"
          : "Distance heuristic -- not live quotes",
    },
    {
      name: "openmeteo",
      label: "Open-Meteo",
      status: meteo.ok ? "live" : "estimated",
      latencyMs: meteo.ms,
      note: meteo.ok ? "Climate normals + geocoding" : "Using heuristic season model",
    },
    {
      name: "fx",
      label: "FX rates",
      status: fx.ok ? "live" : "unavailable",
      latencyMs: fx.ms,
      note: fx.ok ? "jsDelivr currency-api" : "Showing USD only",
    },
    {
      name: "restcountries",
      label: "REST Countries",
      status: countries.ok ? "live" : "unavailable",
      latencyMs: countries.ms,
      note: countries.ok ? "Country info + currency" : "Country data unavailable",
    },
    {
      name: "nominatim",
      label: "Nominatim",
      status: nominatim.ok ? "live" : "estimated",
      latencyMs: nominatim.ms,
      note: nominatim.ok ? "OSM geocoding fallback" : "Open-Meteo geocoding only",
    },
  ];

  if (amadeusEnabled) {
    providers.splice(1, 0, {
      name: "amadeus",
      label: "Amadeus",
      status: amadeusOk ? "live" : "unavailable",
      note: amadeusOk ? "Live fares active" : "Token fetch failed -- check API keys",
    });
  }

  const liveCount = providers.filter((p) => p.status === "live").length;
  const overall: ProviderStatus =
    liveCount >= 4 ? "live" : liveCount >= 2 ? "estimated" : "unavailable";

  return NextResponse.json({ overall, providers, checkedAt: new Date().toISOString() });
}
