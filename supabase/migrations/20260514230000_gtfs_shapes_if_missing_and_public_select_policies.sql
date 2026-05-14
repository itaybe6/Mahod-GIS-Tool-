-- Hosted DB had applied `drop_heavy_gtfs_file_tables` without a later restore, so
-- PostgREST returned 404 for `gtfs_shapes`. Separately, GTFS tables had RLS enabled
-- with no SELECT policies, so `anon` saw zero rows for every table.

CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
  shape_id       INTEGER PRIMARY KEY,
  geom           GEOMETRY(LineString, 4326) NOT NULL,
  point_count    INTEGER,
  source_version TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_geom
  ON public.gtfs_shapes USING GIST (geom);

COMMENT ON TABLE public.gtfs_shapes IS
  'GTFS shapes.txt compressed to one PostGIS LineString per shape_id.';

ALTER TABLE public.gtfs_agency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stop_route ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_shapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_agency;
CREATE POLICY gtfs_public_select ON public.gtfs_agency
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_routes;
CREATE POLICY gtfs_public_select ON public.gtfs_routes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_stops;
CREATE POLICY gtfs_public_select ON public.gtfs_stops
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_calendar;
CREATE POLICY gtfs_public_select ON public.gtfs_calendar
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_trips;
CREATE POLICY gtfs_public_select ON public.gtfs_trips
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_stop_route;
CREATE POLICY gtfs_public_select ON public.gtfs_stop_route
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS gtfs_public_select ON public.gtfs_shapes;
CREATE POLICY gtfs_public_select ON public.gtfs_shapes
  FOR SELECT TO anon, authenticated USING (true);
