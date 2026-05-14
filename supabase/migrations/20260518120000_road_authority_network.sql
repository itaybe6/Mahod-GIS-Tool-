-- ============================================================
-- רשת רשויות תמרור (ROADAUTHORITY) — מקטעי קו ב-ITM (EPSG:2039)
-- מחליף את מודל השכבה הישן מסוג פוליגון (AREA_AUTHORITY) ברשת קווים.
-- שאילתות האפליקציה נשארות ב-WGS84; ממירים בזמן שאילתה.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.road_authority_network (
  id           SERIAL PRIMARY KEY,
  trafcode     INTEGER,
  trafauth     TEXT,
  roadname     TEXT,
  roadnumber   INTEGER,
  yearmonth    INTEGER,
  shape_leng   DOUBLE PRECISION,
  geom         GEOMETRY(LineString, 2039) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_road_authority_network_geom
  ON public.road_authority_network USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_road_authority_network_trafcode
  ON public.road_authority_network (trafcode);

COMMENT ON TABLE public.road_authority_network IS
  'מקטעי רשות תמרור מקובץ ROADAUTHORITY (קו בישראל TM Grid / EPSG:2039). מפתח חיבור לטבלאות טבולריות: TRAFCODE.';

ALTER TABLE public.road_authority_network ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS road_authority_network_public_select ON public.road_authority_network;
CREATE POLICY road_authority_network_public_select ON public.road_authority_network
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.road_authority_network TO anon, authenticated;

-- ------------------------------------------------------------
-- דרכים — חיתוך מול פוליגון משתמש (WGS84); גיאומטריה נשלחת ב-4326
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_roads_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly        geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  poly_itm    geometry := ST_Transform(poly, 2039);
  fc          jsonb;
  cnt         integer;
  total_len_m double precision;
BEGIN
  WITH clipped AS (
    SELECT
      n.id,
      n.trafcode,
      n.roadnumber AS road_number,
      n.roadname   AS road_name,
      n.trafauth   AS authority,
      ST_Intersection(ST_Transform(n.geom, 4326), poly) AS clip_geom
    FROM public.road_authority_network n
    WHERE ST_Intersects(n.geom, poly_itm)
  )
  SELECT
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(clip_geom)::jsonb,
            'properties', jsonb_build_object(
              'id',           id,
              'trafcode',     trafcode,
              'road_number',  road_number,
              'road_name',    road_name,
              'authority',    authority,
              'length_m',     ST_Length(clip_geom::geography)
            )
          )
        ),
        '[]'::jsonb
      )
    ),
    COUNT(*),
    COALESCE(SUM(ST_Length(clip_geom::geography)), 0)
  INTO fc, cnt, total_len_m
  FROM clipped
  WHERE NOT ST_IsEmpty(clip_geom);

  RETURN jsonb_build_object(
    'features', fc,
    'counts',   jsonb_build_object(
      'count',     cnt,
      'breakdown', jsonb_build_object(
        'total_length_m', total_len_m
      )
    )
  );
END;
$$;
