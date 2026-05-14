-- ============================================================
-- Route planner RPC: תכנון מסלול A → B עם תח"צ ישירה (ללא החלפות).
--
-- קלט: שתי נקודות WGS84 (origin, destination) + מגבלת הליכה במטרים.
-- פלט: JSONB עם רשימת אופציות. כל אופציה מתארת רגל אחת:
--      "הליכה לתחנת A → קו תח"צ → הליכה מתחנת B ליעד".
--
-- מבוסס על העובדה ש-`gtfs_stop_route` הוא דה-נורמליזציה של
-- stop_times.txt: כל זוג (stop_id, route_id, direction_id) מובטח
-- שיש לפחות trip אחד שבו האוטובוס עובר בתחנה הזאת בכיוון הזה.
-- אין לנו לוחות זמנים, אז ההיוריסטיקה היא:
--   * שני stops על אותו (route_id, direction_id) ⇒ אותו אוטובוס
--     עובר בשניהם, בסדר מסוים שמוכתב על ידי ה-shape.
--   * משווים בין מיקום השנים על ה-LineString של ה-shape דרך
--     ST_LineLocatePoint; מי שיותר מאוחר על הקו הוא היעד.
-- ============================================================

DROP FUNCTION IF EXISTS public.plan_transit_route(
  numeric, numeric, numeric, numeric, numeric, integer, integer
);

