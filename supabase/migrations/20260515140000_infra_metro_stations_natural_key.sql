-- infra_metro_stations: station_id as primary key (no surrogate id), status CHECK aligned with infra_metro_lines

-- Normalize any unexpected status values before adding CHECK
UPDATE public.infra_metro_stations
SET status = 'planned'
WHERE status IS NULL
   OR status NOT IN ('operational', 'under_construction', 'planned');

ALTER TABLE public.infra_metro_stations DROP CONSTRAINT IF EXISTS infra_metro_stations_pkey;
ALTER TABLE public.infra_metro_stations DROP CONSTRAINT IF EXISTS infra_metro_stations_station_id_key;

ALTER TABLE public.infra_metro_stations DROP COLUMN IF EXISTS id;

ALTER TABLE public.infra_metro_stations ADD PRIMARY KEY (station_id);

ALTER TABLE public.infra_metro_stations DROP CONSTRAINT IF EXISTS infra_metro_stations_status_check;
ALTER TABLE public.infra_metro_stations
  ADD CONSTRAINT infra_metro_stations_status_check
  CHECK (status IN ('operational', 'under_construction', 'planned'));

-- query_infra_in_polygon referenced numeric id; use station_id for properties.id
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
            'id',       station_id,
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
