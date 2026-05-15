-- parent_station FK was removed earlier; column no longer used in app.
ALTER TABLE public.gtfs_stops
  DROP COLUMN IF EXISTS parent_station;
