/**
 * GET /api/countries?iso=GB,FR,JP
 * Returns basic country info from REST Countries (keyless public API).
 * Cached 30 days.
 */

import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, TTL } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface CountryInfo {
  iso: string;
  name: string;
  currency: { code: string; name: string; symbol: string } | null;
  flag: string;
  region: string;
  capital: string;
}

async function fetchCountry(iso2: string): Promise<CountryInfo | null> {
  const key = `country:${iso2.toUpperCase()}`;
  const cached = cacheGet<CountryInfo>(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/alpha/${iso2}?fields=name,currencies,flags,region,capital`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const d = Array.isArray(data) ? data[0] : data;

    const currencyEntries = Object.entries(d.currencies ?? {}) as [string, { name: string; symbol: string }][];
    const firstCurrency = currencyEntries[0];

    const info: CountryInfo = {
      iso: iso2.toUpperCase(),
      name: d.name?.common ?? iso2,
      currency: firstCurrency
        ? { code: firstCurrency[0], name: firstCurrency[1].name, symbol: firstCurrency[1].symbol }
        : null,
      flag: d.flags?.svg ?? d.flags?.png ?? "",
      region: d.region ?? "",
      capital: Array.isArray(d.capital) ? d.capital[0] : (d.capital ?? ""),
    };

    cacheSet(key, info, TTL.COUNTRY);
    return info;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const isoParam = req.nextUrl.searchParams.get("iso");
  if (!isoParam) {
    return NextResponse.json({ error: "iso required" }, { status: 400 });
  }

  const codes = isoParam.split(",").map((s) => s.trim().toUpperCase()).slice(0, 10);
  const results = await Promise.all(codes.map(fetchCountry));

  return NextResponse.json({
    countries: results.filter(Boolean),
  });
}
