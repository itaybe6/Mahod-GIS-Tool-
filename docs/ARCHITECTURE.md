# Mahod GIS — Architecture

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture Diagram](#2-high-level-architecture-diagram)
3. [Component Breakdown](#3-component-breakdown)
   - [3.1 Frontend (SPA)](#31-frontend-spa)
   - [3.2 Supabase Backend](#32-supabase-backend)
   - [3.3 Edge Functions](#33-edge-functions)
   - [3.4 Update Agent](#34-update-agent--scheduled-data-ingestion)
   - [3.5 Data Sources](#35-data-sources-datagov)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
   - [4.1 Area Analysis Flow](#41-area-analysis-flow)
   - [4.2 File Upload & Save Flow](#42-file-upload--save-flow)
   - [4.3 Route Planner Flow](#43-route-planner-flow)
   - [4.4 Automated Update Agent Flow](#44-automated-update-agent-flow)
5. [Frontend Architecture Detail](#5-frontend-architecture-detail)
   - [5.1 Module Structure](#51-module-structure)
   - [5.2 State Management Layers](#52-state-management-layers)
   - [5.3 Routing](#53-routing)
6. [Database Schema (Key Tables)](#6-database-schema-key-tables)
7. [Framework & Technology Decisions](#7-framework--technology-decisions)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. System Overview

**Mahod GIS** is a Hebrew (RTL) GIS analysis tool for Israeli transportation data, built for Mahod Engineering. It enables engineers to:

- Upload, draw, and visualize geographic polygons
- Run spatial analysis over multiple data layers (GTFS transit, road accidents, infrastructure, roads)
- Plan transit routes (A→B using GTFS stop data)
- Browse tabular public-transport data
- Export analysis results as GeoJSON, CSV, HTML, or PDF
- Track data sources and monthly automatic updates from data.gov.il

The system is a **single-page application** (SPA) backed entirely by **Supabase** — there is no custom Node.js backend server. All persistent logic runs either in Postgres (PostGIS RPCs) or in Supabase Edge Functions (Deno runtime).

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER / BROWSER                                      │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                     React SPA  (Vite + TypeScript)                        │   │
│  │                                                                            │   │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ App Shell│  │  Zustand  │  │  React Query │  │   Map Engine         │  │   │
│  │  │ (layout, │  │  Stores   │  │  (server     │  │ Leaflet (2D default) │  │   │
│  │  │  routing)│  │ 7 domains │  │   state)     │  │ Mapbox GL (3D mode)  │  │   │
│  │  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  └──────────────────────┘  │   │
│  │       │              │               │                                      │   │
│  │       └──────────────┴───────────────┘                                      │   │
│  │                              │                                               │   │
│  │                    Supabase JS Client                                        │   │
│  └──────────────────────┬───────────────────────────────────────────────────┘   │
│                         │  HTTPS (anon key / JWT)                               │
└─────────────────────────┼───────────────────────────────────────────────────────┘
                          │
          ┌───────────────▼───────────────────────────────────────────┐
          │                    SUPABASE CLOUD                          │
          │                                                            │
          │  ┌────────────┐  ┌────────────────┐  ┌─────────────────┐  │
          │  │  Auth      │  │  Postgres +    │  │  Storage        │  │
          │  │ (JWT/RLS)  │  │  PostGIS       │  │ (user-uploads)  │  │
          │  └────────────┘  │                │  └─────────────────┘  │
          │                  │  ┌──────────┐  │                        │
          │                  │  │ GTFS     │  │  ┌─────────────────┐  │
          │                  │  │ Accidents│  │  │  Edge Functions  │  │
          │                  │  │ Roads    │  │  │                  │  │
          │                  │  │ Infra    │  │  │ analyze-area    │  │
          │                  │  │ Stats    │  │  │ export-reports  │  │
          │                  │  │ (RPCs)   │  │  │ update-agent    │  │
          │                  │  └──────────┘  │  └────────┬────────┘  │
          │                  └────────────────┘           │           │
          │  ┌─────────────────────────────┐              │           │
          │  │  pg_cron (monthly trigger)  │──────────────┘           │
          │  └─────────────────────────────┘                          │
          └────────────────────────────────────────────────────────────┘
                                                    │
                                    ┌───────────────▼──────────────┐
                                    │       data.gov.il / CKAN      │
                                    │  (accidents, traffic counts,  │
                                    │   railway stations, LRT)      │
                                    └──────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Frontend (SPA)

The entire UI is a client-rendered React application served as static files (Vercel or Nginx in Docker).

| Layer | Files | Responsibility |
|---|---|---|
| **Entry** | `src/main.tsx`, `index.html` | Mount React root; declare `lang="he" dir="rtl"` |
| **App Shell** | `src/app/App.tsx`, `providers.tsx`, `router.tsx` | Compose providers (React Query, Router); declare all routes |
| **Layout** | `src/components/layout/AppShell.tsx` | Desktop sidebar + right panel + mobile top bar / drawer |
| **Feature Pages** | `src/features/*/` | Self-contained page per route (dashboard, map, transit, route-planner, statistics, infrastructure, sources, history, recent-files, export) |
| **Shared Components** | `src/components/` | Map container, upload zone, export buttons, common UI primitives (Button, Card, Toast, …) |
| **Stores** | `src/stores/` | Zustand slices (see §5.2) |
| **Hooks** | `src/hooks/` + per-feature hooks | Data fetching, upload pipeline, area analysis |
| **Lib** | `src/lib/` | Supabase client config, Leaflet tile registry, Mapbox config, GIS helpers (proj4, shpjs), export payload builders |
| **Types** | `src/types/` | Domain TypeScript interfaces (GTFS, accidents, roads, infrastructure, common) |
| **Constants** | `src/constants/` | Route paths, map defaults, color tokens |

#### Map Engine

Two map libraries coexist:

- **Leaflet + react-leaflet** — default rendering engine for all 2D map views (dark / OSM / satellite / topo tile layers); handles polygon drawing (`leaflet-geoman`), analysis result layers, GTFS stop markers, route planner path display.
- **Mapbox GL JS** — activated only when the user switches to **3D mode**; renders `mapbox/standard` style with pitch, building extrusions, and the same GeoJSON data sources passed as Mapbox layers. Falls back gracefully if `VITE_MAPBOX_ACCESS_TOKEN` is absent.

The two engines are **not mounted simultaneously**; `MapTypeSelector` unmounts Leaflet and mounts `Mapbox3DView` on 3D selection, and vice versa.

---

### 3.2 Supabase Backend

Supabase provides the entire backend without a custom API server.

| Service | Usage |
|---|---|
| **Auth** | Email/password sign-in; JWT attached to every client request; `AuthSessionSync` keeps `authStore` in sync |
| **Postgres + PostGIS** | Relational tables + geometry columns (EPSG:4326); GIST spatial indices; SQL views for statistics; stored procedures (RPCs) for spatial queries and route planning |
| **Row Level Security (RLS)** | Every user-facing table has RLS policies; `user_saved_files` and `user-uploads` storage are scoped to `auth.uid()` |
| **Storage** | `user-uploads` bucket; one prefix per user (`{uid}/...`); presigned download URLs for `/recent-files` |
| **Realtime** | Not used in the current version |

**Key Postgres RPCs:**

| RPC | Called by | What it does |
|---|---|---|
| `query_gtfs_in_polygon` | `analyze-area` Edge Function | ST_Intersects stops/routes with uploaded polygon |
| `query_accidents_in_polygon` | `analyze-area` Edge Function | ST_Intersects accident records |
| `query_roads_in_polygon` | `analyze-area` Edge Function | ST_Intersects road segments |
| `query_infra_in_polygon` | `analyze-area` Edge Function | ST_Intersects infrastructure assets |
| `plan_transit_route` | `useRoutePlanner` hook | KNN → stop-route join → ST_LineLocatePoint / ST_LineSubstring for GTFS segment |
| `upsert_gtfs_shapes_bulk` | `seed:shapes:rest` script | Bulk upsert of shape geometries via REST without `DATABASE_URL` |
| `populate_stop_route_from_shapes` | Seed script | Spatial proximity join to derive `gtfs_stop_route` without `stop_times.txt` |

---

### 3.3 Edge Functions

Three Deno edge functions run at the Supabase edge (no always-on container required):

#### `analyze-area`
- **Trigger:** `POST` from `useAreaAnalysis` hook after the user uploads/draws a polygon
- **Logic:** Receives a GeoJSON polygon; calls four PostGIS RPCs in `Promise.allSettled` (parallel, partial-failure tolerant); returns a combined JSON with per-layer `FeatureCollection` arrays
- **Why Edge, not client:** The heavy spatial intersections run next to the database; only the compact result crosses the network (not 50 MB of raw geometry)

#### `export-reports`
- **Trigger:** `POST` from `useExportTrigger` hook; payload includes `{ format, polygon, layers, analysis? }`
- **Formats:** `geojson` (PostGIS `ST_AsGeoJSON`), `csv` (UTF-8 summary table), `html` (RTL-branded report), `pdf` (`pdf-lib` + embedded Noto Sans Hebrew font — no Puppeteer/Chromium, which is blocked on Edge)
- **Response:** Binary blob streamed back to the browser for download

#### `update-agent`
- See §3.4 below

---

### 3.4 Update Agent — Scheduled Data Ingestion

The update agent is a single Edge Function (`supabase/functions/update-agent`) that replaces a traditional ETL pipeline.

```
pg_cron (1st of each month, 03:00 UTC)
    │
    │  POST x-trigger: cron
    ▼
update-agent Edge Function (Deno)
    │
    ├── Check data_sources.last_modified vs. CKAN last_modified
    │       └── if unchanged → status = "skipped", return
    │
    ├── adapters/accidents.ts   → fetch CSV from CKAN → parse → UPSERT accid_taz
    ├── adapters/vehicleCounts.ts → fetch ZIP → parse → UPSERT traffic_counts
    ├── adapters/railway.ts     → fetch CSV + SHP → UPSERT infra_railway_stations
    └── adapters/lrt.ts         → detect schema (rail_asset vs lrt_entrance)
                                   → deterministic SHA-256 station_id for lrt_entrance
                                   → UPSERT infra_metro_stations
    │
    └── Write rows to update_log + update data_sources.last_checked_at
```

**Deduplication strategy:**
- File level: compare `last_modified` from CKAN before downloading
- Row level: each adapter uses `UPSERT … ON CONFLICT` on the domain's natural key (`pk_teuna_fikt`, `count_id`, `station_id`)
- Exception: `traffic_count_volumes` (no natural key for hourly readings) → delete-and-reinsert per `count_id`

**Manual override:** `POST /functions/v1/update-agent?source=accidents&force=true` to run a single adapter and skip the `last_modified` check.

---

### 3.5 Data Sources (data.gov.il)

| Adapter | Dataset | Table |
|---|---|---|
| `accidents` | LMS road accidents (`accid_taz`) | `accidents` |
| `vehicleCounts` | Traffic counts (`vehicle_counts`) | `traffic_counts`, `traffic_count_volumes` |
| `railway` | Israel Railways stations (`rail_stat`) | `infra_railway_stations` |
| `lrt` | Light rail / metro entrances (`lrt_stat`) | `infra_metro_stations` |

All datasets come from the Israeli Government Open Data Portal ([data.gov.il](https://data.gov.il)) via the CKAN API.

---

## 4. Data Flow Diagrams

### 4.1 Area Analysis Flow

```
User uploads/draws polygon
        │
        ▼ (client-side, zero round-trip)
shpjs + proj4
  │ Detect CRS (WGS84 / ITM EPSG:2039 / ICS EPSG:28191)
  │ Auto-reproject to WGS84 if needed
  │ Store FeatureCollection + bbox in uploadStore
        │
        ▼
useAreaAnalysis hook
  │ POST analyze-area Edge Function
  │   GeoJSON polygon in body
        │
        ▼ (Edge Function — runs next to Postgres)
Promise.allSettled([
  query_gtfs_in_polygon,
  query_accidents_in_polygon,
  query_roads_in_polygon,
  query_infra_in_polygon
])
        │
        ▼
analysisStore ← results (partial failures allowed)
        │
        ▼
AnalysisResultsLayer (Leaflet)
  draws color-coded features per layer
```

### 4.2 File Upload & Save Flow

```
Dropzone / draw polygon
        │
        ▼
useShapefileUpload hook
  │ parse in browser (shpjs + proj4)
  │ update uploadStore (status/polygon/bbox/sourceName)
        │
        ├──→ Map display (immediate, no server call)
        │
        └──→ [authenticated] User clicks "שמור קובץ"
                  │
                  ▼
              Supabase Storage
                user-uploads/{uid}/{uuid}.{ext}
                  │
                  ▼
              user_saved_files table
                (storage_path, original_filename, byte_size, content_type)
                  │
                  ▼ (on failure → delete orphaned storage object)
              /recent-files page shows saved files
              signed URL for re-download
```

### 4.3 Route Planner Flow

```
User picks origin A + destination B
(Mapbox Geocoding autocomplete OR click-on-map crosshair mode)
        │
        ▼
useRoutePlanner hook
  │ call plan_transit_route RPC
  │   (origin_lng, origin_lat, dest_lng, dest_lat,
  │    max_walk_meters, max_stops_per_end, max_results)
        │
        ▼ (PostGIS RPC)
1. KNN: find up to 8 stops near A + 8 stops near B  (GIST index)
2. JOIN gtfs_stop_route: find (route_id, direction_id) pairs
   serving both a stop-near-A and a stop-near-B
3. Pick representative shape from gtfs_trips
4. ST_LineLocatePoint(shape, stop_A) < ST_LineLocatePoint(shape, stop_B)?
   → Yes: valid direction; No: discard
5. ST_LineSubstring → GeoJSON LineString segment
6. DISTINCT ON (route_id, direction_id) ORDER BY walk distance
        │
        ▼
routePlannerStore ← results
        │
        ▼
RoutePlannerMap (Leaflet, isolated from main MapContainer)
  + RoutePlannerResultsPanel
  (walk times estimated client-side: 1.4 m/s walk, 22/50 km/h by route_type)
```

### 4.4 Automated Update Agent Flow

```
pg_cron: 1st of month 03:00 UTC
        │
        ▼
pg_net → POST update-agent (x-trigger: cron)
        │
        ▼
For each data source in ['accidents','traffic_counts','railway','lrt']:
  │
  ├── GET CKAN metadata → compare last_modified with data_sources table
  │       skipped? → log "skipped" → next source
  │
  ├── Download CSV / ZIP from data.gov.il (into Deno memory, no filesystem)
  │
  ├── Parse + transform (ITM → WGS84 via proj4 where needed)
  │
  ├── UPSERT into Postgres (batch inserts, ON CONFLICT on natural key)
  │
  └── Update data_sources.last_modified + write row to update_log
```

---

## 5. Frontend Architecture Detail

### 5.1 Module Structure

```
src/
├── app/               # Bootstrap: Providers wrapper + AppRouter
├── features/          # One folder per route / domain
│   ├── dashboard/     # Main map page with KPI cards
│   ├── map/           # Full-bleed map view
│   ├── transit/       # GTFS table browser (TanStack Table + Supabase)
│   ├── route-planner/ # A→B transit planner (own Leaflet map instance)
│   ├── statistics/    # Recharts charts + accident statistics tables
│   ├── infrastructure/# Railway stations map layer
│   ├── accidents/     # Accidents layer view
│   ├── sources/       # Data source catalog
│   ├── history/       # Update log viewer
│   ├── recent-files/  # Saved uploads for logged-in users
│   └── export/        # ExportPanel (lives in right rail)
├── components/        # Shared, presentation-only components
│   ├── ui/            # Primitives: Button, Card, Input, ToggleSwitch
│   ├── layout/        # AppShell, Sidebar, RightPanel, MobileTopBar
│   ├── map/           # MapContainer, tile selector, drawing overlay,
│   │                  #   uploaded polygon layer, analysis results layer,
│   │                  #   GTFS stop markers, geocoding bar
│   └── upload/        # Dropzone, DrawMode, SaveButton, StatusCard
├── stores/            # Zustand slices (§5.2)
├── hooks/             # Cross-feature hooks
├── lib/               # External integrations (Supabase client, Mapbox,
│                      #   Leaflet tiles, GIS helpers, export builders)
├── types/             # Domain interfaces
├── constants/         # Route paths, map config, color tokens
└── styles/            # globals.css, rtl.css (Leaflet dark overrides)
```

**Key design principle:** features own their private hooks and sub-components; `src/components/` holds only genuinely cross-feature, presentation-only code. This keeps feature pages deletable without side effects.

---

### 5.2 State Management Layers

Three state layers, each with a distinct purpose:

```
┌─────────────────────────────────────────────────────────┐
│  URL / React Router params                               │
│  Route-driven state: active page, selected feature ID   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  TanStack React Query (server state)                     │
│  Supabase queries, caching, background refetch, retries  │
│  Used by: transit tables, statistics, data sources,      │
│           recent files, update history                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Zustand stores (ephemeral client state)                 │
│                                                          │
│  authStore      → Supabase session + user object         │
│  mapStore       → map view (center, zoom, basemap type)  │
│  uploadStore    → upload pipeline state + parsed polygon │
│  analysisStore  → layer selection + analysis results     │
│  uiStore        → sidebar/drawer open, toast queue       │
│  filterStore    → table filter values                    │
│  routePlannerStore → A/B points + planner results        │
└─────────────────────────────────────────────────────────┘
```

---

### 5.3 Routing

React Router v6 with a single `AppRouter`. All routes except `/login` are wrapped in `ProtectedRoute` (redirects to `/login` if no Supabase session).

| Path | Page | Notes |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/` | `DashboardPage` | Map + KPI cards |
| `/map` | `MapPage` | Full-bleed map |
| `/transit` | `TransitPage` | GTFS table browser |
| `/route-planner` | `RoutePlannerPage` | A→B planner |
| `/statistics` | `StatisticsPage` | Charts + tables |
| `/infrastructure` | `InfrastructurePage` | Railway stations |
| `/accidents` | `AccidentsPage` | Accidents view |
| `/sources` | `SourcesPage` | Data source catalog |
| `/recent-files` | `RecentFilesPage` | User's saved uploads |
| `/history` | `UpdateHistoryPage` | Cron run log |
| `/export` | — | Redirects to `/` |
| `*` | — | Redirects to `/` |

---

## 6. Database Schema (Key Tables)

```
GTFS (transit)                      Spatial Analysis
──────────────                      ──────────────────
gtfs_agencies                       accidents (geom Point/4326)
gtfs_routes                         traffic_counts
gtfs_trips                          traffic_count_volumes
gtfs_stops (geom Point/4326)        roads (geom LineString/4326)
gtfs_shapes (geom LineString/4326)  infra_railway_stations (geom Point)
gtfs_stop_route                     infra_metro_stations (TEXT pk)
  (stop_id, route_id, direction_id)

User / Auth                         Operations
──────────────                      ──────────────
profiles                            data_sources
user_saved_files                    update_log
[storage: user-uploads bucket]
```

All geometry columns use **EPSG:4326 (WGS84)**. Coordinates arriving in ITM (EPSG:2039) or ICS (EPSG:28191) are reprojected either client-side (`proj4` in the browser) or server-side (PostGIS `ST_Transform`) depending on the ingestion path.

---

## 7. Framework & Technology Decisions

### React 18 + TypeScript (Strict)

**Why React:** Component model fits the multi-panel GIS UI (sidebar, right panel, map, modals). Ecosystem depth (Leaflet bindings, TanStack Table, Recharts all have first-class React support). Team familiarity.

**Why not Next.js / Remix:** This is a Supabase-only backend with no Node.js API server. SSR adds complexity without benefit (the app requires auth for all meaningful data; there is no SEO-critical content). Vite SPA is simpler to deploy as static files on Vercel or behind Nginx.

**TypeScript strictness:** `strict: true` + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters`. ESLint bans `any`. This is intentional: GIS data has many nullable geometry fields and typed safety prevents silent coordinate mismatches.

---

### Vite 5 (Build Tool)

**Why Vite:** Sub-second HMR for rapid iteration on map/UI components. Native ESM in dev; Rollup for production. No Webpack config maintenance. Path alias (`@/` → `src/`) configured once in both `vite.config.ts` and `tsconfig.app.json`.

---

### Supabase (Backend-as-a-Service)

**Why Supabase instead of a custom backend:**

1. **PostGIS is built in** — spatial queries (`ST_Intersects`, `ST_LineSubstring`, `ST_DWithin`) run in the managed Postgres without standing up a separate GeoServer or custom API.
2. **Auth + RLS in one service** — row-level security enforces data isolation at the database layer; no authorization middleware to write and maintain.
3. **Edge Functions for compute** — `analyze-area` and `export-reports` run as Deno functions colocated with the database, eliminating a round-trip for heavy spatial queries.
4. **Storage for user files** — bucket + RLS policy gives per-user file isolation without an S3 configuration.
5. **pg_cron + pg_net for the update agent** — the scheduled ETL pipeline is expressed entirely in SQL + a Deno function; no separate cron server or message queue.

**Trade-off acknowledged:** Supabase free tier has storage/row limits; traffic count history was restricted to 2025-only data to stay within quota.

---

### Zustand (Client State)

**Why Zustand over Redux / Context:**

- **Zero boilerplate:** a store is a plain function; no actions, reducers, or selectors required.
- **Fine-grained subscriptions:** map, upload, analysis, and UI stores can be subscribed to independently; a toast queue update does not re-render the map.
- **Works alongside React Query:** Zustand holds ephemeral UI state (sidebar open, active polygon, picked A/B points); React Query holds server data. There is no single "god store".

---

### TanStack React Query (Server State)

**Why React Query over SWR / plain `useEffect`:**

- Built-in **cache**, **background refetch**, and **retry** logic.
- **`useQuery` / `useMutation` pattern** maps cleanly to Supabase `select()` / `insert()` calls.
- Devtools available in development for cache inspection.
- Used in: transit GTFS tables (paginated), statistics, update history, data sources catalog, recent files list.

---

### Leaflet + react-leaflet (Primary Map)

**Why Leaflet:**

- Lightweight (41 KB gzipped) and framework-agnostic; `react-leaflet` provides declarative component wrappers.
- **Geoman plugin** (`@geoman-io/leaflet-geoman-free`) adds polygon draw / edit with minimal setup.
- Tile layer registry (`src/lib/leaflet/tile-layers.ts`) covers dark, OSM, satellite, topo — all raster, no token required.
- **RTL-friendly** — no inherent directionality bias in the canvas-rendered map.

**Limitation:** No native 3D tilt/pitch support. This is why Mapbox GL is added for the 3D mode.

---

### Mapbox GL JS (3D Mode Only)

**Why Mapbox and not deck.gl / CesiumJS:**

- `mapbox/standard` style gives photorealistic buildings and terrain out of the box with a single style URL.
- Geocoding API (`/geocoding/v5/mapbox.places`) is already part of the Mapbox platform; reused for the route planner's address search.
- RTL text plugin (`mapbox-gl-rtl-text`) ensures Hebrew labels render correctly in 3D.
- Scoped to 3D mode only — token is optional; missing token shows a static fallback rather than a broken map.

---

### Tailwind CSS + tailwindcss-rtl

**Why Tailwind:**

- **Utility-first** accelerates consistent dark-theme styling across 30+ components.
- **RTL plugin** (`tailwindcss-rtl`) enables logical-property utilities (`ms-*`, `me-*`, `start-*`, `end-*`) that flip automatically for the Hebrew RTL layout without media queries or manual `dir` checks.
- Brand tokens (`bg-bg-0`, `text-brand-teal`, …) declared in `tailwind.config.ts` serve as a design system.

---

### shadcn-style Primitives (Radix Slot + CVA)

**Why not a full component library (MUI, Ant Design, Chakra):**

- Heavy component libraries ship a lot of LTR-first assumptions and override friction for RTL.
- `class-variance-authority` + `clsx` + `tailwind-merge` gives typed variant props on `Button`, `Card`, `Input` without pulling in a 300 KB CSS-in-JS runtime.
- Components are owned by the project — dark-theme and RTL adjustments require a single Tailwind class change, not a theme override chain.

---

### proj4 + shpjs (Client-Side GIS Parsing)

**Why parse shapefiles in the browser:**

- No backend endpoint to store/delete temporary files — only Supabase is available, and edge functions have no writable filesystem.
- For typical polygon uploads (< 1 MB), browser parsing is instantaneous with zero network round-trip.
- **CRS auto-detection:** many Israeli shapefiles arrive without a `.prj` file (coordinates in ITM or ICS). `src/lib/gis/projections.ts` detects the coordinate range (degrees vs. hundreds-of-thousands of meters) and reprojects via `proj4` automatically — this would be invisible to the user if done server-side.

**Escape hatch:** `parseShapefileFromFiles` is a pure function; if very large files (80+ MB boundaries) become a requirement, it can be replaced by an Edge Function that returns the same `ParsedShapefile` shape without touching the rendering layers.

---

### Recharts (Charts)

**Why Recharts over Chart.js / Victory:**

- Native React components; no imperative `chart.update()` calls.
- Composable chart primitives (`<BarChart>`, `<LineChart>`, `<PieChart>`, `<Tooltip>`, `<Legend>`) map well to the statistics dashboard's mix of chart types.
- Sufficient for the current analytics scope without the overhead of D3 direct usage.

---

### TanStack Table (Data Tables)

**Why TanStack Table:**

- Headless — full control over Tailwind-styled markup; no RTL layout conflicts from a library-owned table.
- Server-side sorting and pagination hooks integrate cleanly with Supabase `.order()` and `.range()`.
- Used in: GTFS transit browser (agencies, routes, stops, trips, service calendars), statistics tables.

---

### Zod (Validation)

Used at the boundary between Edge Function responses and client-side types. Ensures that unexpected null geometry fields or missing CKAN fields throw a typed error rather than propagating silently as `undefined`.

---

### pdf-lib (PDF Export)

**Why not Puppeteer:**

Supabase Edge Functions run in a Deno sandbox — `PermissionDenied` when attempting to spawn Chromium. `pdf-lib` is a pure-JavaScript PDF writer; combined with an embedded **Noto Sans Hebrew** font fetched at runtime, it produces RTL-compatible PDF reports without any external binary dependency.

---

## 8. Deployment Architecture

```
Developer machine
    │  git push
    ▼
GitHub (main branch)
    │  Vercel CI
    ▼
Vercel (static hosting)
    │  SPA — all routes serve index.html (vercel.json rewrite rule)
    │  Environment variables: VITE_SUPABASE_*, VITE_MAPBOX_*
    ▼
Browser

Alternative (Docker):
    Dockerfile (node:20 build → nginx:alpine serve)
    nginx.conf → try_files index.html (SPA fallback)
    Expose port 80
```

**Supabase project** is hosted on Supabase Cloud. Migrations are applied via `supabase db push` or manually through the SQL editor. Edge Functions are deployed with `supabase functions deploy <name>`.

**Secrets:** `VITE_*` vars are public (build-time); `SUPABASE_SERVICE_ROLE_KEY` and `VITE_MAPBOX_ACCESS_TOKEN` are kept in Vercel/Supabase environment settings and never committed to the repository. The `update-agent` cron requires `project_url` and `service_role_key` seeded into `supabase_vault` once via the SQL editor.
