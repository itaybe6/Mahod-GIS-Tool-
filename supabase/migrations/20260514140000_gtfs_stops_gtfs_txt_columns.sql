-- Align gtfs_stops with GTFS stops.txt for text/CSV import.
-- Adds stop_lat/stop_lon; zone_id becomes TEXT (MOT feed often uses long Hebrew labels).

ALTER TABLE gtfs_stops
  ADD COLUMN IF NOT EXISTS stop_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS stop_lon DOUBLE PRECISION;

ALTER TABLE gtfs_stops
  ALTER COLUMN zone_id TYPE TEXT USING (zone_id::text);

CREATE OR REPLACE FUNCTION public.gtfs_stops_set_geom_from_latlon()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stop_lat IS NOT NULL AND NEW.stop_lon IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.stop_lon, NEW.stop_lat), 4326)::geometry(Point, 4326);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gtfs_stops_geom_latlon ON public.gtfs_stops;
CREATE TRIGGER trg_gtfs_stops_geom_latlon
  BEFORE INSERT OR UPDATE OF stop_lat, stop_lon ON public.gtfs_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.gtfs_stops_set_geom_from_latlon();

COMMENT ON COLUMN public.gtfs_stops.stop_lat IS 'GTFS stop_lat — raw WGS84 latitude';
COMMENT ON COLUMN public.gtfs_stops.stop_lon IS 'GTFS stop_lon — raw WGS84 longitude';
COMMENT ON COLUMN public.gtfs_stops.zone_id IS 'GTFS zone_id (often textual in MOT feed)';
