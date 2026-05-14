# Mahod GIS

Hebrew (RTL) GIS analysis tool for Israeli transportation data — built for Mahod Engineering.

This is **iteration 1** of the project: a fully-scaffolded, type-strict React + TypeScript application with the complete dark-theme UI, routing, state management, and a working Leaflet map. Supabase wiring is intentionally deferred — see [`src/lib/supabase/README.md`](./src/lib/supabase/README.md).

---

## Tech stack

| Concern              | Choice                                |
| -------------------- | ------------------------------------- |
| Build tool           | Vite 5                                |
| Framework            | React 18 + TypeScript (strict)        |
| Styling              | Tailwind CSS + `tailwindcss-rtl`      |
| UI primitives        | shadcn-style (hand-rolled, Radix Slot) |
| Icons                | `lucide-react`                        |
| Routing              | React Router v6                       |
| Client state         | Zustand                               |
| Server state         | TanStack React Query                  |
| Data backend         | Supabase (`@supabase/supabase-js`) — placeholder client only |
| Map                  | Leaflet + `react-leaflet`             |
| Dates                | `date-fns`                            |
| Validation           | Zod                                   |
| Lint / Format        | ESLint (flat config) + Prettier       |

---

## Quick start

```bash
# 1. install
npm install

# 2. copy env template (leave values blank — Supabase not wired yet)
cp .env.example .env.local

# 3. run dev server
npm run dev          # → http://localhost:5173
```

### Useful scripts

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Vite dev server with HMR                                           |
| `npm run build`        | Type-check (`tsc -b`) + production bundle                          |
| `npm run preview`      | Serve the production build locally                                 |
| `npm run typecheck`    | Type-check only (no emit)                                          |
| `npm run lint`         | ESLint over the project (zero warnings policy)                     |
| `npm run lint:fix`     | ESLint with `--fix`                                                |
| `npm run format`       | Prettier write                                                     |
| `npm run format:check` | Prettier check (CI-friendly)                                       |

### GTFS seed order

Run the GTFS seed scripts in dependency order. `gtfs_stop_route` is derived from `stop_times.txt` and depends on `gtfs_trips`, so it must run after trips are loaded.

```bash
npm run seed:agency
npm run seed:routes
npm run seed:stops
npm run seed:calendar
npm run seed:trips      # must run before stop-route
npm run seed:shapes
npm run seed:stop-route # depends on trips
```

`seed:stop-route` reads `stop_times.txt` as a stream (set `STOP_TIMES_PATH`, or place the file at `public/gtfs/stop_times.txt` or `data/gtfs/stop_times.txt`), loads `gtfs_trips` into memory once for O(1) lookups, and writes deduplicated `(stop_id, route_id, direction_id)` links into `gtfs_stop_route`. Env is loaded from `.env.local` then `.env` (same as typical Vite setup).

Example:

```bash
# Windows PowerShell
$env:STOP_TIMES_PATH = "C:\path\to\stop_times.txt"
$env:DATABASE_URL = "postgresql://..."
npm run seed:stop-route
```

Useful post-run checks:

```sql
-- How many links?
SELECT COUNT(*) FROM gtfs_stop_route;

-- How many routes serve each stop?
SELECT s.stop_name, COUNT(*) as route_count
FROM gtfs_stops s
JOIN gtfs_stop_route sr ON s.stop_id = sr.stop_id
GROUP BY s.stop_id, s.stop_name
ORDER BY route_count DESC
LIMIT 10;

-- Which routes serve a specific stop?
SELECT r.route_short_name, r.route_long_name
FROM gtfs_stop_route sr
JOIN gtfs_routes r ON sr.route_id = r.route_id
WHERE sr.stop_id = 38831;
```

---

## Project structure

