"use client";

import type { DestinationResult } from "@/app/api/explore/route";
import type { Units } from "./HUD";
import SeasonBar from "./SeasonBar";

interface Props {
  pinned: DestinationResult[];
  onRemove: (iata: string) => void;
  currency: string;
  units: Units;
}

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDist(km: number, units: Units) {
  if (units === "imperial") {
    const mi = Math.round(km * 0.621371 / 100) / 10;
    return `${mi}k mi`;
  }
  return `${Math.round(km / 100) / 10}k km`;
}

const CONTINENT_NAMES: Record<string, string> = {
  EU: "Europe", AS: "Asia", NA: "N. America", SA: "S. America",
  AF: "Africa", OC: "Oceania", AN: "Antarctica",
};

function bestIdx(vals: number[], lower = true): number {
  if (vals.length === 0) return -1;
  let best = vals[0]; let idx = 0;
  for (let i = 1; i < vals.length; i++) {
    if (lower ? vals[i] < best : vals[i] > best) { best = vals[i]; idx = i; }
  }
  return idx;
}

const COL_COLORS = [
  "border-blue-500/40 bg-blue-950/20",
  "border-purple-500/40 bg-purple-950/20",
  "border-emerald-500/40 bg-emerald-950/20",
  "border-orange-500/40 bg-orange-950/20",
  "border-pink-500/40 bg-pink-950/20",
];
const COL_ACCENTS = ["text-blue-400", "text-purple-400", "text-emerald-400", "text-orange-400", "text-pink-400"];

export default function CompareView({ pinned, onRemove, currency, units }: Props) {
  if (pinned.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center text-gray-600 text-xs px-4">
        <div>
          <svg className="w-8 h-8 mx-auto mb-2 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
          <p>Pin destinations from the list<br />to compare them side-by-side</p>
          <p className="text-gray-700 mt-1">(up to 5)</p>
        </div>
      </div>
    );
  }

  const fareIdx  = bestIdx(pinned.map((d) => d.fareDisplay));
  const hoursIdx = bestIdx(pinned.map((d) => d.flightHours));
  const distIdx  = bestIdx(pinned.map((d) => d.distanceKm));

  return (
    <div className="h-full overflow-hidden flex flex-col" role="region" aria-label="Destination comparison">
      <div className="px-3 pt-2.5 pb-1.5 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Compare</span>
          <span className="text-[10px] text-gray-600">{pinned.length}/5 destinations</span>
        </div>
      </div>

      <div className="mx-2 mt-2 mb-1 shrink-0 flex items-center gap-1.5 text-[10px] text-yellow-700 bg-yellow-950/20 border border-yellow-900/30 rounded px-2 py-1">
        <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" />
        </svg>
        All prices are estimates -- not live quotes
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex gap-2 p-2 min-h-full" style={{ minWidth: `${pinned.length * 160}px` }}>
          {pinned.map((d, i) => (
            <div key={d.iata} className={`flex-1 min-w-[150px] rounded-lg border ${COL_COLORS[i]} flex flex-col`}>
              <div className="p-2.5 border-b border-white/5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className={`text-base font-mono font-bold ${COL_ACCENTS[i]}`}>{d.iata}</span>
                      {d.confidence === "live" && (
                        <span className="text-[8px] text-emerald-600 bg-emerald-950/40 px-1 rounded">live</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5 line-clamp-2">{d.name}</p>
                    <p className="text-[9px] text-gray-600">{CONTINENT_NAMES[d.continent] ?? d.continent}</p>
                  </div>
                  <button
                    onClick={() => onRemove(d.iata)}
                    aria-label={`Remove ${d.iata} from comparison`}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors text-xs"
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="flex-1 p-2.5 space-y-3">
                <div>
                  <p className="text-[9px] text-gray-600 mb-0.5">Est. fare</p>
                  <p className={`text-sm font-bold ${i === fareIdx ? "text-emerald-400" : "text-gray-200"}`}>
                    {currency} {d.fareDisplay.toLocaleString()}
                  </p>
                  {i === fareIdx && pinned.length > 1 && (
                    <p className="text-[9px] text-emerald-600">cheapest</p>
                  )}
                </div>

                <div>
                  <p className="text-[9px] text-gray-600 mb-0.5">Flight time</p>
                  <p className={`text-sm font-semibold ${i === hoursIdx ? "text-emerald-400" : "text-gray-200"}`}>
                    {formatHours(d.flightHours)}
                  </p>
                  <p className="text-[9px] text-gray-600">{d.isDirect ? "direct*" : "via hub*"}</p>
                </div>

                <div>
                  <p className="text-[9px] text-gray-600 mb-0.5">Distance</p>
                  <p className={`text-sm font-semibold ${i === distIdx ? "text-emerald-400" : "text-gray-200"}`}>
                    {formatDist(d.distanceKm, units)}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] text-gray-600 mb-0.5">Country</p>
                  <p className="text-xs text-gray-300">{d.iso}</p>
                </div>

                <div>
                  <p className="text-[9px] text-gray-600 mb-1">Seasonality</p>
                  <SeasonBar lat={d.lat} lon={d.lon} compact units={units} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-gray-700 shrink-0">
        * Routing and prices are heuristic estimates
      </div>
    </div>
  );
}
