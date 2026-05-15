# Mahod GIS

Hebrew (RTL) GIS analysis tool for Israeli transportation data — built for Mahod Engineering.

האפליקציה היא **React + TypeScript** (Vite) עם ממשק כהה מלא, ניתוב, מצב לקוח, מפת Leaflet, חיבור ל־**Supabase** (אימות, מסד נתונים, Edge Functions, Storage), וזרימות ניתוח וייצוא לפי אזור.

---

## מטרה

כלי GIS לניתוח ולהצגת נתוני תחבורה בישראל, בשפה העברית ובכיוון RTL, עבור מהנדס מהוד. המערכת מאפשרת לעבוד עם מפה, שכבות מידע, ניתוח מרחבי (פוליגון), תכנון מסלולים חלקי (GTFS), ייצוא דוחות (GeoJSON, CSV, HTML, PDF), ומעקב אחר מקורות נתונים ועדכונים — הכל בממשק אחיד ונגיש גם בנייד.

**יישום הדרישות:** כל סעיפי הפרויקט והמטלות יושמו במלואם. בנוסף נוסף **סעיף מקורי**: משתמש יכול **להירשם ולהתחבר**; לאחר התחברות, **קבצים שהמשתמש מעלה או שומר** נרשמים בצד השרת (Supabase) וניתנים **לשימוש חוזר** מאוחר יותר דרך מסך **«קבצים אחרונים»** — כך עובדה עם אותו חשבון נשמרת בין כניסות ולא נאבדת עם רענון הדפדפן בלבד.

**חלק בונוס:** לא הספקתי להמשיך ולפתח את חלק הבונוס. במהלך עבודת הבית נוצר שימוש גבוה מאוד בחשבון **Cursor** (עורך עם סוכני AI), עד שחרגתי ממכסות/תקציב השימוש — ולכן החלטתי לעצור שם ולא להרחיב את הבונוס, כדי לא להמשיך לצבור עלויות נוספות.

**משיכת נתונים, סקריפטים וסוכן עדכון:** החלק שהיה לי **הכי קשה בהתחלה** הוא **משיכת הנתונים וייבואם לטבלאות**. בתחילה נכנסתי **באופן ידני** למקורות המידע, **הורדתי קבצי ZIP**, ובניתי **סקריפטים** שקוראים את הקבצים וממלאים את הטבלאות במסד. את **בניית סוכן העדכון** השארתי **לסוף**. רק בסוף התברר לי שאפשר **למשוך נתונים באופן אוטומטי דרך API** — בלי הזרימה הידנית שבניתי בהתחלה — מה שמתאים יותר לעדכונים שוטפים ולתחזוקה.

**Testing — Unit Tests:** סעיף ה-Unit tests **מומש** לאחר השלמת שאר הפרויקט. נכתבו **142 בדיקות** ב-**14 קבצי test** — כולן עוברות (`npm test`). ה-coverage מגיע ל-**82%+ statements ו-lines, 60%+ branches ו-95%+ functions** על הקבצים הנבדקים (ראו פירוט בסעיף Testing בהמשך). **Integration tests** ו-**E2E** (Playwright / Cypress) לא יושמו — ראו הסבר בסעיף Testing.

---

## התקנה

1. שכפול המאגר והכנסה לתיקיית הפרויקט (`mahod-gis`).
2. התקנת תלויות:

   ```bash
   npm install
   ```

3. הגדרת משתני סביבה: העתקת תבנית הסביבה והזנת ערכים אמיתיים לפיתוח מקומי (בפרט חיבור Supabase — URL ו־anon key, וכל משתנה נוסף שבשימוש בפרויקט):

   ```bash
   cp .env.example .env.local
   ```

4. (אופציונלי) פריסת פונקציות Supabase, מיגרציות וסיד לפי הצורך — ראו תיעוד תחת `supabase/` וסקריפטי `npm run seed:*` להזנת GTFS בסדר התלות.

---

## הרצה

**פיתוח מקומי** — שרת Vite עם HMR:

```bash
npm run dev
```

ברירת המחדל: `http://localhost:5173`.

**בנייה לייצור ובדיקה מקומית של האריזה:**

```bash
npm run build
npm run preview
```

פקודות נוספות: `npm run typecheck`, `npm run lint`, `npm run format` — ראו טבלת הסקריפטים בהמשך המסמך.

---

## אתר חי (Vercel)

האתר הפרוס זמין בכתובת:

**https://mahod-gis-tool-git-main-itay-ben-yair-s-projects.vercel.app/**

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
| Data backend         | Supabase (`@supabase/supabase-js`) — Auth, Postgres, Edge Functions, Storage |
| Map                  | Leaflet + `react-leaflet`             |
| Dates                | `date-fns`                            |
| Validation           | Zod                                   |
| Lint / Format        | ESLint (flat config) + Prettier       |

---

## תצוגה רספונסיבית ונייד

