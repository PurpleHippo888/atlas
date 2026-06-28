# Atlas — Global Travel Route Dashboard

<p>
  <a href="#quick-start"><img src="https://img.shields.io/badge/-Quick%20start-2563eb?style=flat-square" alt="Quick start" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-22+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 22+" /></a>
</p>

**Discover where you can fly from any city — no API keys required.**

Enter an origin city. Atlas plots reachable destinations worldwide on a great-circle map, ranks them by estimated cost and distance, overlays seasonal weather and demand heuristics, and converts prices to your currency. Every data source is free and open.

> Live flight pricing (via Amadeus Enterprise) is optional — without it, Atlas falls back to distance-based estimates. Nothing breaks either way.

---

## Screenshot

<img width="1917" height="896" alt="altas-dashboard" src="https://github.com/user-attachments/assets/9a590959-77cf-461b-92f4-5bdd1c72ef3a" />

---

## Quick start

```bash
git clone https://github.com/yourname/atlas
cd atlas
docker compose up -d
```

Open **http://localhost:3000** — that's it.

### Manual (no Docker)

```bash
npm install
npm run dev     # http://localhost:3000
```

Requires Node.js 22+.

---

## Features

- **Explore** — great-circle map + ranked destination list + filters (budget, hours, continent)
- **Compare** — pin up to 5 destinations side-by-side
- **Season bar** — 12-month weather & demand heuristic from ERA5 climate normals
- **Deal windows** — off-peak months with good weather highlighted per destination
- **FX conversion** — 12 currencies via jsDelivr / Frankfurter (ECB)
- **Provider status** — live HUD indicator per data source
- **Units toggle** — km / mi
- **Single container** — `docker compose up -d`, zero config

---

## Tier-1: fully keyless (default)

Atlas works out of the box with no API keys.

| Provider | Data | Licence |
|---|---|---|
| OpenFlights | Airport database (6345 airports) | ODbL |
| Open-Meteo | ERA5 climate normals (1991–2020) + geocoding | CC-BY 4.0 |
| fawazahmed0/currency-api | FX rates (150+ currencies) | MIT |
| Frankfurter (ECB) | FX fallback | Public domain |
| REST Countries | Country info + local currency | MPL 2.0 |
| OpenStreetMap / Nominatim | Geocoding fallback | ODbL |
| OpenFreeMap | Map tiles | ODbL |

All fares are distance-based estimates, clearly labelled as such.

---

## Tier-2: Amadeus live fares (optional)

> **Self-service sunset (2026-07-17):** The Amadeus self-service portal is being decommissioned. Live fares require **Enterprise** credentials from the [Amadeus Enterprise portal](https://amadeus.com/enterprise) (`api.amadeus.com`, `AMADEUS_ENV=production`).

Provision Enterprise credentials and add to `.env`:

```
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_...
```

When Amadeus is configured:
- Explore results show live minimum fares (Flight Inspiration Search)
- Live fares get a green "live" badge
- HUD provider status updates to "live"

Missing or expired keys are a soft failure — Atlas silently falls back to estimates.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ATLAS_PORT` | `3000` | Host port |
| `AMADEUS_CLIENT_ID` | — | Amadeus Enterprise client ID |
| `AMADEUS_CLIENT_SECRET` | — | Amadeus Enterprise client secret |
| `AMADEUS_ENV` | `test` | `production` = Enterprise endpoint |
| `NEXT_PUBLIC_TILE_URL` | OpenFreeMap Liberty | Custom MapLibre tile URL |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Map | [MapLibre GL JS](https://maplibre.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Runtime | Node.js 22+, Docker |
| Data | OpenFlights, Open-Meteo, Frankfurter, REST Countries, OpenFreeMap |

---

## Project structure

```
app/
  page.tsx               main page (client shell)
  api/
    explore/             ranked destinations + fare logic
    climate/             Open-Meteo ERA5 season normals
    geocode/             city → nearest airport
    fx/                  currency exchange rates
    countries/           REST Countries lookup
    status/              provider health check
    health/              container health endpoint
components/
  Map.tsx                MapLibre GL JS (browser-only)
  HUD.tsx                top bar: origin, mode, currency, units, status
  ResultsList.tsx         sortable destination list
  DestinationDrawer.tsx   destination detail panel
  CompareView.tsx         side-by-side comparison
  SeasonBar.tsx           12-month season / demand bar
  Filters.tsx             budget, hours, direct, continent filters
lib/
  openflights.ts          airport dataset + reachability heuristic
  fareEstimator.ts        distance-based fare estimation
  seasonModel.ts          weather classification + demand heuristic
  cache.ts                in-memory LRU cache with TTL
  rateLimit.ts            sliding-window rate limiter
  providers/
    amadeus.ts            optional Tier-2 Amadeus client
```

---

## Contributing

PRs welcome. Small diffs, focused commits.

- Open an issue first for non-trivial changes
- `npm run build` must pass
- Keep optional deps optional — no hard ties to paid APIs

---

## Licence

MIT. See individual data sources for their respective licences (table above).
