"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { OriginLocation } from "./OriginSelector";
import type { DestinationResult } from "@/app/api/explore/route";

const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

interface Props {
  origin: OriginLocation | null;
  destinations: DestinationResult[];
  selected: string | null;
  onSelectDestination: (iata: string) => void;
  /** Extra IATAs to highlight (compare mode) */
  pinned?: string[];
}

/** Generate a great-circle arc as a GeoJSON LineString (approximated with 32 steps) */
function makeArc(
  lon1: number, lat1: number,
  lon2: number, lat2: number,
  steps = 32
): number[][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const r1 = toRad(lat1), r2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const d = Math.acos(
    Math.max(-1, Math.min(1,
      Math.sin(r1) * Math.sin(r2) + Math.cos(r1) * Math.cos(r2) * Math.cos(dLon)
    ))
  );
  if (d === 0) return [[lon1, lat1]];
  const pts: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(r1) * Math.cos(toRad(lon1)) + B * Math.cos(r2) * Math.cos(toRad(lon2));
    const y = A * Math.cos(r1) * Math.sin(toRad(lon1)) + B * Math.cos(r2) * Math.sin(toRad(lon2));
    const z = A * Math.sin(r1) + B * Math.sin(r2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts;
}

export default function Map({ origin, destinations, selected, onSelectDestination, pinned = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // The map click handler is attached once (init effect has deps []), so it would
  // otherwise capture the first render's onSelectDestination. Keep a ref pointing
  // at the latest callback so map clicks always use the current mode/handlers.
  const onSelectRef = useRef(onSelectDestination);
  onSelectRef.current = onSelectDestination;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: MapLibreMap;

    import("maplibre-gl").then((ml) => {
      map = new ml.Map({
        container: containerRef.current!,
        style: TILE_URL,
        center: [20, 20],
        zoom: 1.8,
        minZoom: 1,
        maxZoom: 18,
        attributionControl: false,
      });

      map.addControl(
        new ml.AttributionControl({
          customAttribution:
            '(c) <a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> | <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
          compact: true,
        }),
        "bottom-right"
      );
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        // Arcs source + layer
        map.addSource("arcs", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "arcs-line",
          type: "line",
          source: "arcs",
          paint: {
            "line-color": ["case", ["get", "pinned"], "#a78bfa", ["get", "selected"], "#60a5fa", "#1e3a5f"],
            "line-width": ["case", ["get", "pinned"], 2.0, ["get", "selected"], 1.5, 0.8],
            "line-opacity": ["case", ["get", "pinned"], 1.0, ["get", "selected"], 0.9, 0.4],
          },
        });

        // Destination dots
        map.addSource("destinations", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "dest-dots",
          type: "circle",
          source: "destinations",
          paint: {
            "circle-radius": ["case", ["get", "pinned"], 8, ["get", "selected"], 7, 4],
            "circle-color": ["case", ["get", "pinned"], "#a78bfa", ["get", "selected"], "#60a5fa", "#1e40af"],
            "circle-opacity": 0.9,
            "circle-stroke-color": ["case", ["get", "pinned"], "#ffffff", ["get", "selected"], "#ffffff", "#3b82f6"],
            "circle-stroke-width": ["case", ["get", "pinned"], 2, ["get", "selected"], 1.5, 0.5],
          },
        });

        // Origin source + layers
        map.addSource("origin", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "origin-pulse",
          type: "circle",
          source: "origin",
          paint: { "circle-radius": 18, "circle-color": "#3b82f6", "circle-opacity": 0.15 },
        });
        map.addLayer({
          id: "origin-dot",
          type: "circle",
          source: "origin",
          paint: {
            "circle-radius": 7,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });

        // Click on destination
        map.on("click", "dest-dots", (e) => {
          const iata = e.features?.[0]?.properties?.iata as string | undefined;
          if (iata) onSelectRef.current(iata);
        });
        map.on("mouseenter", "dest-dots", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const p = e.features?.[0]?.properties as { iata?: string; name?: string; fare?: number; currency?: string } | undefined;
          if (p) map.getCanvas().title = `${p.iata} - ${p.name} (~${p.currency} ${p.fare})`;
        });
        map.on("mouseleave", "dest-dots", () => {
          map.getCanvas().style.cursor = "";
          map.getCanvas().title = "";
        });
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update origin marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource("origin") as GeoJSONSource | undefined;
      if (!src) return;
      if (!origin) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }
      src.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: { type: "Point", coordinates: [origin.lon, origin.lat] }, properties: {} }],
      });
      map.flyTo({ center: [origin.lon, origin.lat], zoom: 2.5, duration: 1200 });
    };
    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [origin]);

  // Update arcs + destination dots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !origin) return;

    const update = () => {
      const arcSrc = map.getSource("arcs") as GeoJSONSource | undefined;
      const destSrc = map.getSource("destinations") as GeoJSONSource | undefined;
      if (!arcSrc || !destSrc) return;

      const pinnedSet = new Set(pinned);

      const arcFeatures = destinations.slice(0, 150).map((d) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: makeArc(origin.lon, origin.lat, d.lon, d.lat),
        },
        properties: {
          iata: d.iata,
          selected: d.iata === selected,
          pinned: pinnedSet.has(d.iata),
        },
      }));

      const dotFeatures = destinations.map((d) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [d.lon, d.lat] },
        properties: {
          iata: d.iata, name: d.name,
          fare: d.fareDisplay, currency: d.currency,
          selected: d.iata === selected,
          pinned: pinnedSet.has(d.iata),
        },
      }));

      arcSrc.setData({ type: "FeatureCollection", features: arcFeatures });
      destSrc.setData({ type: "FeatureCollection", features: dotFeatures });
    };

    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [origin, destinations, selected, pinned]);

  // Fly to selected destination
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const d = destinations.find((x) => x.iata === selected);
    if (d) map.easeTo({ center: [d.lon, d.lat], zoom: 4, duration: 800 });
  }, [selected, destinations]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#0d1117" }} />
  );
}
