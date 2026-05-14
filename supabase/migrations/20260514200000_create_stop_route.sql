CREATE TABLE IF NOT EXISTS public.gtfs_stop_route (
  stop_id        INTEGER NOT NULL REFERENCES public.gtfs_stops(stop_id) ON DELETE CASCADE,
  route_id       INTEGER NOT NULL REFERENCES public.gtfs_routes(route_id) ON DELETE CASCADE,
  direction_id   SMALLINT NOT NULL,
  source_version TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (stop_id, route_id, direction_id)
);

CREATE INDEX IF NOT EXISTS idx_gtfs_stop_route_stop  ON public.gtfs_stop_route (stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_route_route ON public.gtfs_stop_route (route_id);
