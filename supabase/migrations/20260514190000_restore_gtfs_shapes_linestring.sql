-- Store GTFS shapes as one PostGIS LineString per shape_id.
-- This keeps the routable geometry in Supabase without loading 7.1M raw points.

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
