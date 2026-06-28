"use client";

import { useEffect, useState } from "react";

type StatusLevel = "live" | "estimated" | "unavailable";

interface Provider {
  name: string;
  label: string;
  status: StatusLevel;
  latencyMs?: number;
  note?: string;
}

interface StatusData {
  overall: StatusLevel;
  providers: Provider[];
  checkedAt: string;
}

const DOT: Record<StatusLevel, string> = {
  live: "bg-emerald-500",
  estimated: "bg-yellow-500",
  unavailable: "bg-red-500",
};

const LABEL: Record<StatusLevel, string> = {
  live: "live",
  estimated: "estimated",
  unavailable: "unavailable",
};

const TEXT: Record<StatusLevel, string> = {
  live: "text-emerald-400",
  estimated: "text-yellow-400",
  unavailable: "text-red-400",
};

export default function ProviderStatus() {
  const [data, setData] = useState<StatusData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const overall = data?.overall ?? "estimated";

  return (
    <div className="relative hidden lg:block shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
        aria-label="Data provider status"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[overall]}`} />
        <span className={TEXT[overall]}>{LABEL[overall]}</span>
      </button>

      {open && (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-surface-raised border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/5">
              <p className="text-xs font-medium text-gray-300">Data providers</p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {data ? `Checked ${new Date(data.checkedAt).toLocaleTimeString()}` : "Checking..."}
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(data?.providers ?? []).map((p) => (
                <div key={p.name} className="px-3 py-2 flex items-start gap-2.5">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${DOT[p.status]}`} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-gray-300">{p.label}</span>
                      <span className={`text-[9px] ${TEXT[p.status]}`}>{LABEL[p.status]}</span>
                      {p.latencyMs !== undefined && p.status === "live" && (
                        <span className="text-[9px] text-gray-700">{p.latencyMs}ms</span>
                      )}
                    </div>
                    {p.note && <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{p.note}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-white/5 text-[9px] text-gray-700">
              Atlas runs keyless by default. All estimated data is labelled.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