```
mahod-gis/
├── public/                 # static assets served as-is (favicon, robots, etc.)
├── src/
│   ├── app/                # App-level wiring: <App>, <Providers>, route table
│   ├── components/         # Reusable, presentation-only components
│   │   ├── ui/             # shadcn-style primitives (button, card, input, toggle)
│   │   ├── layout/         # AppShell, Header, Sidebar, RightPanel
│   │   ├── map/            # MapContainer (Leaflet), MapTypeSelector, LayerToggle, etc.
│   │   ├── upload/         # Dropzone + quick-upload buttons
│   │   ├── data/           # StatPill, LayerRow, ResultRow (used by RightPanel)
│   │   └── common/         # Avatar, StatusPill, Toast, LoadingBar
│   ├── features/           # Feature-scoped pages + private components/hooks
│   │   ├── dashboard/      # `/` — main dashboard with map + KPIs
│   │   ├── map/            # `/map` — full-bleed map
│   │   ├── accidents/      # `/accidents`
│   │   ├── transit/        # `/transit`
│   │   ├── infrastructure/ # `/infrastructure`
│   │   ├── sources/        # `/sources` — data sources overview
│   │   ├── history/        # `/history` — update history
│   │   └── export/         # `/export` + reusable ExportPanel card
│   ├── lib/                # External-library config
│   │   ├── supabase/       # ⚠️ placeholder client + types + README
│   │   ├── leaflet/        # tile-layer registry
│   │   └── utils.ts        # cn() + small formatters
│   ├── hooks/              # Cross-feature hooks (useLocalStorage, useDebounce, useMediaQuery)
│   ├── stores/             # Zustand stores (mapStore, uiStore, filterStore)
│   ├── types/              # Domain types (gtfs, accidents, roads, infrastructure, common)
│   ├── styles/             # globals.css + rtl.css (Leaflet dark overrides)
│   ├── constants/          # colors, mapConfig, routes
│   ├── main.tsx            # Entry point
│   └── vite-env.d.ts       # Vite env shims
├── types/shims.d.ts        # Ambient declarations (e.g. tailwindcss-rtl)
├── index.html              # Sets <html lang="he" dir="rtl">
├── tailwind.config.ts      # Brand colors + RTL plugin
├── tsconfig*.json          # `strict: true` + `noUncheckedIndexedAccess`, etc.
├── eslint.config.js        # Flat config, `any` is an error
├── .prettierrc / .prettierignore
└── .env.example
```

### Path aliases

`@/` resolves to `src/` in both `tsconfig.app.json` and `vite.config.ts`. Example:

```ts
import { useMapStore } from '@/stores/mapStore';
```

### State conventions

- **Zustand** for ephemeral client state (active layers, sidebar collapsed, toasts).
- **React Query** for server state — caching + retries will kick in once Supabase is wired.
- **URL** (React Router params) for route-driven state (selected feature ID, etc.).

### Styling conventions

- Tailwind utility classes only — no inline styles, no ad-hoc CSS modules.
- Brand tokens (`bg-bg-0`, `text-text-dim`, `bg-brand-teal`, …) are declared in `tailwind.config.ts`.
- Logical properties (`ms-*`, `me-*`, `start-*`, `end-*`) keep the layout RTL-correct.
- Animations are declared as named keyframes in `tailwind.config.ts` (`animate-fadein`, `animate-marker-pulse`, …).

### TypeScript strictness

`tsconfig.app.json` enables:

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"exactOptionalPropertyTypes": true,
"noUnusedLocals": true,
"noUnusedParameters": true
```

ESLint additionally bans `any` (`@typescript-eslint/no-explicit-any: error`).

---

## Routes

| Path               | Component             | Status                                   |
| ------------------ | --------------------- | ---------------------------------------- |
| `/`                | `DashboardPage`       | Live (map + KPIs, mock data)             |
| `/map`             | `MapPage`             | Live (full-bleed map)                    |
| `/accidents`       | `AccidentsPage`       | Placeholder (coming soon)                |
| `/transit`         | `TransitPage`         | Placeholder (coming soon)                |
| `/infrastructure`  | `InfrastructurePage`  | Placeholder (coming soon)                |
| `/sources`         | `SourcesPage`         | Live (static info on planned sources)    |
| `/history`         | `UpdateHistoryPage`   | Placeholder                              |
| `/export`          | `ExportPage`          | Live (UI only — pipeline not wired)      |

Unmatched routes redirect to `/`.

---

## Supabase status

⚠️ **Not wired yet.** `src/lib/supabase/client.ts` creates a client from empty env vars, and `Database` in `types.ts` is intentionally empty. See [`src/lib/supabase/README.md`](./src/lib/supabase/README.md) for the planned schema flow.

The `.env.example` already lists the env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — copy to `.env.local` once a project exists.

---

## Next steps (post-scaffold)

1. **Explore the data**
   - Download `israel-public-transportation.zip` (GTFS) and the LMS dump from data.gov.il.
   - Inventory tables / columns we actually want to keep.
2. **Design the Supabase schema**
   - Tables: `agencies`, `routes`, `trips`, `stops`, `stop_times`, `accidents`, `roads`, `infrastructure_assets`, plus operational tables (`ingest_runs`, `upload_artifacts`).
   - Enable PostGIS extension for geometry columns + spatial indices.
3. **Generate types**
   - `npx supabase gen types typescript --project-id <id> > src/lib/supabase/generated.ts`
   - Replace the placeholder `Database` in `types.ts` with the generated one.
4. **Wire the data hooks**
   - Replace mock arrays in `MapContainer.tsx` with React Query hooks per layer.
   - Add domain-scoped hooks in `features/<domain>/hooks/`.
5. **Implement the upload pipeline**
   - File handler in `components/upload/Dropzone.tsx`.
   - Stream to Supabase Storage; trigger an Edge Function that parses GTFS / CSV into the relational tables.
6. **Implement export**
   - `useExportTrigger` currently logs. Wire to a server function returning a download URL.

---

## License

Internal — Mahod Engineering Ltd. © 2025.
