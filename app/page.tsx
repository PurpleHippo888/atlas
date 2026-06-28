"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import HUD, { type AppMode, type Units } from "@/components/HUD";
import Filters, { type FilterState } from "@/components/Filters";
import ResultsList from "@/components/ResultsList";
import DestinationDrawer from "@/components/DestinationDrawer";
import CompareView from "@/components/CompareView";
import type { OriginLocation } from "@/components/OriginSelector";
import type { DestinationResult } from "@/app/api/explore/route";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DEFAULT_FILTERS: FilterState = {
  maxBudget: null,
  maxHours: null,
  directOnly: false,
  continents: [],
};

const MAX_PINNED = 5;

export default function DashboardPage() {
  const [mode, setMode] = useState<AppMode>("explore");
  const [origin, setOrigin] = useState<OriginLocation | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [units, setUnits] = useState<Units>("metric");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [destinations, setDestinations] = useState<DestinationResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIata, setSelectedIata] = useState<string | null>(null);
  const [pinnedIatas, setPinnedIatas] = useState<string[]>([]);
  const [sort, setSort] = useState<"value" | "price" | "time" | "distance">("value");
  const [showPanel, setShowPanel] = useState(true);

  const fetchDestinations = useCallback(async () => {
    if (!origin?.nearestAirport) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        origin: origin.nearestAirport.iata,
        currency,
        limit: "200",
      });
      if (filters.maxBudget) params.set("maxBudget", String(filters.maxBudget));
      if (filters.maxHours) params.set("maxHours", String(filters.maxHours));
      if (filters.directOnly) params.set("directOnly", "true");
      if (filters.continents.length > 0) params.set("continent", filters.continents.join(","));

      const res = await fetch(`/api/explore?${params}`);
      const data = await res.json();
      setDestinations(data.results ?? []);
      setTotalCount(data.meta?.total ?? 0);
    } catch {
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, [origin, currency, filters]);

  useEffect(() => {
    if (origin) fetchDestinations();
    else setDestinations([]);
  }, [origin, fetchDestinations]);

  useEffect(() => {
    setPinnedIatas([]);
    setSelectedIata(null);
  }, [origin]);

  function handleTogglePin(iata: string) {
    setPinnedIatas((prev) => {
      if (prev.includes(iata)) return prev.filter((x) => x !== iata);
      if (prev.length >= MAX_PINNED) return prev;
      return [...prev, iata];
    });
  }

  function handleMapSelect(iata: string) {
    if (mode === "compare") {
      handleTogglePin(iata);
    } else {
      setSelectedIata(iata === selectedIata ? null : iata);
    }
  }

  const selectedDest = destinations.find((d) => d.iata === selectedIata) ?? null;
  const pinnedDests = pinnedIatas
    .map((id) => destinations.find((d) => d.iata === id))
    .filter(Boolean) as DestinationResult[];

  const showRightPanel = mode === "compare" || (mode === "explore" && selectedDest !== null);

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      <HUD
        mode={mode}
        onModeChange={(m) => { setMode(m); setSelectedIata(null); }}
        origin={origin}
        onOriginChange={(loc) => { setOrigin(loc); setSelectedIata(null); setDestinations([]); }}
        currency={currency}
        onCurrencyChange={(c) => { setCurrency(c); }}
        units={units}
        onUnitsChange={setUnits}
      />

      <div className="flex-1 flex overflow-hidden mt-[46px]">
        {origin && showPanel && (
          <div className="w-72 shrink-0 flex flex-col bg-surface-raised border-r border-white/5 overflow-hidden z-10">
            <Filters filters={filters} onChange={setFilters} currency={currency} units={units} />
            <ResultsList
              results={destinations}
              loading={loading}
              selected={selectedIata}
              onSelect={(iata) => setSelectedIata(iata === selectedIata ? null : iata)}
              sort={sort}
              onSortChange={setSort}
              currency={currency}
              total={totalCount}
              mode={mode}
              pinnedIatas={pinnedIatas}
              onTogglePin={handleTogglePin}
              units={units}
            />
          </div>
        )}

        {origin && (
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="absolute top-1/2 -translate-y-1/2 z-20 mt-[23px] w-4 h-16 bg-surface-raised border border-white/10 border-l-0 rounded-r-md flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-surface-overlay transition-colors"
            style={{ left: showPanel ? "18rem" : "0" }}
            aria-label={showPanel ? "Hide panel" : "Show panel"}
          >
            <span className="text-[10px]">{showPanel ? "<" : ">"}</span>
          </button>
        )}

        <div className="flex-1 relative">
          <Map
            origin={origin}
            destinations={destinations}
            selected={selectedIata}
            onSelectDestination={handleMapSelect}
            pinned={pinnedIatas}
          />
          {!origin && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-600 select-none">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <p className="text-sm">Enter your departure city above</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-6 left-2 z-10 text-[10px] text-gray-700 pointer-events-none">
            Airports: OpenFlights | Open-Meteo CC-BY 4.0 | (c) OpenStreetMap contributors
          </div>
        </div>

        {showRightPanel && (
          <div className={`shrink-0 bg-surface-raised border-l border-white/10 overflow-hidden z-20 ${mode === "compare" ? "w-[480px]" : "w-80"}`}>
            {mode === "compare" ? (
              <CompareView
                pinned={pinnedDests}
                onRemove={(iata) => setPinnedIatas((p) => p.filter((x) => x !== iata))}
                currency={currency}
                units={units}
              />
            ) : (
              <DestinationDrawer
                destination={selectedDest}
                onClose={() => setSelectedIata(null)}
                currency={currency}
                units={units}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
