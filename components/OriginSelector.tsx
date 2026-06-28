"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface OriginLocation {
  name: string;
  lat: number;
  lon: number;
  countryCode: string;
  nearestAirport: { iata: string; name: string; distanceKm: number } | null;
}

interface GeoResult {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  nearestAirport: { iata: string; name: string; distanceKm: number } | null;
}

interface Props {
  value: OriginLocation | null;
  onChange: (location: OriginLocation | null) => void;
}

export default function OriginSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (val === "") { onChange(null); setResults([]); setOpen(false); }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  }

  function select(r: GeoResult) {
    setQuery(r.name);
    setOpen(false);
    onChange({ name: r.name, lat: r.lat, lon: r.lon, countryCode: r.countryCode, nearestAirport: r.nearestAirport });
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center gap-2 bg-surface-overlay border border-white/10 rounded-lg px-3 py-2 focus-within:border-accent/60 transition-colors">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <input
          type="text"
          placeholder="Flying from..."
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none w-full min-w-0"
          aria-label="Origin city or airport"
          autoComplete="off"
        />
        {loading && (
          <svg className="w-3.5 h-3.5 text-accent animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeDasharray="40 20" />
          </svg>
        )}
        {value?.nearestAirport && !loading && (
          <span className="text-xs font-mono text-accent shrink-0">{value.nearestAirport.iata}</span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-raised border border-white/10 rounded-lg overflow-hidden shadow-xl">
          {results.map((r, i) => (
            <li key={i}>
              <button
                className="w-full text-left px-3 py-2.5 hover:bg-surface-overlay text-sm transition-colors"
                onClick={() => select(r)}
              >
                <div className="text-gray-100 truncate">{r.name}</div>
                {r.nearestAirport && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    <span className="font-mono text-accent mr-1">{r.nearestAirport.iata}</span>
                    {r.nearestAirport.name}
                    <span className="text-gray-600 ml-1">({r.nearestAirport.distanceKm} km)</span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
