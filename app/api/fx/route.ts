/**
 * GET /api/fx?from=USD&to=EUR
 * Returns exchange rate. Primary: fawazahmed0/currency-api (jsDelivr CDN).
 * Fallback: Frankfurter (ECB, ~30 currencies).
 * Cached 12h.
 */

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function fetchFromCurrencyApi(from: string, to: string): Promise<number> {
  const date = new Date().toISOString().split("T")[0];
  // Try today's date, fall back to 'latest'
  for (const d of [date, "latest"]) {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/${from.toLowerCase()}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) continue;
    const data = await res.json();
    const rate = data[from.toLowerCase()]?.[to.toLowerCase()];
    if (rate) return rate;
  }
  throw new Error("currency-api: rate not found");
}

async function fetchFromFrankfurter(from: string, to: string): Promise<number> {
  const url = `https://api.frankfurter.dev/latest?from=${from}&to=${to}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = await res.json();
  const rate = data.rates?.[to];
  if (!rate) throw new Error("Frankfurter: rate not found");
  return rate;
}

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from")?.toUpperCase() ?? "USD";
  const to = req.nextUrl.searchParams.get("to")?.toUpperCase() ?? "USD";

  if (from === to) return NextResponse.json({ rate: 1, from, to, source: "identity" });

  const cacheKey = `fx:${from}:${to}`;
  const cached = cacheGet<{ rate: number; source: string }>(cacheKey);
  if (cached) return NextResponse.json({ ...cached, from, to, cached: true });

  let rate: number | null = null;
  let source = "unknown";

  try {
    rate = await fetchFromCurrencyApi(from, to);
    source = "currency-api";
  } catch (err) {
    console.warn("[fx] currency-api failed:", err);
    try {
      rate = await fetchFromFrankfurter(from, to);
      source = "frankfurter";
    } catch (err2) {
      console.error("[fx] Frankfurter also failed:", err2);
    }
  }

  if (rate === null) {
    // Return 1 with error flag rather than crashing
    return NextResponse.json(
      { rate: 1, from, to, source: "unavailable", error: "FX providers unreachable" },
      { status: 200 }
    );
  }

  const result = { rate, source };
  cacheSet(cacheKey, result, TTL.FX);
  return NextResponse.json({ ...result, from, to });
}
