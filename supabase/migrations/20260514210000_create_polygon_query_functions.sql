-- ============================================================
-- Spatial query functions for the `analyze-area` Edge Function.
--
-- Each function accepts a WGS84 GeoJSON polygon as TEXT, returns
-- a JSONB envelope with:
--   - features:  GeoJSON FeatureCollection
--   - counts:    { count: int, breakdown?: { ... } }
--
-- Naming follows query_<layer>_in_polygon so the Edge Function can
-- map a `layers.<key>` flag → RPC name with one rule.
--
-- All functions are SECURITY INVOKER — anon + authenticated may call
-- them through PostgREST as long as RLS allows reading the underlying
-- tables. We never expose `service_role` queries from the client.
-- ============================================================

-- Drop legacy versions if a previous deploy created them with a
-- different signature (idempotent migration).
DROP FUNCTION IF EXISTS public.query_gtfs_in_polygon(TEXT);
DROP FUNCTION IF EXISTS public.query_accidents_in_polygon(TEXT);
DROP FUNCTION IF EXISTS public.query_roads_in_polygon(TEXT);
DROP FUNCTION IF EXISTS public.query_infra_in_polygon(TEXT);

-- ------------------------------------------------------------
-- GTFS — תחנות תח"צ בתוך הפוליגון
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_gtfs_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  fc   jsonb;
  cnt  integer;
BEGIN
  SELECT
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(s.geom)::jsonb,
          'properties', jsonb_build_object(
            'stop_id',   s.stop_id,
            'stop_code', s.stop_code,
            'stop_name', s.stop_name,
            'routes',    COALESCE(rc.cnt, 0)
          )
        )
      ), '[]'::jsonb)
    ),
    COUNT(*)
  INTO fc, cnt
  FROM public.gtfs_stops s
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT route_id) AS cnt
    FROM public.gtfs_stop_route
    WHERE stop_id = s.stop_id
  ) rc ON TRUE
  WHERE s.geom IS NOT NULL
    AND ST_Within(s.geom, poly);

  RETURN jsonb_build_object(
    'features', fc,
    'counts',   jsonb_build_object('count', cnt)
  );
END;
$$;

-- ------------------------------------------------------------
-- תאונות LMS בתוך הפוליגון
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_accidents_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  fc        jsonb;
  total     integer;
  fatal     integer;
  severe    integer;
  light     integer;
BEGIN
  WITH hits AS (
    SELECT *
    FROM public.accidents
    WHERE geom IS NOT NULL
      AND ST_Within(geom, poly)
  )
  SELECT
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'geometry', ST_AsGeoJSON(geom)::jsonb,
            'properties', jsonb_build_object(
              'id',       pk_teuna_fikt,
              'year',     shnat_teuna,
              'month',    hodesh_teuna,
              'severity', humrat_teuna,
              'type',     sug_teuna
            )
          )
        ),
        '[]'::jsonb
      )
    ),
    COUNT(*),
    COUNT(*) FILTER (WHERE humrat_teuna = 1),
    COUNT(*) FILTER (WHERE humrat_teuna = 2),
    COUNT(*) FILTER (WHERE humrat_teuna = 3)
  INTO fc, total, fatal, severe, light
  FROM hits;

  RETURN jsonb_build_object(
    'features', fc,
    'counts',   jsonb_build_object(
      'count',     total,
      'breakdown', jsonb_build_object(
        'fatal',  fatal,
        'severe', severe,
        'light',  light
      )
    )
  );
END;
$$;

-- ------------------------------------------------------------
-- דרכים — מקטעים שחותכים את הפוליגון (חיתוך גיאומטרי)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_roads_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  fc          jsonb;
  cnt         integer;
  total_len_m double precision;