הממשק **מותאם גם לנייד ולטאבלט**: מתחת ל־`lg` (1024px) הסרגל הקבוע והפאנל הימני לא תופסים את רוחב המסך — נפתחים מ־**שורת עליון** (תפריט + לוגו + כפתור «כלים»), **מגירת ניווט** לסרגל הצד, ו־**גיליון תחתון (bottom sheet)** לפאנל הימני (העלאה, ניתוח, ייצוא וכו׳). בדסקטופ נשמר הגריד הקיים (סרגל מלא / אייקונים לפי `xl`).

**במה השתמשנו (בקצרה):**

- **Tailwind CSS** — נקודות שבירה (`sm`, `md`, `lg`, `xl`), `flex` / `grid`, `min-w-0`, גלילה אופקית היכן שצריך (למשל שורת שכבות במפה).
- **Zustand** (`uiStore`) — מצב פתיחה/סגירה של מגירת התפריט וגיליון הכלים בנייד.
- **React Router** — סגירת overlays בעת מעבר בין דפים.
- **`index.html`** — `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` לתצוגה נכונה בדפדפני מובייל.
- **CSS נוסף** בדף ההתחברות (`login-page.css`) — התאמות לרוחב צר מאוד.

דפים כמו דשבורד/מפה, תחבורה ציבורית, תשתיות, סטטיסטיקות ומקורות עברו התאמות נקודתיות (כותרות, טבלאות עם גלילה, כרטיסי KPI, מקרא מפה מתקפל בנייד וכו׳).

---

## Quick start

```bash
# 1. install
npm install

# 2. copy env template and fill VITE_SUPABASE_* (and any other vars you use)
cp .env.example .env.local

# 3. run dev server
npm run dev          # → http://localhost:5173
```

לסיכום בעברית של מטרה, התקנה והרצה — ראו את הסעיפים **מטרה**, **התקנה** ו־**הרצה** בראש המסמך, ואת **אתר חי (Vercel)** לכתובת הפריסה.

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
├── supabase/
│   └── functions/
│       ├── analyze-area/   # Polygon → spatial RPCs (GTFS / accidents / roads / …)
│       └── export-reports/ # GeoJSON + CSV + HTML (+ PDF ב-API) (Task 8)
├── public/                 # static assets served as-is (favicon, robots, etc.)
├── src/
│   ├── app/                # App-level wiring: <App>, <Providers>, route table
│   ├── components/         # Reusable, presentation-only components
│   │   ├── ui/             # shadcn-style primitives (button, card, input, toggle)
│   │   ├── layout/         # AppShell, MobileTopBar, Sidebar, RightPanel
│   │   ├── ExportButtons/  # GeoJSON / EXCEL (CSV) / HTML download buttons
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
│   │   ├── recent-files/   # `/recent-files` — saved files for authenticated users
│   │   ├── history/        # `/history` — update history
│   │   └── export/         # ExportPanel (right rail under “שכבות מידע”)
│   ├── lib/                # External-library config
│   │   ├── export/         # `buildExportPayload`, `fetchExportBlob` → `export-reports`
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
| `/route-planner`   | `RoutePlannerPage`    | תכנון מסלול A→B (GTFS חלקי — ראו הערה למטה) |
| `/infrastructure`  | `InfrastructurePage`  | Placeholder (coming soon)                |
| `/sources`         | `SourcesPage`         | Live (static info on planned sources)    |
| `/recent-files`    | `RecentFilesPage`     | קבצים שמורים למשתמש מחובר               |
| `/history`         | `UpdateHistoryPage`   | Placeholder                              |
| `/export`          | —                     | Redirects to `/` (ייצוא רק מפאנל ימני מתחת לשכבות מידע) |

**תכנון מסלול (A→B):** בדיקת תוצאות מסלול מומלצת עם **נקודות באזור יבנה** — לא נטען למסד ה־GTFS המלא בגלל **מגבלות זיכרון** בזמן ההכנסה, ולכן לא כל הארץ מיוצגת באותה רמת כיסוי; באזור יבנה אפשר לאמת שהחיפוש וה־RPC מחזירים מסלולים סבירים.

Unmatched routes redirect to `/`.

---

## Saved user files

משתמש מחובר שמעלה פוליגון בדף הבית רואה בכרטיס סטטוס ההעלאה שדה “שם לשמירה” וכפתור **שמור קובץ**. השמירה מעלה את הקובץ ל־Supabase Storage bucket פרטי `user-uploads` תחת הנתיב `{user_id}/...`, ואז מוסיפה שורה ל־`user_saved_files` עם `storage_path`, `content_type`, `byte_size` והשם שהמשתמש בחר (`original_filename`).

אם המשתמש העלה קובץ יחיד (`.zip`, `.geojson`, וכו׳) נשמר הקובץ המקורי. אם הוא העלה shapefile מפוצל (`.shp` + `.dbf` + קבצי צד), נשמר GeoJSON שנוצר מהפוליגון המפוענח כדי שבעתיד אפשר יהיה לטעון אותו חזרה מהמסך “קבצים אחרונים” בלי לשחזר bundle מרובה קבצים.

`/recent-files` קורא את `user_saved_files` לפי RLS של המשתמש המחובר ומייצר signed URL להורדה מה-bucket הפרטי. אותה תשתית מיועדת לשמש בהמשך גם לטעינה חוזרת של קובץ שמור לתוך `useUploadStore`.

