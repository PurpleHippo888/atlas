"use client";

import OriginSelector, { type OriginLocation } from "./OriginSelector";
import ProviderStatus from "./ProviderStatus";

export type AppMode = "explore" | "compare";
export type Units = "metric" | "imperial";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "INR", "BRL", "MXN", "SGD", "HKD"];

interface HUDProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  origin: OriginLocation | null;
  onOriginChange: (loc: OriginLocation | null) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  units: Units;
  onUnitsChange: (u: Units) => void;
}

export default function HUD({
  mode, onModeChange, origin, onOriginChange,
  currency, onCurrencyChange, units, onUnitsChange,
}: HUDProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-2.5 bg-surface-raised/90 backdrop-blur border-b border-white/5">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <svg className="w-5 h-5 text-accent-glow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span className="text-sm font-semibold tracking-wide text-white hidden sm:inline">Atlas</span>
      </div>

      <div className="w-px h-5 bg-white/10 shrink-0" />

      <OriginSelector value={origin} onChange={onOriginChange} />

      <div className="w-px h-5 bg-white/10 shrink-0 hidden sm:block" />

      {/* Mode toggle */}
      <div className="hidden sm:flex items-center bg-surface-overlay rounded-md p-0.5 text-xs font-medium shrink-0">
        <button
          onClick={() => onModeChange("explore")}
          className={`px-3 py-1.5 rounded transition-colors ${mode === "explore" ? "bg-accent text-white" : "text-gray-400 hover:text-gray-200"}`}
        >
          Explore
        </button>
        <button
          onClick={() => onModeChange("compare")}
          className={`px-3 py-1.5 rounded transition-colors ${mode === "compare" ? "bg-accent text-white" : "text-gray-400 hover:text-gray-200"}`}
        >
          Compare
        </button>
      </div>

      <div className="flex-1" />

      {/* Units toggle */}
      <button
        onClick={() => onUnitsChange(units === "metric" ? "imperial" : "metric")}
        className="hidden md:flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 bg-surface-overlay border border-white/10 px-2 py-1 rounded transition-colors shrink-0"
        aria-label="Toggle distance units"
      >
        <span className={units === "metric" ? "text-gray-200" : ""}>km</span>
        <span className="text-gray-700">/</span>
        <span className={units === "imperial" ? "text-gray-200" : ""}>mi</span>
      </button>

      {/* Currency selector */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-600">Currency</span>
        <select
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="bg-surface-overlay border border-white/10 text-xs text-gray-200 rounded px-1.5 py-1 outline-none focus:border-accent/50 cursor-pointer"
          aria-label="Display currency"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Origin chip */}
      {origin?.nearestAirport && (
        <div className="hidden md:flex items-center gap-1.5 text-xs bg-surface-overlay px-2.5 py-1 rounded-full border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="font-mono text-accent">{origin.nearestAirport.iata}</span>
          <span className="text-gray-400 truncate max-w-[100px]">{origin.name.split(",")[0]}</span>
        </div>
      )}

      <ProviderStatus />
    </div>
  );
}