CREATE OR REPLACE FUNCTION public.plan_transit_route(
  origin_lng        numeric,
  origin_lat        numeric,
  dest_lng          numeric,
  dest_lat          numeric,
  max_walk_meters   numeric DEFAULT 1200,
  max_stops_per_end integer DEFAULT 8,
  max_results       integer DEFAULT 8
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  origin_pt geometry := ST_SetSRID(ST_MakePoint(origin_lng, origin_lat), 4326);
  dest_pt   geometry := ST_SetSRID(ST_MakePoint(dest_lng,   dest_lat),   4326);
  result    jsonb;
BEGIN
  -- אם אחת מהנקודות מחוץ לישראל בקירוב, נכשלים מהר בלי לגעת ב-gtfs_stops.
  IF NOT ST_Intersects(
       origin_pt,
       ST_MakeEnvelope(34.0, 29.0, 36.5, 33.5, 4326)
     )
     OR NOT ST_Intersects(
       dest_pt,
       ST_MakeEnvelope(34.0, 29.0, 36.5, 33.5, 4326)
     )
  THEN
    RETURN jsonb_build_object(
      'origin',      jsonb_build_object('lng', origin_lng, 'lat', origin_lat),
      'destination', jsonb_build_object('lng', dest_lng,   'lat', dest_lat),
      'options',     '[]'::jsonb,
      'warning',     'אחת מהנקודות מחוץ לטווח הכיסוי של GTFS ישראל.'
    );
  END IF;

  WITH origin_stops AS (
    SELECT
      s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.geom,
      ST_Distance(s.geom::geography, origin_pt::geography) AS walk_m
    FROM public.gtfs_stops s
    WHERE s.geom IS NOT NULL
      AND ST_DWithin(s.geom::geography, origin_pt::geography, max_walk_meters)
    ORDER BY s.geom <-> origin_pt
    LIMIT max_stops_per_end
  ),
  dest_stops AS (
    SELECT
      s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, s.geom,
      ST_Distance(s.geom::geography, dest_pt::geography) AS walk_m
    FROM public.gtfs_stops s
    WHERE s.geom IS NOT NULL
      AND ST_DWithin(s.geom::geography, dest_pt::geography, max_walk_meters)
    ORDER BY s.geom <-> dest_pt
    LIMIT max_stops_per_end
  ),
  -- כל הזוגות (origin_stop, dest_stop) שמשרת אותם הקו זהה בכיוון זהה.
  candidates AS (
    SELECT
      os.stop_id   AS from_stop_id,
      os.stop_name AS from_stop_name,
      os.stop_lat  AS from_lat,
      os.stop_lon  AS from_lon,
      os.geom      AS from_geom,
      os.walk_m    AS walk_to_stop_m,
      ds.stop_id   AS to_stop_id,
      ds.stop_name AS to_stop_name,
      ds.stop_lat  AS to_lat,
      ds.stop_lon  AS to_lon,
      ds.geom      AS to_geom,
      ds.walk_m    AS walk_from_stop_m,
      osr.route_id,
      osr.direction_id
    FROM origin_stops os
    JOIN public.gtfs_stop_route osr ON osr.stop_id = os.stop_id
    JOIN public.gtfs_stop_route dsr
      ON  dsr.route_id     = osr.route_id
      AND dsr.direction_id = osr.direction_id
    JOIN dest_stops ds ON ds.stop_id = dsr.stop_id
    WHERE os.stop_id <> ds.stop_id
  ),
  -- בוחרים shape יצוגי אחד לכל (route_id, direction_id).
  with_shape AS (
    SELECT
      c.*,
      r.route_short_name,
      r.route_long_name,
      r.route_type,
      (
        SELECT t.shape_id
        FROM public.gtfs_trips t
        WHERE t.route_id     = c.route_id
          AND t.direction_id = c.direction_id
          AND t.shape_id IS NOT NULL
        LIMIT 1
      ) AS shape_id
    FROM candidates c
    JOIN public.gtfs_routes r ON r.route_id = c.route_id
  ),
  -- ממפים כל תחנה ל-fraction שלה על ה-LineString, ומחשבים אורך נסיעה.
  measured AS (
    SELECT
      ws.*,
      sh.geom AS shape_geom,
      CASE WHEN sh.geom IS NULL THEN NULL
           ELSE ST_LineLocatePoint(sh.geom, ws.from_geom) END AS from_frac,
      CASE WHEN sh.geom IS NULL THEN NULL
           ELSE ST_LineLocatePoint(sh.geom, ws.to_geom)   END AS to_frac
    FROM with_shape ws
    LEFT JOIN public.gtfs_shapes sh ON sh.shape_id = ws.shape_id
  ),
  -- שומרים רק אופציות שבהן from נמצא לפני to על הקו (כיוון נכון).
  valid AS (
    SELECT
      m.*,
      CASE
        WHEN m.shape_geom IS NULL OR m.from_frac IS NULL OR m.to_frac IS NULL THEN NULL
        WHEN m.from_frac < m.to_frac THEN
          ST_Length(ST_LineSubstring(m.shape_geom, m.from_frac, m.to_frac)::geography)
        ELSE NULL
      END AS transit_distance_m,
      CASE
        WHEN m.shape_geom IS NULL OR m.from_frac IS NULL OR m.to_frac IS NULL THEN NULL
        WHEN m.from_frac < m.to_frac THEN
          ST_AsGeoJSON(ST_LineSubstring(m.shape_geom, m.from_frac, m.to_frac))::jsonb
        ELSE NULL
      END AS shape_segment
    FROM measured m
  ),
  ranked AS (
    SELECT
      v.*,
      (v.walk_to_stop_m + v.walk_from_stop_m) AS total_walk_m
    FROM valid v
    WHERE v.transit_distance_m IS NOT NULL
  ),
  -- אופציה אחת לכל (route_id, direction_id): זו עם ההליכה הקצרה ביותר.
  best_per_route AS (
    SELECT DISTINCT ON (route_id, direction_id) *
    FROM ranked
    ORDER BY route_id, direction_id, total_walk_m ASC
  ),
  top_n AS (
    SELECT * FROM best_per_route
    ORDER BY total_walk_m ASC
    LIMIT max_results
  )
  SELECT jsonb_build_object(
    'origin',      jsonb_build_object('lng', origin_lng, 'lat', origin_lat),
    'destination', jsonb_build_object('lng', dest_lng,   'lat', dest_lat),
    'options', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'route_id',           route_id,
          'route_short_name',   route_short_name,
          'route_long_name',    route_long_name,
          'route_type',         route_type,
          'direction_id',       direction_id,
          'from_stop', jsonb_build_object(
            'stop_id',   from_stop_id,
            'stop_name', from_stop_name,
            'lat',       from_lat,
            'lng',       from_lon
          ),
          'to_stop', jsonb_build_object(
            'stop_id',   to_stop_id,
            'stop_name', to_stop_name,
            'lat',       to_lat,
            'lng',       to_lon
          ),
          'walk_to_stop_m',     walk_to_stop_m,
          'walk_from_stop_m',   walk_from_stop_m,
          'total_walk_m',       total_walk_m,
          'transit_distance_m', transit_distance_m,
          'shape_segment',      shape_segment
        )
        ORDER BY total_walk_m ASC
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM top_n;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_transit_route(
  numeric, numeric, numeric, numeric, numeric, integer, integer
) TO anon, authenticated;
