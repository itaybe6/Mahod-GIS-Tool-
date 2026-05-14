DO $$
BEGIN
  IF to_regclass('public.stop_route') IS NOT NULL
     AND to_regclass('public.gtfs_stop_route') IS NULL THEN
    ALTER TABLE public.stop_route RENAME TO gtfs_stop_route;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.gtfs_stop_route') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'stop_route_pkey'
        AND conrelid = 'public.gtfs_stop_route'::regclass
    ) THEN
      ALTER TABLE public.gtfs_stop_route RENAME CONSTRAINT stop_route_pkey TO gtfs_stop_route_pkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'stop_route_stop_id_fkey'
        AND conrelid = 'public.gtfs_stop_route'::regclass
    ) THEN
      ALTER TABLE public.gtfs_stop_route RENAME CONSTRAINT stop_route_stop_id_fkey TO gtfs_stop_route_stop_id_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'stop_route_route_id_fkey'
        AND conrelid = 'public.gtfs_stop_route'::regclass
    ) THEN
      ALTER TABLE public.gtfs_stop_route RENAME CONSTRAINT stop_route_route_id_fkey TO gtfs_stop_route_route_id_fkey;
    END IF;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.idx_stop_route_stop RENAME TO idx_gtfs_stop_route_stop;
ALTER INDEX IF EXISTS public.idx_stop_route_route RENAME TO idx_gtfs_stop_route_route;
