-- ============================================================
-- Mahod GIS Tool — Supabase / PostgreSQL + PostGIS Schema
-- Generated from real data analysis:
--   - israel-public-transportation.zip (GTFS, 1.1GB)
--   - accidents_data.csv (8,832 rows, 2023)
--   - roadauthority.csv (4,007 rows)
-- ============================================================

-- Enable PostGIS (Supabase already has it, but just in case)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ============================================================
-- SECTION 1: SYSTEM TABLES (סוכן עדכון + מעקב גרסאות)
-- ============================================================

-- רישום מקורות מידע — לסוכן העדכון
CREATE TABLE data_sources (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,           -- 'gtfs', 'accidents', 'roadauthority'
  display_name    TEXT NOT NULL,                  -- שם תצוגה בעברית
  source_url      TEXT NOT NULL,                  -- URL להורדה
  last_checked_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ,
  file_hash       TEXT,                           -- SHA256 של הקובץ האחרון
  file_size_bytes BIGINT,
  last_modified   TIMESTAMPTZ,                    -- מה-Last-Modified header
  record_count    INTEGER,
  status          TEXT DEFAULT 'active'           -- 'active' | 'error' | 'disabled'
    CHECK (status IN ('active', 'error', 'disabled')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- היסטוריית עדכונים — לכל ריצה של הסוכן
CREATE TABLE update_log (
  id              SERIAL PRIMARY KEY,
  source_id       INTEGER REFERENCES data_sources(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'skipped', 'rolled_back')),
  trigger         TEXT DEFAULT 'scheduled'        -- 'scheduled' | 'manual' | 'force'
    CHECK (trigger IN ('scheduled', 'manual', 'force')),
  rows_inserted   INTEGER DEFAULT 0,
  rows_updated    INTEGER DEFAULT 0,
  rows_deleted    INTEGER DEFAULT 0,
  error_message   TEXT,
  notes           TEXT,                           -- diff summary או הערות
  metadata        JSONB DEFAULT '{}'
);

-- ============================================================
-- SECTION 2: GTFS — תחבורה ציבורית
-- (34,972 stops | 7,842 routes | 435,367 trips | 7.1M shape points)
-- ============================================================

-- חברות תחבורה (agency.txt — 37 חברות)
CREATE TABLE gtfs_agency (
  agency_id     INTEGER PRIMARY KEY,
  agency_name   TEXT NOT NULL,
  agency_url    TEXT,
  agency_phone  TEXT,
  agency_lang   TEXT DEFAULT 'he',
  agency_timezone TEXT DEFAULT 'Asia/Jerusalem',
  agency_fare_url TEXT,
  source_version TEXT,                            -- גרסת ה-GTFS
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- קווים (routes.txt — 7,842 קווים)
CREATE TABLE gtfs_routes (
  route_id          INTEGER PRIMARY KEY,
  agency_id         INTEGER REFERENCES gtfs_agency(agency_id),
  route_short_name  TEXT,                         -- מספר הקו (1, 16, 480...)
  route_long_name   TEXT,                         -- שם הקו הארוך
  route_desc        TEXT,                         -- קוד פנימי (67001-1-#)
  route_type        SMALLINT,                     -- 3=אוטובוס, 2=רכבת, 0=טרם/רק"ל
  route_color       TEXT,
  source_version    TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- תחנות (stops.txt — 34,972 תחנות, כולל lat/lon)
CREATE TABLE gtfs_stops (
  stop_id         INTEGER PRIMARY KEY,
  stop_code       INTEGER,                        -- קוד חיצוני (38831...)
  stop_name       TEXT NOT NULL,
  stop_desc       TEXT,                           -- כתובת מלאה
  location_type   SMALLINT DEFAULT 0,             -- 0=תחנה, 1=תחנת אב
  parent_station  INTEGER REFERENCES gtfs_stops(stop_id),
  zone_id         INTEGER,
  geom            GEOMETRY(Point, 4326),          -- stop_lat / stop_lon → Point
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gtfs_stops_geom ON gtfs_stops USING GIST (geom);
CREATE INDEX idx_gtfs_stops_code ON gtfs_stops (stop_code);

-- לוחות שירות (calendar.txt — 1.8MB)
CREATE TABLE gtfs_calendar (
  service_id  INTEGER PRIMARY KEY,
  sunday      BOOLEAN NOT NULL,
  monday      BOOLEAN NOT NULL,
  tuesday     BOOLEAN NOT NULL,
  wednesday   BOOLEAN NOT NULL,
  thursday    BOOLEAN NOT NULL,
  friday      BOOLEAN NOT NULL,
  saturday    BOOLEAN NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  source_version TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- נסיעות (trips.txt — 435,367 נסיעות)
CREATE TABLE gtfs_trips (
  trip_id               TEXT PRIMARY KEY,         -- '49187513_140526'
  route_id              INTEGER REFERENCES gtfs_routes(route_id),
  service_id            INTEGER REFERENCES gtfs_calendar(service_id),
  trip_headsign         TEXT,                     -- 'טבריה_תחנה מרכזית'
  direction_id          SMALLINT,                 -- 0 | 1
  shape_id              INTEGER,
  wheelchair_accessible SMALLINT DEFAULT 0,
  source_version        TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gtfs_trips_route ON gtfs_trips (route_id);
CREATE INDEX idx_gtfs_trips_service ON gtfs_trips (service_id);

-- תוואי קווים (shapes.txt — 7.1M נקודות → נדחס ל-LineString אחד לכל shape)
-- במקום 7M שורות, שומרים geometry מלאה לכל shape_id
CREATE TABLE gtfs_shapes (
  shape_id    INTEGER PRIMARY KEY,
  geom        GEOMETRY(LineString, 4326) NOT NULL, -- כל הנקודות ל-LineString
  point_count INTEGER,                             -- כמה נקודות היו במקור
  source_version TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gtfs_shapes_geom ON gtfs_shapes USING GIST (geom);

-- זמני עצירות (stop_times.txt — מאות מיליוני שורות, הכי כבד)
-- ** החלטה תכנונית: טוענים רק אם יש צורך בחיפוש לוחות זמנים **
-- partitioned by trip_id prefix לביצועים
CREATE TABLE gtfs_stop_times (
  trip_id           TEXT NOT NULL,
  stop_sequence     SMALLINT NOT NULL,
  stop_id           INTEGER REFERENCES gtfs_stops(stop_id),
  arrival_time      INTERVAL,                     -- '05:10:00' → interval
  departure_time    INTERVAL,
  pickup_type       SMALLINT DEFAULT 0,
  drop_off_type     SMALLINT DEFAULT 0,
  shape_dist_traveled REAL,
  source_version    TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX idx_stop_times_stop ON gtfs_stop_times (stop_id);
CREATE INDEX idx_stop_times_trip ON gtfs_stop_times (trip_id);

-- ============================================================
-- SECTION 3: תאונות דרכים (LMS)
-- accidents_data.csv — 8,832 תאונות, קואורדינטות ITM (EPSG:2039)
-- שדות: 45 עמודות, קודים נומריים לפי מילון נתונים LMS
-- ============================================================

CREATE TABLE accidents (
  -- מזהה
  pk_teuna_fikt       BIGINT PRIMARY KEY,         -- מזהה פיקטיבי ייחודי
  sug_tik             SMALLINT,                   -- סוג תיק (1=תאונה)

  -- מיקום גיאוגרפי
  thum_geografi       SMALLINT,                   -- 1=עירוני, 2=בין-עירוני
  sug_dereh           SMALLINT,                   -- סוג דרך
  semel_yishuv        INTEGER,                    -- סמל יישוב
  rehov1              INTEGER,                    -- רחוב ראשי
  rehov2              INTEGER,                    -- רחוב משני (צומת)
  bayit               INTEGER,                    -- מספר בית
  zomet_ironi         INTEGER,                    -- צומת עירוני
  kvish1              INTEGER,                    -- כביש ראשי
  kvish2              INTEGER,                    -- כביש משני
  km                  NUMERIC(8,3),               -- קילומטר בכביש
  zomet_lo_ironi      INTEGER,                    -- צומת בין-עירוני
  yehida              INTEGER,                    -- יחידה משטרתית

  -- זמן התאונה
  shnat_teuna         SMALLINT NOT NULL,          -- שנה
  hodesh_teuna        SMALLINT,                   -- חודש (1-12)
  shaa                SMALLINT,                   -- שעה (0-24 בקידוד מיוחד)
  sug_yom             SMALLINT,                   -- סוג יום (1=חול, 2=ערב חג, ...)
  yom_layla           SMALLINT,                   -- 1=יום, 2=לילה
  yom_bashavua        SMALLINT,                   -- יום בשבוע (1=ראשון)

  -- חומרה וסוג
  humrat_teuna        SMALLINT NOT NULL,          -- 1=קטלנית, 2=קשה, 3=קלה
  sug_teuna           SMALLINT,                   -- סוג התאונה (1-20)

  -- מאפייני דרך
  had_maslul          SMALLINT,                   -- חד-מסלול
  rav_maslul          SMALLINT,                   -- רב-מסלול
  mehirut_muteret     SMALLINT,                   -- מהירות מותרת
  tkinut              SMALLINT,                   -- תקינות דרך
  rohav               SMALLINT,                   -- רוחב דרך
  simun_timrur        SMALLINT,                   -- סימון תמרור
  teura               SMALLINT,                   -- תאורה
  mezeg_avir          SMALLINT,                   -- מזג אוויר
  pne_kvish           SMALLINT,                   -- פני כביש (יבש/רטוב)

  -- מאפייני מיקום
  sug_ezem            SMALLINT,                   -- סוג עצם (עמוד, עץ...)
  merhak_ezem         SMALLINT,                   -- מרחק מעצם
  lo_haza             SMALLINT,                   -- מרחק מהצומת
  ofen_haziya         SMALLINT,                   -- אופן חציה
  mekom_haziya        SMALLINT,                   -- מקום חציה
  kivun_haziya        SMALLINT,                   -- כיוון חציה

  -- אזורי
  mahoz               SMALLINT,                   -- מחוז (1-6)
  nafa                SMALLINT,                   -- נפה
  ezor_tivi           INTEGER,                    -- אזור טבעי
  maamad_minizipali   SMALLINT,                   -- מעמד מוניציפלי
  zurat_ishuv         SMALLINT,                   -- צורת ישוב
  status_igun         SMALLINT,                   -- סטטוס אכלוס

  -- קואורדינטות — X,Y ב-ITM (EPSG:2039), ממירים ל-WGS84 לאחסון
  x_itm               INTEGER,                    -- קואורדינטת X מקורית (ITM)
  y_itm               INTEGER,                    -- קואורדינטת Y מקורית (ITM)
  geom                GEOMETRY(Point, 4326),      -- ממוּר ל-WGS84 אוטומטית

  source_version      TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקסים לתאונות
CREATE INDEX idx_accidents_geom         ON accidents USING GIST (geom);
CREATE INDEX idx_accidents_year         ON accidents (shnat_teuna);
CREATE INDEX idx_accidents_severity     ON accidents (humrat_teuna);
CREATE INDEX idx_accidents_type         ON accidents (sug_teuna);
CREATE INDEX idx_accidents_yishuv       ON accidents (semel_yishuv);
CREATE INDEX idx_accidents_mahoz_nafa   ON accidents (mahoz, nafa);
CREATE INDEX idx_accidents_month        ON accidents (shnat_teuna, hodesh_teuna);

-- ============================================================
-- SECTION 4: רשויות תמרור / דרכים
-- roadauthority.csv — 4,007 מקטעי דרך
-- שדות: OID, TRAFCODE, TRAFAUTH, ROADNAME, ROADNUMBER, YEARMONTH, Shape_Length
-- ============================================================

-- טבלת lookup: 15 רשויות תמרור ייחודיות
CREATE TABLE road_authorities (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,               -- 'נתיבי ישראל', 'דרך ארץ'...
  short_name  TEXT,
  authority_type TEXT,                            -- 'state' | 'municipal' | 'private'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- מקטעי דרכים
CREATE TABLE roads (
  id              SERIAL PRIMARY KEY,
  oid_original    INTEGER,                        -- OID מקורי מהקובץ (כולם -1!)
  trafcode        INTEGER,                        -- קוד מקטע תמרור (70106...)
  authority_id    INTEGER REFERENCES road_authorities(id),
  road_name       TEXT,                           -- שם הדרך (ריק ברוב השורות)
  road_number     INTEGER,                        -- מספר כביש (1, 2, 4...)
  year_month      TEXT,                           -- YYYYMM ('202007'...)
  shape_length    NUMERIC(14,6),                  -- אורך מקטע (מטרים)
  geom            GEOMETRY(LineString, 4326),     -- ייטען מה-Shapefile המלא
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roads_geom         ON roads USING GIST (geom);
CREATE INDEX idx_roads_number       ON roads (road_number);
CREATE INDEX idx_roads_authority    ON roads (authority_id);
CREATE INDEX idx_roads_trafcode     ON roads (trafcode);

-- ============================================================
-- SECTION 5: תשתיות (Infrastructure Layer)
-- מקורות: רכבת ישראל (API פתוח) + נת"ע (GeoJSON ציבורי)
-- ============================================================

-- תחנות רכבת ישראל
CREATE TABLE infra_railway_stations (
  id              SERIAL PRIMARY KEY,
  station_id      INTEGER UNIQUE,                 -- מזהה רכבת ישראל
  station_name    TEXT NOT NULL,
  station_name_en TEXT,
  station_name_ar TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  has_parking     BOOLEAN,
  platforms       SMALLINT,
  geom            GEOMETRY(Point, 4326),
  source_url      TEXT,
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_railway_stations_geom ON infra_railway_stations USING GIST (geom);

-- מסילות רכבת ישראל
CREATE TABLE infra_railway_lines (
  id              SERIAL PRIMARY KEY,
  line_id         TEXT UNIQUE,
  line_name       TEXT,
  line_type       TEXT,                           -- 'heavy_rail' | 'light_rail'
  status          TEXT DEFAULT 'operational'
    CHECK (status IN ('operational', 'under_construction', 'planned')),
  geom            GEOMETRY(MultiLineString, 4326),
  source_url      TEXT,
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_railway_lines_geom ON infra_railway_lines USING GIST (geom);

-- תוואי מטרו ורכבת קלה — נת"ע
CREATE TABLE infra_metro_lines (
  id              SERIAL PRIMARY KEY,
  line_id         TEXT UNIQUE,                    -- 'M1', 'RED', 'GREEN'...
  line_name       TEXT NOT NULL,
  line_color      TEXT,                           -- hex color
  line_type       TEXT,                           -- 'metro' | 'light_rail' | 'brt'
  status          TEXT DEFAULT 'planned'
    CHECK (status IN ('operational', 'under_construction', 'planned')),
  expected_open   INTEGER,                        -- שנת פתיחה משוערת
  geom            GEOMETRY(MultiLineString, 4326),
  source_url      TEXT,
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_metro_lines_geom ON infra_metro_lines USING GIST (geom);

-- תחנות מטרו ורכבת קלה — נת"ע
CREATE TABLE infra_metro_stations (
  id              SERIAL PRIMARY KEY,
  station_id      TEXT UNIQUE,
  station_name    TEXT NOT NULL,
  line_id         TEXT REFERENCES infra_metro_lines(line_id),
  status          TEXT DEFAULT 'planned',
  geom            GEOMETRY(Point, 4326),
  source_url      TEXT,
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_metro_stations_geom ON infra_metro_stations USING GIST (geom);

-- ============================================================
-- SECTION 6: גבולות מוניציפליים (data.gov.il — muni_vaadim)
-- שימושי ל-spatial joins ולסינון לפי עיר/נפה/מחוז
-- ============================================================

CREATE TABLE municipalities (
  id              SERIAL PRIMARY KEY,
  semel_yishuv   INTEGER UNIQUE,                 -- סמל יישוב (מתאים לשדה בתאונות)
  name_he         TEXT NOT NULL,
  name_en         TEXT,
  nafa            SMALLINT,                       -- קוד נפה
  mahoz           SMALLINT,                       -- קוד מחוז
  maamad          SMALLINT,                       -- מעמד מוניציפלי
  area_sqkm       NUMERIC(10,3),
  population      INTEGER,
  geom            GEOMETRY(MultiPolygon, 4326),
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_municipalities_geom    ON municipalities USING GIST (geom);
CREATE INDEX idx_municipalities_semel   ON municipalities (semel_yishuv);
CREATE INDEX idx_municipalities_nafa    ON municipalities (nafa);

-- ============================================================
-- SECTION 7: ספירות תנועה (Vol4 — data.gov.il)
-- ============================================================

-- תחנות ספירה (סטטי — לא משתנות הרבה)
CREATE TABLE traffic_count_stations (
  id              SERIAL PRIMARY KEY,
  station_id      TEXT UNIQUE NOT NULL,
  station_name    TEXT,
  road_number     INTEGER,
  km              NUMERIC(8,3),
  direction       TEXT,
  geom            GEOMETRY(Point, 4326),
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_traffic_stations_geom ON traffic_count_stations USING GIST (geom);

-- מדידות ספירה (דינמי — גדל עם הזמן)
CREATE TABLE traffic_counts (
  id              BIGSERIAL PRIMARY KEY,
  station_id      TEXT REFERENCES traffic_count_stations(station_id),
  count_date      DATE NOT NULL,
  hour            SMALLINT,                       -- 0-23
  vehicle_type    TEXT,                           -- 'car', 'truck', 'motorcycle'...
  volume          INTEGER,                        -- מספר רכבים
  source_version  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_traffic_counts_station  ON traffic_counts (station_id);
CREATE INDEX idx_traffic_counts_date     ON traffic_counts (count_date);
CREATE INDEX idx_traffic_counts_station_date ON traffic_counts (station_id, count_date);

-- ============================================================
-- SEED DATA: road_authorities מהניתוח
-- (15 רשויות שנמצאו בקובץ roadauthority.csv)
-- ============================================================

INSERT INTO road_authorities (name, authority_type) VALUES
  ('נתיבי ישראל',           'state'),
  ('דרך ארץ',               'private'),
  ('נתיבי איילון',          'state'),
  ('נתיבי היובל',           'private'),
  ('רכבת ישראל',            'state'),
  ('כרמלטון',               'private'),
  ('נתע',                   'state'),
  ('חוצה צפון',             'private'),
  ('מסוף נהר הירדן',        'private'),
  ('שפיר נתיב מהיר',        'private'),
  ('שיכון ובינוי - נתיב',   'private'),
  ('חוצה ישראל',            'private'),
  ('חברת נמלי ישראל',       'state'),
  ('שדה תעופה הרצליה',      'private'),
  ('משרד הביטחון',          'state');

-- ============================================================
-- SEED DATA: data_sources — רישום מקורות לסוכן העדכון
-- ============================================================

INSERT INTO data_sources (name, display_name, source_url) VALUES
  ('gtfs',
   'GTFS תחבורה ציבורית',
   'https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip'),
  ('accidents',
   'תאונות דרכים — LMS',
   'https://data.gov.il/dataset/lms-data-injure-1'),
  ('roadauthority',
   'רשויות תמרור — נתיבי ישראל',
   'https://data.gov.il/dataset/roadauthority'),
  ('traffic_counts',
   'ספירות תנועה — Vol4',
   'https://data.gov.il/dataset/vol4'),
  ('municipalities',
   'גבולות מוניציפליים',
   'https://data.gov.il/dataset/muni_vaadim'),
  ('railway',
   'רכבת ישראל — תחנות ומסילות',
   'https://www.rail.co.il/he/tourist-and-traveler/Pages/stations.aspx'),
  ('natm',
   'נת"ע — תוואי מטרו ורכבת קלה',
   'https://www.nat.gov.il');

-- ============================================================
-- HELPER FUNCTION: המרת קואורדינטות ITM → WGS84
-- לשימוש ב-seed script של תאונות
-- X,Y מקובץ הם ב-EPSG:2039 (ITM)
-- ============================================================

CREATE OR REPLACE FUNCTION itm_to_wgs84(x_itm FLOAT, y_itm FLOAT)
RETURNS GEOMETRY(Point, 4326)
LANGUAGE SQL IMMUTABLE
AS $$
  SELECT ST_Transform(
    ST_SetSRID(ST_MakePoint(x_itm, y_itm), 2039),
    4326
  );
$$;

-- ============================================================
-- VIEWS שימושיות
-- ============================================================

-- תאונות עם שם יישוב
CREATE OR REPLACE VIEW v_accidents_with_municipality AS
SELECT
  a.*,
  m.name_he AS municipality_name,
  m.mahoz   AS mahoz_code
FROM accidents a
LEFT JOIN municipalities m ON a.semel_yishuv = m.semel_yishuv;

-- תחנות אוטובוס עם כמות קווים שעוברים
CREATE OR REPLACE VIEW v_stops_route_count AS
SELECT
  s.stop_id,
  s.stop_name,
  s.geom,
  COUNT(DISTINCT r.route_id) AS route_count
FROM gtfs_stops s
JOIN gtfs_stop_times st ON s.stop_id = st.stop_id
JOIN gtfs_trips t       ON st.trip_id = t.trip_id
JOIN gtfs_routes r      ON t.route_id = r.route_id
GROUP BY s.stop_id, s.stop_name, s.geom;

-- ============================================================
-- הערות לתיעוד (DECISIONS.md)
-- ============================================================

COMMENT ON TABLE gtfs_stop_times IS
  'הכי כבדה — מאות מיליוני שורות. נטענת רק אם נדרש חיפוש לוחות זמנים. אינדקסים חיוניים.';

COMMENT ON TABLE gtfs_shapes IS
  'במקום לשמור 7.1M שורות נפרדות, כל shape_id נשמר כ-LineString יחיד. חיסכון עצום בנפח ובביצועים.';

COMMENT ON COLUMN accidents.x_itm IS
  'קואורדינטת X מקורית ב-ITM (EPSG:2039). עמודת geom מכילה את הנקודה ממוּרת ל-WGS84 (EPSG:4326).';

COMMENT ON TABLE road_authorities IS
  'טבלת lookup ל-15 הרשויות שנמצאו בקובץ roadauthority.csv. אפשר להרחיב.';
