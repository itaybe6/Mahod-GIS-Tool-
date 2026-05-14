# Data Sources

## GTFS Public Transportation

- Source: https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip
- Local shapes file: `public/gtfs/shapes.txt`
- Update cadence: monthly agent check, with hash comparison before seeding.
- Current version: derived from `GTFS_VERSION` when provided, otherwise the SHA-256 hash prefix of `shapes.txt`.
- Loaded table: `gtfs_shapes`, compressed to one LineString per `shape_id`.

## Road authority segments (roadauthority.csv)

- Source: [data.gov.il — roadauthority dataset](https://data.gov.il/dataset/roadauthority)
- File: `roadauthority.csv` (spatial segments by traffic authority).

### השוואה בין קובץ ישן לקובץ חדש (הורדות מ-data.gov.il)

- **מבנה הנתונים (Schema):** אין שינוי במבנה העמודות. לא נוספו ולא ירדו שדות. שמות העמודות נותרו זהים לחלוטין: `OID`, `TRAFCODE`, `TRAFAUTH`, `ROADNAME`, `ROADNUMBER`, `YEARMONTH`, `Shape_Length`.
- **שינוי סוגי נתונים (Data Types):** הנתונים בעמודות `ROADNUMBER` ו-`YEARMONTH` עברו מפורמט עשרוני (Float - למשל `1.0` או `202007.0`) לפורמט מספר שלם (Integer - למשל `1` או `202007`).
- **רמת דיוק (Precision):** עמודת אורך המקטע (`Shape_Length`) מציגה בקובץ החדש רמת דיוק גבוהה יותר עם יותר ספרות אחרי הנקודה העשרונית.
- **נפח הנתונים:** נוספו שורות מידע חדשות לקובץ.

## Vehicle traffic counts (ספירות תנועה)

- Source: [Ministry of Transport — vehicle counts (data.gov.il)](https://data.gov.il/he/datasets/ministry_of_transport/vehicle_counts)
- Selection rationale: Additional traffic-count datasets were considered; only this resource matched the structure, fields, and semantics the current Mahod tool expects for the output it produces today.

## Road accidents — CBS TAZ aggregate (`accid_taz` / accid_taz.csv)

- **What we load:** A government table exported as CSV with one row per **TAZ** (traffic analysis zone): population, land use, injury and vehicle-involvement counts, `YEARMONTH`, `CITYCODE` (CBS municipality code where present), and shape metrics (`Shape_Length`, `Shape_Area`). In Postgres these map to `public.accidents` (snake_case columns; `PRIVATE` from the file → `private_vehicle`, `VEHICLE` → `vehicles`).
- **Why this file and not “accidents by municipality” from GOV:** The `accid_taz` export is the **most up-to-date** accident aggregate we could obtain in a stable CSV from the government open-data path. The dedicated “road accidents by municipal authority” dataset on data.gov.il **returns a download error** in practice, so we cannot rely on it for ingestion. TAZ-level rows still carry `CITYCODE` where the CBS links the zone to a formal municipality, which lets `query_accidents_in_polygon` join to `municipalities.semel_yishuv` and aggregate inside a user polygon.
- **Spatial behaviour:** Rows are **not** individual LMS accident points. The RPC builds **one map feature per matched municipality** (centroid of the municipal polygon) with summed TAZ statistics for that city code; `counts.count` is the sum of `sumacciden` (reported accidents in the aggregate), and `breakdown` uses summed `dead` / `sever_inj` / `sligh_inj` for fatality / severe / light injury totals.
- **Re-seed:** From `mahod-gis` root (optional `ACCID_TAZ_CSV` for path; otherwise `%USERPROFILE%\Downloads\accid_taz.csv` if present):  
  `npm run seed:accidents-taz`  
  (uses `SUPABASE_URL` or `VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` from `.env`.)
