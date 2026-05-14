-- ============================================================
-- query_traffic_in_polygon — server-side aggregation of traffic
-- counts and volumes inside a WGS84 polygon, returned as a single
-- compact JSONB envelope.
--
-- Why server-side: traffic_count_volumes can hold tens of thousands
-- of rows per polygon. Streaming raw rows to the browser would be
-- pointless (the UI only needs aggregates), so the function does
-- ALL aggregation in PostgreSQL and ships ~a few KB of JSON instead.
--
-- Output shape:
--   {
--     "features": FeatureCollection<Point>,        -- one feature per count station
--     "counts": {
--       "count": int,                              -- station count in polygon
--       "breakdown": {
--         "total_volume":         bigint,
--         "volume_rows":          int,
--         "stations_with_data":   int,
--         "stations_no_data":     int
--       }
--     },
--     "traffic": {
--       "by_group":   [{ "group", "volume" }, ...],         -- grouped by vehicle_types.group_type
--       "top_types":  [{ "vehicle_type", "volume" }, ...],  -- top 5 vehicle_type strings
--       "by_hour":    { "0": vol, "1": vol, ..., "23": vol }
--     }
--   }
-- ============================================================

DROP FUNCTION IF EXISTS public.query_traffic_in_polygon(TEXT);

CREATE OR REPLACE FUNCTION public.query_traffic_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  result jsonb;
BEGIN
  WITH hits AS (
    SELECT count_id, count_type, description, count_date, geom
    FROM public.traffic_counts
    WHERE geom IS NOT NULL AND ST_Within(geom, poly)
  ),
  hit_volumes AS (
    SELECT v.count_id, v.vehicle_type, v.period_start, v.volume
    FROM public.traffic_count_volumes v
    JOIN hits h USING (count_id)
  ),
  station_volume AS (
    SELECT count_id,
           SUM(volume)::bigint AS total_volume,
           COUNT(*)::int       AS volume_rows
    FROM hit_volumes
    GROUP BY count_id
  ),
  feature_collection AS (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(h.geom)::jsonb,
        'properties', jsonb_build_object(
          'count_id',     h.count_id,
          'count_type',   h.count_type,
          'description',  h.description,
          'count_date',   h.count_date,
          'total_volume', COALESCE(sv.total_volume, 0),
          'volume_rows',  COALESCE(sv.volume_rows, 0)
        )
      )), '[]'::jsonb)
    ) AS fc
    FROM hits h
    LEFT JOIN station_volume sv USING (count_id)
  ),
  agg_totals AS (
    SELECT
      (SELECT COUNT(*) FROM hits)::int                                          AS station_cnt,
      (SELECT COUNT(*) FROM station_volume WHERE total_volume > 0)::int         AS station_with_data,
      (SELECT COALESCE(SUM(volume), 0)::bigint FROM hit_volumes)                AS total_volume,
      (SELECT COUNT(*)::int FROM hit_volumes)                                   AS volume_rows
  ),
  by_group AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'group',  group_type,
             'volume', vol
           ) ORDER BY vol DESC), '[]'::jsonb) AS arr
    FROM (
      SELECT COALESCE(vt.group_type, 'אחר') AS group_type,
             SUM(v.volume)::bigint           AS vol
      FROM hit_volumes v
      LEFT JOIN public.traffic_vehicle_types vt
        ON vt.name = v.vehicle_type
      GROUP BY COALESCE(vt.group_type, 'אחר')
    ) g
  ),
  top_types AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'vehicle_type', vehicle_type,
             'volume',       vol
           ) ORDER BY vol DESC), '[]'::jsonb) AS arr
    FROM (
      SELECT vehicle_type, SUM(volume)::bigint AS vol
      FROM hit_volumes
      GROUP BY vehicle_type
      ORDER BY vol DESC
      LIMIT 5
    ) t
  ),
  by_hour AS (
    SELECT COALESCE(jsonb_object_agg(hour::text, vol), '{}'::jsonb) AS obj
    FROM (
      SELECT EXTRACT(HOUR FROM period_start)::int AS hour,
             SUM(volume)::bigint                   AS vol
      FROM hit_volumes
      GROUP BY EXTRACT(HOUR FROM period_start)::int
    ) h
  )
  SELECT jsonb_build_object(
    'features', (SELECT fc FROM feature_collection),
    'counts',   jsonb_build_object(
      'count',     a.station_cnt,
      'breakdown', jsonb_build_object(
        'total_volume',       a.total_volume,
        'volume_rows',        a.volume_rows,
        'stations_with_data', a.station_with_data,
        'stations_no_data',   a.station_cnt - a.station_with_data
      )
    ),
    'traffic',  jsonb_build_object(
      'by_group',  (SELECT arr FROM by_group),
      'top_types', (SELECT arr FROM top_types),
      'by_hour',   (SELECT obj FROM by_hour)
    )
  )
  INTO result
  FROM agg_totals a;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.query_traffic_in_polygon(TEXT) TO anon, authenticated;
