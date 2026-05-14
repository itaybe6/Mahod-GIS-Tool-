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