BEGIN
  WITH clipped AS (
    SELECT
      r.id,
      r.road_number,
      r.road_name,
      ra.name AS authority,
      ST_Intersection(r.geom, poly) AS clip_geom
    FROM public.roads r
    LEFT JOIN public.road_authorities ra ON r.authority_id = ra.id
    WHERE r.geom IS NOT NULL
      AND ST_Intersects(r.geom, poly)
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
              'id',          id,
              'road_number', road_number,
              'road_name',   road_name,
              'authority',   authority,
              'length_m',    ST_Length(clip_geom::geography)
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

-- ------------------------------------------------------------
-- תשתיות — תחנות + מסילות רכבת ישראל + מטרו/רק"ל
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_infra_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  features jsonb;
  rs_cnt   integer;
  rl_cnt   integer;
  ms_cnt   integer;
  ml_cnt   integer;
BEGIN
  -- Build a unified FeatureCollection so the client can render with
  -- one source / layer pair. The `category` property differentiates.
  WITH
    rail_stations AS (
      SELECT
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', jsonb_build_object(
            'category',   'rail_station',
            'id',         id,
            'name',       station_name,
            'is_active',  is_active
          )
        ) AS f
      FROM public.infra_railway_stations
      WHERE geom IS NOT NULL AND ST_Within(geom, poly)
    ),
    rail_lines AS (
      SELECT
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(ST_Intersection(geom, poly))::jsonb,
          'properties', jsonb_build_object(
            'category', 'rail_line',
            'id',       id,
            'name',     line_name,
            'status',   status
          )
        ) AS f
      FROM public.infra_railway_lines
      WHERE geom IS NOT NULL AND ST_Intersects(geom, poly)
    ),
    metro_stations AS (
      SELECT
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(geom)::jsonb,
          'properties', jsonb_build_object(
            'category', 'metro_station',
            'id',       id,
            'name',     station_name,
            'status',   status
          )
        ) AS f
      FROM public.infra_metro_stations
      WHERE geom IS NOT NULL AND ST_Within(geom, poly)
    ),
    metro_lines AS (
      SELECT
        jsonb_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(ST_Intersection(geom, poly))::jsonb,
          'properties', jsonb_build_object(
            'category', 'metro_line',
            'id',       id,
            'name',     line_name,
            'status',   status,
            'color',    line_color
          )
        ) AS f
      FROM public.infra_metro_lines
      WHERE geom IS NOT NULL AND ST_Intersects(geom, poly)
    )
  SELECT
    jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(
        jsonb_agg(f),
        '[]'::jsonb
      )
    )
  INTO features
  FROM (
    SELECT f FROM rail_stations
    UNION ALL SELECT f FROM rail_lines
    UNION ALL SELECT f FROM metro_stations
    UNION ALL SELECT f FROM metro_lines
  ) all_feats;

  -- Counts come from a separate pass (cheap on small layers).
  SELECT COUNT(*) INTO rs_cnt FROM public.infra_railway_stations
    WHERE geom IS NOT NULL AND ST_Within(geom, poly);
  SELECT COUNT(*) INTO rl_cnt FROM public.infra_railway_lines
    WHERE geom IS NOT NULL AND ST_Intersects(geom, poly);
  SELECT COUNT(*) INTO ms_cnt FROM public.infra_metro_stations
    WHERE geom IS NOT NULL AND ST_Within(geom, poly);
  SELECT COUNT(*) INTO ml_cnt FROM public.infra_metro_lines
    WHERE geom IS NOT NULL AND ST_Intersects(geom, poly);

  RETURN jsonb_build_object(
    'features', features,
    'counts',   jsonb_build_object(
      'count',     rs_cnt + rl_cnt + ms_cnt + ml_cnt,
      'breakdown', jsonb_build_object(
        'rail_stations',  rs_cnt,
        'rail_lines',     rl_cnt,
        'metro_stations', ms_cnt,
        'metro_lines',    ml_cnt
      )
    )
  );
END;
$$;

-- Allow the anon + authenticated roles to call through PostgREST.
-- The Edge Function uses the service role, but exposing them to
-- anon also lets us call directly from the browser when convenient.
GRANT EXECUTE ON FUNCTION public.query_gtfs_in_polygon(TEXT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.query_accidents_in_polygon(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.query_roads_in_polygon(TEXT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.query_infra_in_polygon(TEXT)     TO anon, authenticated;
