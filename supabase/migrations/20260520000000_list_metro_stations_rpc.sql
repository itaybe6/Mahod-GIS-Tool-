-- Expose infra_metro_stations with lon/lat columns for browser clients.
-- Similar to list_railway_stations(), but for metro / light rail stations.

CREATE OR REPLACE FUNCTION public.list_metro_stations()
RETURNS TABLE (
  station_id   TEXT,
  station_name TEXT,
  status       TEXT,
  line_id      TEXT,
  lon          DOUBLE PRECISION,
  lat          DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.station_id,
    s.station_name,
    COALESCE(s.status, 'planned')  AS status,
    s.line_id,
    ST_X(s.geom)::double precision AS lon,
    ST_Y(s.geom)::double precision AS lat
  FROM public.infra_metro_stations s
  WHERE s.geom IS NOT NULL
    AND s.station_id IS NOT NULL
  ORDER BY s.station_name, s.station_id;
$$;

GRANT EXECUTE ON FUNCTION public.list_metro_stations() TO anon, authenticated;

COMMENT ON FUNCTION public.list_metro_stations() IS
  'Returns metro/LRT stations from infra_metro_stations with WGS84 lon/lat columns for direct client rendering.';
