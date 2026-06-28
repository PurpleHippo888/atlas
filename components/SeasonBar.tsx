"use client";

import { useEffect, useState } from "react";
import type { MonthData } from "@/lib/seasonModel";
import type { Units } from "./HUD";

interface Props {
  lat: number;
  lon: number;
  compact?: boolean;
  units?: Units;
  /**
   * Controlled mode: when `months` is provided (even as null), SeasonBar
   * renders the supplied data instead of fetching /api/climate itself.
   * Lets a parent that already fetched the climate data avoid a duplicate
   * request (e.g. DestinationDrawer, which also needs the deal months).
   */
  months?: MonthData[] | null;
  source?: string;
  loading?: boolean;
}

const OVERALL_COLORS: Record<string, string> = {
  best:  "bg-emerald-500",
  good:  "bg-blue-400",
  ok:    "bg-yellow-500/70",
  avoid: "bg-red-800/70",
};

const OVERALL_LABELS: Record<string, string> = {
  best: "Best time",
  good: "Good",
  ok: "OK",
  avoid: "Avoid",
};

const DEMAND_DOT: Record<string, string> = {
  peak: "bg-orange-500",
  shoulder: "bg-yellow-500",
  offpeak: "bg-emerald-500",
};

function toF(c: number) { return Math.round(c * 9 / 5 + 32); }

export default function SeasonBar({
  lat, lon, compact = false, units = "metric",
  months: monthsProp, source: sourceProp, loading: loadingProp,
}: Props) {
  const controlled = monthsProp !== undefined;

  const [fetchedMonths, setFetchedMonths] = useState<MonthData[] | null>(null);
  const [fetchedSource, setFetchedSource] = useState<string>("");
  const [fetchedLoading, setFetchedLoading] = useState(true);
  const [tooltip, setTooltip] = useState<MonthData | null>(null);

  useEffect(() => {
    if (controlled) return; // parent supplies the data
    let cancelled = false;
    setFetchedLoading(true);
    setFetchedMonths(null);
    fetch(`/api/climate?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setFetchedMonths(d.months ?? null);
        setFetchedSource(d.source ?? "");
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchedLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lon, controlled]);

  const months = controlled ? monthsProp : fetchedMonths;
  const source = controlled ? (sourceProp ?? "") : fetchedSource;
  const loading = controlled ? (loadingProp ?? false) : fetchedLoading;

  if (loading) {
    return (
      <div className="flex gap-0.5 h-6 items-end">
        {Array(12).fill(0).map((_, i) => (
          <div key={i} className="flex-1 h-4 bg-surface-overlay rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  if (!months) {
    return <p className="text-xs text-gray-600">Season data unavailable</p>;
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-0.5" onMouseLeave={() => setTooltip(null)}>
        {months.map((m) => (
          <div
            key={m.month}
            className="flex-1 relative group cursor-default"
            onMouseEnter={() => setTooltip(m)}
          >
            <div className={`w-full rounded-sm ${compact ? "h-3" : "h-5"} ${OVERALL_COLORS[m.overall]}`} />
            {!compact && (
              <div className="text-center mt-0.5">
                <span className="text-[7px] text-gray-600">{m.label[0]}</span>
              </div>
            )}
            <div className={`absolute top-0.5 right-0.5 w-1 h-1 rounded-full ${DEMAND_DOT[m.demand]}`} />
          </div>
        ))}
      </div>

      {!compact && (
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(OVERALL_COLORS).map(([k, cls]) => (
            <div key={k} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-sm ${cls}`} />
              <span className="text-[9px] text-gray-600">{OVERALL_LABELS[k]}</span>
            </div>
          ))}
          <div className="text-[9px] text-gray-700 ml-auto">
            {source === "open-meteo-era5" ? "ERA5 1991-2020" : "est. demand"}
          </div>
        </div>
      )}

      {tooltip && !compact && (
        <div className="bg-surface-overlay border border-white/10 rounded-md p-2 text-xs space-y-0.5">
          <div className="font-medium text-gray-200">{tooltip.label} -- {OVERALL_LABELS[tooltip.overall]}</div>
          <div className="text-gray-400">
            Avg temp: {units === "imperial"
              ? `${toF(tooltip.avgTempC)}F`
              : `${tooltip.avgTempC}C`}
          </div>
          <div className="text-gray-400">Precip: ~{tooltip.precipMm} mm</div>
          <div className="flex items-center gap-1 text-gray-500">
            <div className={`w-1.5 h-1.5 rounded-full ${DEMAND_DOT[tooltip.demand]}`} />
            Demand: {tooltip.demand}
            <span className="text-gray-700 text-[9px]">(heuristic)</span>
          </div>
        </div>
      )}

      {source === "heuristic-fallback" && (
        <p className="text-[9px] text-gray-700">Weather data unavailable - showing demand estimate only</p>
      )}
    </div>
  );
}
