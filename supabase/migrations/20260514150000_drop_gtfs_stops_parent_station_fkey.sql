-- Bulk GTFS CSV import: parent_station can reference a stop_id not yet inserted.
ALTER TABLE public.gtfs_stops
  DROP CONSTRAINT IF EXISTS gtfs_stops_parent_station_fkey;
