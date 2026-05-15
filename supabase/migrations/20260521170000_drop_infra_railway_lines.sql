-- infra_railway_lines unused; stations remain in infra_railway_stations.
CREATE OR REPLACE FUNCTION public.query_infra_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  features jsonb;
  rs_cnt   integer;
  ms_cnt   integer;
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
    UNION ALL SELECT f FROM metro_stations
  ) all_feats;

  SELECT COUNT(*) INTO rs_cnt FROM public.infra_railway_stations
    WHERE geom IS NOT NULL AND ST_Within(geom, poly);
  SELECT COUNT(*) INTO ms_cnt FROM public.infra_metro_stations
    WHERE geom IS NOT NULL AND ST_Within(geom, poly);

  RETURN jsonb_build_object(
    'features', features,
    'counts',   jsonb_build_object(
      'count',     rs_cnt + ms_cnt,
      'breakdown', jsonb_build_object(
        'rail_stations',  rs_cnt,
        'metro_stations', ms_cnt
      )
    )
  );
END;
$$;

DROP TABLE IF EXISTS public.infra_railway_lines;
