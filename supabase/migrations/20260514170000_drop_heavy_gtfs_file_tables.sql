-- Heavy GTFS files are served from local static files and read in streams.
-- Keeping these tables in Supabase would consume storage for data that is
-- only needed in small filtered slices.

DROP VIEW IF EXISTS public.v_stops_route_count;
DROP TABLE IF EXISTS public.gtfs_stop_times;
DROP TABLE IF EXISTS public.gtfs_shapes;
