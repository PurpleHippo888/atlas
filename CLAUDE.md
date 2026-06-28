# CLAUDE.md -- Atlas codebase guide for AI agents

This file is the primary briefing document for any AI agent working on Atlas.
Read it fully before touching code.

---

## What Atlas is

Atlas is a self-hostable global flight discovery dashboard. The core value
proposition: enter any city as origin, see reachable destinations worldwide
with estimated fares, flight times, 12-month seasonality, and FX conversion --
all with zero API keys required.

Two modes:
- **Explore** -- ranked list + arc map, filters, destination detail drawer
- **Compare** -- pin up to 5 destinations, side-by-side grid with season bars

Two data tiers:
- **Tier-1 (keyless)** -- all open/free sources, always on
- **Tier-2 (optional)** -- Amadeus API for live fares, activated by env vars

Single Docker container: `docker compose up -d`.

---

## Tech stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | 15.3.3 (pinned) |
| Language | TypeScript | 5.7 |
| Map | MapLibre GL JS | 4.7 |
| Tiles | OpenFreeMap (Liberty style) | keyless |
| CSS | Tailwind CSS v3 | dark "control-room" palette |
| Compiler | SWC native | must match Next.js version exactly |
| Runtime | Node.js | 22 (Docker: node:22-alpine) |

---

## CRITICAL: SWC and the Unicode rule

**This is the single most dangerous footgun in the codebase.**

Next.js 15.3.3 uses SWC as its compiler. SWC 15.3.3 crashes with a misleading
"Unexpected token" JSX error if ANY source file contains a non-ASCII byte
(any character above U+007F).

### What causes it

- The `Edit` tool (in Claude/Cowork) silently inserts invisible control
  characters or non-ASCII bytes when making inline edits
- Smart quotes, em-dashes, ellipses, copyright symbols all trigger the crash
- The error points to the wrong line (usually the first JSX tag) making it
  look like a JSX parser bug, not an encoding bug

### The rule

**NEVER use the Edit tool to modify .ts or .tsx files.**

Safe alternatives:

1. Python write via bash (most reliable):

       python3 /tmp/write_file.py

   Where write_file.py uses open(..., 'w').write(content) with a plain string
   variable. Avoid f-strings if content has curly braces.

2. Bash heredoc (works if content has no backticks, dollar signs, or parens
   in shell-special positions):

       cat > /path/to/file.tsx << 'EOFILE'
       ...content...
       EOFILE

3. Write tool (Cowork): can write arbitrary content. Requires reading the file
   first if it already exists.

### Verification after every file write

    python3 -c "
    data = open('FILE_PATH','rb').read()
    bad = [i for i,b in enumerate(data) if b > 127]
    print('OK' if not bad else 'NON-ASCII bytes: ' + str(bad[:5]))
    "

### Build environment note

The workspace sandbox blocks outbound DNS and HTTP from Node.js. All external
API calls (Open-Meteo, Frankfurter, REST Countries, Nominatim, Amadeus) will
fail with EAI_AGAIN. This is expected -- every route has a graceful fallback.
The app works correctly in Docker/production.

**Build workflow:**

1. Write files to C:\Projects\Atlas (the workspace folder)
2. The bash environment sees this as /sessions/.../mnt/Atlas/
3. Sync to /tmp/atlas-install/ which has a complete node_modules
4. Run: cd /tmp/atlas-install && node_modules/.bin/next build
5. A clean build with 0 TypeScript errors confirms the source is correct

Never run npm install in the workspace -- node_modules there may be stale.
/tmp/atlas-install/ is the canonical build environment. If it's corrupted:

    rsync -a /sessions/.../mnt/Atlas/. /tmp/atlas-install/
    cd /tmp/atlas-install && npm install

### SWC binary pinning

All 5 platform SWC binaries must be pinned to the SAME version as Next.js
in package.json optionalDependencies. Currently pinned at 15.3.3:

    "@next/swc-darwin-arm64": "15.3.3"
    "@next/swc-darwin-x64": "15.3.3"
    "@next/swc-linux-x64-gnu": "15.3.3"
    "@next/swc-linux-x64-musl": "15.3.3"
    "@next/swc-win32-x64-msvc": "15.3.3"

If Next.js is upgraded, all 5 SWC entries must be bumped in lockstep.

---

