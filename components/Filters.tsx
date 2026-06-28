"use client";

import type { Units } from "./HUD";

export interface FilterState {
  maxBudget: number | null;
  maxHours: number | null;
  directOnly: boolean;
  continents: string[];
}

const CONTINENTS = [
  { code: "EU", label: "Europe" },
  { code: "AS", label: "Asia" },
  { code: "NA", label: "N. America" },
  { code: "SA", label: "S. America" },
  { code: "AF", label: "Africa" },
  { code: "OC", label: "Oceania" },
];

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  currency: string;
  units: Units;
}

export default function Filters({ filters, onChange, currency, units }: Props) {
  function update(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }

  function toggleContinent(code: string) {
    const set = new Set(filters.continents);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    update({ continents: Array.from(set) });
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface-raised border-b border-white/5">
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="text-xs text-gray-500 block mb-1">Max budget ({currency})</span>
          <input
            type="number"
            placeholder="Any"
            value={filters.maxBudget ?? ""}
            onChange={(e) => update({ maxBudget: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full bg-surface-overlay border border-white/10 rounded px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-accent/50"
            aria-label={`Maximum budget in ${currency}`}
          />
        </label>
        <label className="flex-1">
          <span className="text-xs text-gray-500 block mb-1">Max flight hrs</span>
          <input
            type="number"
            placeholder="Any"
            step="0.5"
            value={filters.maxHours ?? ""}
            onChange={(e) => update({ maxHours: e.target.value ? parseFloat(e.target.value) : null })}
            className="w-full bg-surface-overlay border border-white/10 rounded px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-accent/50"
            aria-label="Maximum flight hours"
          />
        </label>
      </div>

      {/* Direct only toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          role="switch"
          aria-checked={filters.directOnly}
          onClick={() => update({ directOnly: !filters.directOnly })}
          className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${filters.directOnly ? "bg-accent" : "bg-surface-overlay border border-white/20"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${filters.directOnly ? "translate-x-4" : ""}`} />
        </button>
        <span className="text-xs text-gray-400">
          Direct flights only <span className="text-gray-600">(estimated)</span>
        </span>
      </label>

      {/* Continent filter */}
      <div>
        <span className="text-xs text-gray-500 block mb-1.5">Region</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by region">
          {CONTINENTS.map((c) => {
            const selected = filters.continents.includes(c.code);
            return (
              <button
                key={c.code}
                onClick={() => toggleContinent(c.code)}
                aria-pressed={selected}
                className={`px-2 py-0.5 rounded text-xs transition-colors border ${
                  selected
                    ? "bg-accent/20 border-accent/50 text-accent"
                    : "bg-surface-overlay border-white/10 text-gray-400 hover:text-gray-200"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Units info */}
      <p className="text-[9px] text-gray-700">
        Distances shown in {units === "metric" ? "kilometres" : "miles"}
      </p>
    </div>
  );
}