---

## Supabase status

`src/lib/supabase/client.ts` creates a browser client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Database typing lives in `src/lib/supabase/types.ts` and mirrors the migrations under `supabase/migrations`.

The `.env.example` lists the env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — copy to `.env.local` for local development.

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
6. **Export**
   - Edge Function `export-reports`: `POST /functions/v1/export-reports` עם `format` + פוליגון + שכבות; CSV/HTML/PDF משתמשים ב־payload סיכום מהניתוח (`buildExportAnalysisPayload`).

---

## Output formats

| Format  | Use case                           | Transport |
| ------- | ---------------------------------- | --------- |
| GeoJSON | Import to QGIS / ArcGIS / Mapbox  | `POST /functions/v1/export-reports` עם `"format":"geojson"` |
| CSV     | טבלת נתונים (UTF-8) לפתיחה באקסל / גיליון | `POST …` עם `"format":"csv"` + `analysis` |
| HTML    | דוח ממותג RTL בדפדפן / הורדה           | `POST …` עם `"format":"html"` + `analysis` |
| PDF     | סיכום להדפסה (API בלבד ב-UI הנוכחי)   | `POST …` עם `"format":"pdf"` + `analysis` (PDF דרך `pdf-lib` + Noto Hebrew ב-Edge; לא Puppeteer) |

GeoJSON נבנה מאותם RPC של PostGIS כמו `analyze-area` (`query_*_in_polygon`), עם `properties.layer` לכל פיצ'ר. CSV, HTML ו-PDF משתמשים באותו מבנה נתוני סיכום מהקליינט; PDF אינו מריץ Chromium בשרת (לא נתמך ב-Edge).

פריסה: `supabase functions deploy export-reports` (וראו `supabase/functions/export-reports/README.md`).

---

## Testing

### הרצה

```bash
npm test                # מריץ את כל הבדיקות
npm run test:coverage   # מריץ + מדפיס דוח כיסוי (coverage)
```

### כיסוי הבדיקות (Coverage)

נכתבו **142 בדיקות** ב-**14 קבצי test** — כולן עוברות.

| מדד | תוצאה |
| --- | --- |
| Statements | **82.32%** |
| Branches | **60.13%** |
| Functions | **95.04%** |
| Lines | **82.27%** |

### מה נבדק ומה לא

**נבדק (Unit tests):**

| קובץ / מודול | כיסוי | מה נבדק |
| --- | --- | --- |
| `src/lib/utils.ts` | ~100% | `cn()` (מיזוג Tailwind), `formatNumber()` |
| `src/lib/export/supabaseFunctionsUrl.ts` | 100% | `normalizeSupabaseUrl()`, `getExportReportsFunctionUrl()` |
| `src/lib/export/buildExportPayload.ts` | ~80% | חישוב שטח פוליגון, אגרגציה של תאונות/כבישים/תחב"צ |
| `src/stores/authStore.ts` | ~85% | `setAuthenticated`, `setGuest`, `logout`, localStorage |
| `src/stores/uiStore.ts` | ~100% | sidebar, toast, mobile overlays, top loader |
| `src/stores/uploadStore.ts` | ~100% | parsing, polygon, error, municipalities, clear |
| `src/stores/analysisStore.ts` | ~100% | selection, toggleLayer, beginRun, setResults, clearResults |
| `src/stores/filterStore.ts` | ~100% | searchQuery, dateRange, severities, toggleSeverity, reset |
| `src/stores/routePlannerStore.ts` | ~88% | endpoints, swap, pickingMode, routing flow, optionId |
| `src/stores/mapStore.ts` | ~74% | toggleLayer, setLayer, activeDomain, requestMapFocus |
| `src/constants/` | ~100% | colors, routes, mapConfig values |
| `src/statistics/calculations.ts` | ~81% | formatNumber, formatPercent, safePercent, chart data |

**לא נבדק (מוחרג מה-coverage בכוונה):**

| מודול | סיבה |
| --- | --- |
| `src/hooks/use*.ts` | Hooks מלאי DOM (`localStorage`, `matchMedia`, `setTimeout`) — דורשים `@testing-library/react` |
| `src/lib/gis/`, `src/lib/gtfs/` | ניתוח shapefile / GTFS — תלות בקבצי בינארי ו-Node.js streams |
| `src/lib/mapbox/` | תלות ב-Mapbox GL JS — API browser-native |
| `src/lib/export/fetchExportBlob.ts` | קריאת `fetch` לשרת — דורש mock של network |
| `src/statistics/queries.ts` | שאילתות Supabase DB — Integration tests |
| `src/features/`, `src/components/`, `src/app/` | קומפוננטות React — E2E / component tests |

### Integration tests ו-E2E

**לא יושמו** — Integration tests (mock ל-Supabase) ו-E2E (Playwright / Cypress) לא נכתבו. הסיבה: חריגה ממכסת חשבון Cursor במהלך עבודת הבית גרמה לי לעצור לפני שלב זה.

---

## License

Internal — Mahod Engineering Ltd. © 2025.
