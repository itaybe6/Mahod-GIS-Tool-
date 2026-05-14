# Data Sources

## GTFS Public Transportation

- Source: https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip
- Local shapes file: `public/gtfs/shapes.txt`
- Update cadence: monthly agent check, with hash comparison before seeding.
- Current version: derived from `GTFS_VERSION` when provided, otherwise the SHA-256 hash prefix of `shapes.txt`.
- Loaded table: `gtfs_shapes`, compressed to one LineString per `shape_id`.

## Road authority — רשת כבישים (ROADAUTHORITY)

- מקור: [data.gov.il — roadauthority](https://data.gov.il/dataset/roadauthority)
- גרסת נתונים לדוגמה בפרויקט: עד **אפריל 2026** (קבצים תחת `input/`, לפי `YEARMONTH` בקובץ הטבולרי).

### מעבר משכבה ישנה (AREA_AUTHORITY) לשכבה מעודכנת (ROADAUTHORITY)

| היבט | ישן (AREA_AUTHORITY) | מעודכן (ROADAUTHORITY) |
|------|----------------------|-------------------------|
| גיאומטריה | Polygon (שטחי רשות) | **LineString** — מקטעי רשת כבישים |
| שם כביש / מקטע | לרוב `NAME` | **`ROADNAME`** |
| מספר כביש | לא תמיד ממופה כמספר שלם | **`ROADNUMBER`** (מספר שלם) |
| שטח | `Shape_Area` | **הוסר** — רלוונטי רק לפוליגונים |
| מפתח לחיבור לנתונים טבולריים | `TRAFCODE` | **`TRAFCODE`** (ללא שינוי) |

### קובץ טבולרי (`roadauthority.csv` / `roadauthority - update.csv`)

- שורה לכל מקטע; עמודות: `OID`, `TRAFCODE`, `TRAFAUTH`, `ROADNAME`, `ROADNUMBER`, `YEARMONTH`, `Shape_Length`.
- בגרסה המעודכנת: `ROADNUMBER` ו-`YEARMONTH` כמספרים שלמים (לא Float עם `.0`).
- אורך המקטע (`Shape_Length`) עם דיוק עשרוני גבוה יותר בגרסה החדשה.

### שכבה מרחבית (Shapefile ROADAUTHORITY)

- נתיב מקומי מומלץ: `input/roadauthority_shp/ROADAUTHORITY.shp` (יש להשלים קבצי `.shp`/`.dbf`/`.shx` לצד `.prj`).
- מערכת קואורדינטות: **EPSG:2039** (ישראל TM Grid / ITM) — תואם ל-`.prj` בפרויקט.
- טעינה ל-Supabase: טבלה `public.road_authority_network` (עמודות snake_case: `trafcode`, `trafauth`, `roadname`, `roadnumber`, `yearmonth`, `shape_leng`, `geom`).
- סקריפט העלאה (TypeScript): `npm run upload:road-authority` — `scripts/upload-road-authority-network.ts` (דורש `DATABASE_URL` או שם מקביל, או `SUPABASE_DB_PASS` + `VITE_SUPABASE_URL` לגזירת מארח; `pg` + `shpjs` כבר בפרויקט).

### טבלאות Postgres רלוונטיות

- **`road_authority_network`** — גיאומטריית המקור לשאילתות מפה (LineString, SRID 2039). ה-RPC `query_roads_in_polygon` ממיר ל-4326 בזמן ריצה.
- **`roads`** — טבלת legacy בפרויקט (LineString, 4326 + `authority_id`); ניתן להשאיר ריקה או למחוק לאחר מעבר מלא לרשת החדשה.

## Vehicle traffic counts (ספירות תנועה)

- Source: [Ministry of Transport — vehicle counts (data.gov.il)](https://data.gov.il/he/datasets/ministry_of_transport/vehicle_counts)
- Selection rationale: Additional traffic-count datasets were considered; only this resource matched the structure, fields, and semantics the current Mahod tool expects for the output it produces today.

## תשתיות רכבת ישראל (rail_stat)

- מקור: [data.gov.il — ministry_of_transport / rail_stat](https://data.gov.il/he/datasets/ministry_of_transport/rail_stat)
- הערה: מערך הנתונים הרשמי של משרד התחבורה בפורטל data.gov.il; לפרטי שדות, עדכונים וקבצי הורדה יש לעיין בעמוד המקור.

## Road accidents — CBS TAZ aggregate (`accid_taz` / accid_taz.csv)

- **What we load:** A government table exported as CSV with one row per **TAZ** (traffic analysis zone): population, land use, injury and vehicle-involvement counts, `YEARMONTH`, `CITYCODE` (CBS municipality code where present), and shape metrics (`Shape_Length`, `Shape_Area`). In Postgres these map to `public.accidents` (snake_case columns; `PRIVATE` from the file → `private_vehicle`, `VEHICLE` → `vehicles`).
- **Why this file and not “accidents by municipality” from GOV:** The `accid_taz` export is the **most up-to-date** accident aggregate we could obtain in a stable CSV from the government open-data path. The dedicated “road accidents by municipal authority” dataset on data.gov.il **returns a download error** in practice, so we cannot rely on it for ingestion. TAZ-level rows still carry `CITYCODE` where the CBS links the zone to a formal municipality, which lets `query_accidents_in_polygon` join to `municipalities.semel_yishuv` and aggregate inside a user polygon.
- **Spatial behaviour:** Rows are **not** individual LMS accident points. The RPC builds **one map feature per matched municipality** (centroid of the municipal polygon) with summed TAZ statistics for that city code; `counts.count` is the sum of `sumacciden` (reported accidents in the aggregate), and `breakdown` uses summed `dead` / `sever_inj` / `sligh_inj` for fatality / severe / light injury totals.
- **Re-seed:** From `mahod-gis` root (optional `ACCID_TAZ_CSV` for path; otherwise `%USERPROFILE%\Downloads\accid_taz.csv` if present):  
  `npm run seed:accidents-taz`  
  (uses `SUPABASE_URL` or `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` from `.env`.)