## Directory structure

    C:\Projects\Atlas\
    |
    |-- app/
    |   |-- page.tsx                Root page -- client shell, all state lives here
    |   |-- layout.tsx              HTML shell, Tailwind globals
    |   |-- globals.css             MapLibre CSS import + dark overrides
    |   `-- api/
    |       |-- explore/route.ts    GET /api/explore   ranked destinations
    |       |-- climate/route.ts    GET /api/climate   Open-Meteo ERA5 season normals
    |       |-- geocode/route.ts    GET /api/geocode   city string -> nearest airport
    |       |-- fx/route.ts         GET /api/fx        currency exchange rate
    |       |-- airports/route.ts   GET /api/airports  airport GeoJSON
    |       |-- countries/route.ts  GET /api/countries REST Countries lookup
    |       |-- status/route.ts     GET /api/status    per-provider health check
    |       `-- health/route.ts     GET /api/health    container healthcheck
    |
    |-- components/
    |   |-- Map.tsx                 MapLibre GL JS map (dynamic import, ssr:false)
    |   |-- HUD.tsx                 Top bar: origin, mode, currency, units, status
    |   |-- OriginSelector.tsx      Debounced city search -> airport lookup
    |   |-- Filters.tsx             Budget, hours, direct, continent filters
    |   |-- ResultsList.tsx         Sortable destination list (explore + compare)
    |   |-- DestinationDrawer.tsx   Destination detail panel (fare, season, deals)
    |   |-- CompareView.tsx         Side-by-side comparison grid (up to 5 dests)
    |   |-- SeasonBar.tsx           12-month weather+demand bar
    |   `-- ProviderStatus.tsx      HUD status chip + provider dropdown
    |
    |-- lib/
    |   |-- openflights.ts          Airport dataset singleton + reachability heuristic
    |   |-- fareEstimator.ts        Distance-band fare model (always "estimated")
    |   |-- seasonModel.ts          Weather classification + demand heuristic
    |   |-- cache.ts                In-memory LRU cache, max 500 entries, TTL constants
    |   |-- rateLimit.ts            Sliding-window per-IP rate limiter
    |   `-- providers/
    |       `-- amadeus.ts          Tier-2 Amadeus client (OAuth2, optional)
    |
    |-- data/
    |   `-- airports.json           6345 airports: IATA, lat/lon, iso, continent, size
    |
    |-- Dockerfile                  3-stage alpine: deps -> builder -> runner
    |-- docker-compose.yml          Single-container deploy
    |-- README.md                   User-facing documentation
    |-- DOCKER.md                   Deployment guide
    `-- CLAUDE.md                   This file

---

## Data flow

### Explore

    User types city
      -> OriginSelector (debounce 350ms) -> GET /api/geocode?q=...
         Primary: Open-Meteo geocoding
         Fallback: Nominatim
         Returns: nearest non-small airport within 200km
      -> page.tsx sets `origin` state -> fetchDestinations()
      -> GET /api/explore?origin=LHR&currency=USD&limit=200
         -> getReachableAirports(LHR) -- size-heuristic, up to 600 candidates
         -> (optional) getFlightInspiration(LHR) -- Amadeus live fares ~10 dests
         -> Per airport: haversine distance, fare estimate or live price,
            isDirect heuristic, flightHours
         -> Filter: military, size=small, <80km, budget/hours/continent
         -> Sort: value score = fareDisplay/100 + flightHours*5
      -> Map: great-circle arcs + destination dots
      -> User clicks destination -> DestinationDrawer
         -> GET /api/climate?lat=...&lon=... (cached 30d)
         -> buildSeasonBar() -> 12 MonthData objects
         -> getDealMonths() -> off-peak + good/great weather -> green badge

### Compare

    User switches to Compare mode
      -> ResultsList shows pin icons (max 5 pins via MAX_PINNED)
      -> Map: pinned arcs turn violet (#a78bfa)
      -> CompareView: one column per destination, cheapest/fastest highlighted

---

## Key design decisions

### Airport reachability heuristic

routes.dat is not bundled. Reachability is approximated by airport size:
- Large origin: all large + medium worldwide; small within 2000km
- Medium origin: all large; same-continent medium; small within 800km
- Small origin: large; same-continent medium within 1500km; small within 500km

Military airports are filtered by name regex:
  /\bRAF\b/, /\bAFB\b/, /\bNAES\b/, /\bNAS\b/, naval, army air, military,
  McGuire, Lakehurst, Fairford

Minimum distance: 80km (excludes airports too close to origin to be useful).

### isDirect heuristic

- large + large: always
- large + medium (or reverse): if distanceKm < 5000
- medium + medium: if same continent
- any small: never

### Fare estimation (lib/fareEstimator.ts)

Three distance bands, always returns confidence: "estimated", rounds to $5:
- 0-1500km:    base $60 + $0.18/km
- 1500-4000km: base $150 + $0.12/km
- 4000km+:     base $250 + $0.08/km

Continental multipliers: EU=0.95, NA=1.0, SA=1.05, AS=0.90, OC=1.15, AF=1.10

### Season model (lib/seasonModel.ts)

classifyWeather(tempC, precipMm) -> SeasonRating:
  great  = 18-32C + precip <= 120mm
  good   = 12C+ + precip <= 160mm
  hot    = >34C
  cold   = <3C
  wet    = >200mm
  mixed  = everything else

heuristicDemand(month, lat) -> DemandLevel:
  Northern (lat >= 15):  peak=Jul/Aug/Dec, shoulder=Jun/Sep/Mar/Apr
  Southern (lat <= -15): peak=Jan/Feb/Jun, shoulder=Dec/Mar/Sep/Oct
  Tropical (|lat| < 15): peak=Dec/Jan/Jul/Aug

Deal months = offpeak demand AND (great OR good weather).

### Cache TTLs (lib/cache.ts)

  FX:      12 hours   -- TTL.FX
  CLIMATE: 30 days    -- TTL.CLIMATE
  COUNTRY: 30 days    -- TTL.COUNTRY
  GEOCODE: 30 days    -- TTL.GEOCODE
  PRICES:  6 hours    -- TTL.PRICES
  SHORT:   5 minutes  -- TTL.SHORT

Max 500 entries; oldest evicted when full.

### Tailwind colour tokens (tailwind.config.ts)

  surface.DEFAULT  #0d1117  -- page background
  surface.raised   #161b22  -- panels, HUD
  surface.overlay  #1c2230  -- cards, inputs
  accent.DEFAULT   #3b82f6  -- blue
  accent.glow      #60a5fa  -- lighter blue
  deal             #22c55e  -- green (deal months, live badges)
  peak             #f97316  -- orange (peak demand dots)
  offpeak          #3b82f6  -- blue (offpeak dots)
  shoulder         #eab308  -- yellow (shoulder dots)

Map colours:
  Pinned arcs/dots: violet #a78bfa
  Selected arc/dot: blue #60a5fa
  Default arcs:     dark navy #1e3a5f

CompareView column colours (COL_COLORS array):
  blue, purple, emerald, orange, pink

---

## Key interfaces

### DestinationResult -- exported from app/api/explore/route.ts

  iata: string          IATA airport code
  name: string          airport name
  lat, lon: number
  iso: string           ISO 3166-1 alpha-2
  continent: string     AF AS EU NA OC SA AN
  size: string          large medium small
  distanceKm: number
  flightHours: number
  isDirect: boolean
  fareUsd: number       always USD internally
  fareDisplay: number   converted to user currency
  currency: string      user-selected currency code
  confidence: "estimated" | "live"

### OriginLocation -- exported from components/OriginSelector.tsx

  name: string
  lat, lon: number
  nearestAirport: { iata, name, distanceKm }

### MonthData -- from lib/seasonModel.ts

  month: number         1-12
  label: string         "Jan"..."Dec"
  avgTempC: number
  precipMm: number
  weatherRating: SeasonRating
  demand: DemandLevel
  overall: "best" | "good" | "ok" | "avoid"

### AppMode and Units -- exported from components/HUD.tsx

  type AppMode = "explore" | "compare"
  type Units   = "metric" | "imperial"

---

## Adding a new API route

1. Create app/api/yourroute/route.ts
2. Add: export const dynamic = "force-dynamic"
3. Export: export async function GET(req: NextRequest): Promise<NextResponse>
4. Use cacheGet/cacheSet from @/lib/cache with TTL.* constants
5. Add a HEAD probe in /api/status/route.ts if it calls an external service
6. Write file with Python or Write tool -- never the Edit tool
7. Add checkRateLimit call for compute-heavy or external-API routes

Rate limit snippet:

  if (!checkRateLimit(getClientIp(req), 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

---

## Adding a new component

1. Add "use client" if the component uses hooks or browser APIs
2. Accept units: Units prop when displaying distances or temperatures
3. Accept currency: string prop when displaying monetary values
4. Import Units from "./HUD" (shared type)
5. Distances: km * 0.621371 for miles
6. Temperatures: C * 9/5 + 32 for Fahrenheit
7. Write file with Python or Write tool -- never the Edit tool

---

## Amadeus Tier-2

Activated by env vars: AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET
AMADEUS_ENV=production -> Enterprise endpoint (api.amadeus.com)
AMADEUS_ENV unset/other -> self-service test endpoint (deprecated)

DECOMMISSION: The Amadeus "for Developers" self-service portal and its
test.api.amadeus.com endpoint are decommissioned on 2026-07-17. After that
only the Enterprise APIs remain (api.amadeus.com); use Enterprise credentials
with AMADEUS_ENV=production. amadeus.ts warns once (console.warn) when the
deprecated self-service endpoint is selected. Amadeus stays a soft dependency:
a missing/unreachable key degrades live fares to "estimated" without breaking.

lib/providers/amadeus.ts:
- isAmadeusEnabled() -- guard for all callers
- getAccessToken()  -- OAuth2 client credentials, module-level token cache
- getFlightInspiration(originIata, maxPrice?) -- cached TTL.PRICES (6h)
- probeAmadeus()    -- HEAD connectivity check for /api/status

To add a new Amadeus endpoint: add an exported function to amadeus.ts,
call isAmadeusEnabled() first, use getAccessToken(), cache the result,
return empty array on any error. Never propagate Amadeus errors upward.

---

## Map architecture (components/Map.tsx)

Must be loaded with ssr:false in page.tsx:

  const Map = dynamic(() => import("@/components/Map"), { ssr: false });

MapLibre GL JS references browser globals and crashes in Node.js SSR.

Three useEffect hooks (must stay separate to avoid map re-init):
  1. deps []              -- map init, add sources, add layers, attach click events
  2. deps [origin]        -- update origin GeoJSON source, flyTo new origin
  3. deps [origin, destinations, selected, pinned] -- update arcs + dots

makeArc() uses Math.max(-1, Math.min(1, dot_product)) to guard acos domain.
Arc features capped at destinations.slice(0, 150) for render performance.

---

## Provider health check (/api/status)

Probes each service with HEAD request and 3s timeout. Providers:
  Open-Meteo climate, jsDelivr CDN, REST Countries, Nominatim, Amadeus (optional)

Per-provider response: { name, status: "ok"|"degraded"|"down", latencyMs, note }
Overall: "live" all-ok / "estimated" any-degraded / "unavailable" all-down

ProviderStatus component fetches /api/status once on mount, shows a dot chip
in HUD. No auto-refresh (add 60s interval for production if desired).

---

## Honest labelling (non-negotiable)

All displayed fares must show one of:
  - "est." or "estimated" label  ->  confidence: "estimated"
  - green "live" badge           ->  confidence: "live" from Amadeus

This is enforced in ResultsList, DestinationDrawer, and CompareView.
The price disclaimer banner in DestinationDrawer appears only for estimated fares.
Never remove this labelling. Never present estimated data as a real fare.

---

## Enhancement roadmap (M9+)

High value / low complexity:
- Travelpayouts Tier-2 provider -- same pattern as Amadeus, adds booking links
- Month picker filter -- re-sort results by a chosen travel month's overallRating
- "Best pick" highlight card -- top result above the list with season context
- Keyboard shortcuts -- e/c mode, Escape, arrow nav, p to pin

Medium value / medium complexity:
- Disk cache -- serialize in-memory cache to .cache/atlas.json; Docker volume ready
- Saved origins -- localStorage, last 5 searches as quick-pick chips
- Calendar heatmap -- 12-month grid coloured by overallRating per destination
- Mobile layout -- bottom-sheet drawer, swipe-to-dismiss

High value / higher complexity:
- Real routes.dat -- replace size-heuristic with actual airline route data;
  source: openflights.org/data/routes.dat (2.7MB)
- Airport direct search -- IATA/airport name lookup in OriginSelector
- Multi-city routing -- A->B->C with cumulative fares
- PWA + offline shell -- service worker + custom tile server

---

## Do NOT

- Use the Edit tool on .ts or .tsx files (Unicode corruption)
- Upgrade Next.js without bumping all 5 SWC optionalDependencies in lockstep
- Expose secrets to the browser (NEXT_PUBLIC_ only for the tile URL)
- Display a fare without "est." label or "live" badge
- Remove fallback chains in API routes (keyless operation is required)
- Import MapLibre outside Map.tsx or without ssr:false dynamic import
- Add lodash, axios, date-fns, or other heavy utilities (bundle must stay small)

---

## Pre-commit checklist

1. All modified .ts/.tsx files: python3 ASCII scanner shows OK
2. next build passes with 0 TypeScript errors
3. Every fare has "est." label or Amadeus "live" badge
4. New env vars have fallbacks (app runs fully keyless)
5. New API routes: export dynamic = "force-dynamic", return NextResponse JSON
6. New components: accept units + currency props where displaying measurements
