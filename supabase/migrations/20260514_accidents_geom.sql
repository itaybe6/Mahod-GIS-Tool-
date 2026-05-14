-- Adds future spatial support for TAZ accident aggregates.
-- `geom` is nullable because the current import contains statistical rows only.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.accidents
  ADD COLUMN IF NOT EXISTS geom GEOMETRY(MultiPolygon, 4326);

CREATE INDEX IF NOT EXISTS idx_accidents_geom
  ON public.accidents
  USING GIST (geom);

COMMENT ON COLUMN public.accidents.geom IS
  'Optional TAZ MultiPolygon geometry in WGS84. NULL until geographic shapes are loaded.';
