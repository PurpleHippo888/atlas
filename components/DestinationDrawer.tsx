"use client";

import { useEffect, useState } from "react";
import type { DestinationResult } from "@/app/api/explore/route";
import { getDealMonths, type MonthData } from "@/lib/seasonModel";
import type { Units } from "./HUD";
import SeasonBar from "./SeasonBar";

interface Props {
  destination: DestinationResult | null;
  onClose: () => void;
  currency: string;
  units: Units;
}

interface ClimateState {
  months: MonthData[] | null;
  source: string;
  loading: boolean;
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDist(km: number, units: Units) {
  if (units === "imperial") {
    return `${Math.round(km * 0.621371).toLocaleString()} mi`;
  }
  return `${km.toLocaleString()} km`;
}

function formatDistShort(km: number, units: Units) {
  if (units === "imperial") {
    const mi = Math.round(km * 0.621371 / 100) / 10;
    return `~${mi}k mi`;
  }
  return `~${Math.round(km / 100) / 10}k km`;
}

const CONTINENT_NAMES: Record<string, string> = {
  EU: "Europe", AS: "Asia", NA: "N. America", SA: "S. America",
  AF: "Africa", OC: "Oceania", AN: "Antarctica",
};

function DealBadge({ months }: { months: MonthData[] }) {
  if (months.length === 0) return null;
  return (
    <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <svg className="w-3 h-3 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-5l-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6z" />
        </svg>
        <span className="text-xs font-medium text-emerald-400">Deal window</span>
        <span className="text-[9px] text-emerald-700 ml-auto">heuristic</span>
      </div>
      <p className="text-xs text-emerald-300">{months.map((m) => m.label).join(", ")}</p>
      <p className="text-[10px] text-emerald-800 mt-1">
        Off-peak demand + good weather -- expect lower fares
      </p>
    </div>
  );
}

export default function DestinationDrawer({ destination: d, onClose, currency, units }: Props) {
  const [climate, setClimate] = useState<ClimateState>({ months: null, source: "", loading: true });

  // Fetch climate once per destination and share it between the deal badge and
  // the SeasonBar (which runs in controlled mode) to avoid a duplicate request.
  useEffect(() => {
    if (!d) { setClimate({ months: null, source: "", loading: false }); return; }
    let cancelled = false;
    setClimate({ months: null, source: "", loading: true });
    fetch(`/api/climate?lat=${d.lat.toFixed(2)}&lon=${d.lon.toFixed(2)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setClimate({ months: data.months ?? null, source: data.source ?? "", loading: false });
      })
      .catch(() => { if (!cancelled) setClimate({ months: null, source: "", loading: false }); });
    return () => { cancelled = true; };
  }, [d?.lat, d?.lon]);

  if (!d) return null;

  const dealMonths = climate.months ? getDealMonths(climate.months) : [];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-80"
      role="complementary"
      aria-label={`Details for ${d.name}`}
    >
      <div className="fixed inset-0 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />

      <div className="relative md:h-full bg-surface-raised border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-bold text-accent">{d.iata}</span>
              <span className="text-xs text-gray-500">{CONTINENT_NAMES[d.continent] ?? d.continent}</span>
              {d.confidence === "live" && (
                <span className="text-[9px] text-emerald-500 bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded">
                  live fare
                </span>
              )}
            </div>
            <p className="text-sm text-gray-200 leading-tight">{d.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close destination panel"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-overlay transition-colors"
          >
            x
          </button>
        </div>

        {d.confidence === "estimated" && (
          <div className="mx-4 mt-3 mb-1 flex items-center gap-2 text-[10px] text-yellow-600 bg-yellow-950/30 border border-yellow-900/40 rounded px-2.5 py-1.5">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
            </svg>
            Prices are estimates based on flight distance, not live quotes.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 px-4 mt-3">
          <div className="bg-surface-overlay rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">
              {d.confidence === "live" ? "Live fare" : "Est. fare"}
            </p>
            <p className="text-xl font-bold text-gray-100">{currency} {d.fareDisplay.toLocaleString()}</p>
            <p className="text-[10px] text-gray-600">{formatDistShort(d.distanceKm, units)}</p>
          </div>
          <div className="bg-surface-overlay rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">Flight time</p>
            <p className="text-xl font-bold text-gray-100">{formatHours(d.flightHours)}</p>
            <p className="text-[10px] text-gray-600">{d.isDirect ? "likely direct*" : "with connections*"}</p>
          </div>
        </div>

        {dealMonths.length > 0 && (
          <div className="px-4 mt-3">
            <DealBadge months={dealMonths} />
          </div>
        )}

        <div className="px-4 mt-3 space-y-2">
          <Row label="Country" value={d.iso} />
          <Row label="Distance" value={formatDist(d.distanceKm, units)} />
          <Row label="Routing" value={d.isDirect ? "Estimated direct" : "Estimated via hub"} />
          <Row label="Airport size" value={d.size} />
        </div>

        <div className="px-4 mt-4">
          <p className="text-xs text-gray-500 mb-2">Seasonality</p>
          <SeasonBar
            lat={d.lat}
            lon={d.lon}
            units={units}
            months={climate.months}
            source={climate.source}
            loading={climate.loading}
          />
        </div>

        <div className="px-4 mt-4 pb-4 text-[10px] text-gray-700">
          * Routing estimates based on airport size and distance heuristics.
          Actual routes vary by airline and season.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-200">{value}</span>
    </div>
  );
}
