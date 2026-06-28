"use client";

import type { DestinationResult } from "@/app/api/explore/route";
import type { AppMode, Units } from "./HUD";

type SortKey = "value" | "price" | "time" | "distance";

interface Props {
  results: DestinationResult[];
  loading: boolean;
  selected: string | null;
  onSelect: (iata: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  currency: string;
  total: number;
  mode?: AppMode;
  pinnedIatas?: string[];
  onTogglePin?: (iata: string) => void;
  units: Units;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Best value" },
  { key: "price", label: "Price" },
  { key: "time", label: "Flight time" },
  { key: "distance", label: "Distance" },
];

const CONTINENT_NAMES: Record<string, string> = {
  EU: "Europe", AS: "Asia", NA: "N. America", SA: "S. America",
  AF: "Africa", OC: "Oceania", AN: "Antarctica",
};

function formatHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDist(km: number, units: Units) {
  if (units === "imperial") {
    const mi = Math.round(km * 0.621371 / 100) / 10;
    return `~${mi}k mi`;
  }
  return `~${Math.round(km / 100) / 10}k km`;
}

function sortedResults(results: DestinationResult[], sort: SortKey) {
  return [...results].sort((a, b) => {
    if (sort === "price") return a.fareDisplay - b.fareDisplay;
    if (sort === "time") return a.flightHours - b.flightHours;
    if (sort === "distance") return a.distanceKm - b.distanceKm;
    return (a.fareDisplay / 100 + a.flightHours * 5) - (b.fareDisplay / 100 + b.flightHours * 5);
  });
}

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-colors ${pinned ? "text-purple-400 fill-purple-400" : "text-gray-600 fill-none"}`}
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path d="M12 2l3 7h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z" />
    </svg>
  );
}

export default function ResultsList({
  results, loading, selected, onSelect, sort, onSortChange, currency, total,
  mode, pinnedIatas = [], onTogglePin, units,
}: Props) {
  const sorted = sortedResults(results, sort);
  const isCompare = mode === "compare";
  const pinnedSet = new Set(pinnedIatas);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 pt-2 pb-1.5 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            {loading ? "Searching..." : `${total} destinations`}
          </span>
          {isCompare ? (
            <span className="text-[10px] text-purple-500 bg-purple-950/30 border border-purple-900/40 px-1.5 py-0.5 rounded">
              pin to compare
            </span>
          ) : (
            <span className="text-[10px] text-gray-600 bg-surface-overlay px-1.5 py-0.5 rounded">
              est. prices
            </span>
          )}
        </div>
        <div className="flex gap-0.5" role="tablist" aria-label="Sort destinations">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              role="tab"
              aria-selected={sort === o.key}
              onClick={() => onSortChange(o.key)}
              className={`flex-1 text-[10px] px-1 py-1 rounded transition-colors ${
                sort === o.key ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" role="list" aria-label="Destination list">
        {loading && (
          <div className="flex items-center justify-center h-24 text-gray-600 text-xs">
            Loading destinations...
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-600 text-xs">
            No destinations match your filters.
          </div>
        )}
        {sorted.map((d) => {
          const isPinned = pinnedSet.has(d.iata);
          const isSelected = selected === d.iata;
          return (
            <div
              key={d.iata}
              role="listitem"
              className={`flex items-center border-b border-white/[0.04] transition-colors ${
                isSelected && !isCompare ? "bg-accent/10 border-l-2 border-l-accent" : ""
              } ${isPinned ? "bg-purple-950/10 border-l-2 border-l-purple-500/50" : ""}`}
            >
              {isCompare && onTogglePin && (
                <button
                  onClick={() => onTogglePin(d.iata)}
                  disabled={!isPinned && pinnedIatas.length >= 5}
                  aria-label={isPinned ? `Unpin ${d.iata}` : `Pin ${d.iata} for comparison`}
                  className={`px-2 py-3 transition-colors ${
                    isPinned ? "text-purple-400 hover:text-purple-300"
                    : pinnedIatas.length >= 5 ? "text-gray-700 cursor-not-allowed"
                    : "text-gray-600 hover:text-gray-300"
                  }`}
                >
                  <PinIcon pinned={isPinned} />
                </button>
              )}

              <button
                onClick={() => !isCompare && onSelect(d.iata)}
                aria-label={`${d.name} (${d.iata}) - ${currency} ${d.fareDisplay} est. fare`}
                className={`flex-1 text-left px-3 py-2.5 ${isCompare ? "cursor-default" : "hover:bg-surface-overlay"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-mono shrink-0 ${isPinned ? "text-purple-400" : "text-accent"}`}>{d.iata}</span>
                      <span className="text-xs text-gray-200 truncate">{d.name}</span>
                      {d.confidence === "live" && (
                        <span className="text-[8px] text-emerald-600 bg-emerald-950/40 px-1 rounded shrink-0">live</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
                      <span>{CONTINENT_NAMES[d.continent] ?? d.continent}</span>
                      <span className="text-gray-700">|</span>
                      <span>{formatHours(d.flightHours)}</span>
                      {d.isDirect && (
                        <>
                          <span className="text-gray-700">|</span>
                          <span className="text-emerald-600">direct*</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-gray-100">
                      {currency} {d.fareDisplay.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-600">{formatDist(d.distanceKm, units)}</div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
        {sorted.length > 0 && (
          <div className="px-3 py-2 text-[10px] text-gray-700 text-center">
            * estimated based on airport size -- prices are approximations
          </div>
        )}
      </div>
    </div>
  );
}
