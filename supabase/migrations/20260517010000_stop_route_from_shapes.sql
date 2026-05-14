-- ============================================================
-- Build gtfs_stop_route WITHOUT stop_times.txt.
--
-- Two RPCs:
--   1. `upsert_gtfs_shapes_bulk(jsonb, text)` — bulk-loader for gtfs_shapes
--      via REST + service-role (used by scripts/seed/seed-shapes-rest.ts).
--   2. `populate_stop_route_from_shapes(buffer_meters, route_offset, route_limit)`
--      — fills gtfs_stop_route from spatial proximity, paged so it doesn't
--      blow statement_timeout on Supabase Cloud.
--
-- Together they substitute for the original `seed:stop-route` script (which
-- requires DATABASE_URL and stop_times.txt — neither is available here).
-- See docs/DECISIONS.md, "תלויות נתונים — ולמה ויתרנו על stop_times.txt".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Bulk LineString upsert from JSONB (REST-friendly).
--    Accepts:  [{ "shape_id": int, "points": [[lng,lat], ...] }, ...]
--    Returns:  number of shapes upserted.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_gtfs_shapes_bulk(jsonb, text);

CREATE OR REPLACE FUNCTION public.upsert_gtfs_shapes_bulk(
  shapes_json    jsonb,
  default_version text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
VOLATILE
AS $$
WITH input AS (
  SELECT
    (s.shape ->> 'shape_id')::int           AS shape_id,
    s.shape -> 'points'                     AS points,
    NULLIF(s.shape ->> 'source_version','') AS sv
  FROM jsonb_array_elements(shapes_json) AS s(shape)
),
exploded AS (
  SELECT
    i.shape_id,
    i.sv,
    ord,
    (pt ->> 0)::double precision AS lng,
    (pt ->> 1)::double precision AS lat
  FROM input i,
       LATERAL jsonb_array_elements(i.points) WITH ORDINALITY AS p(pt, ord)
),
shaped AS (
  SELECT
    shape_id,
    MAX(sv) AS sv,
    ST_SetSRID(
      ST_MakeLine(array_agg(ST_MakePoint(lng, lat) ORDER BY ord)),
      4326
    ) AS geom,
    COUNT(*)::int AS point_count
  FROM exploded
  GROUP BY shape_id
  HAVING COUNT(*) >= 2
),
upserted AS (
  INSERT INTO public.gtfs_shapes AS t (shape_id, geom, point_count, source_version, updated_at)
  SELECT shape_id, geom, point_count, COALESCE(sv, default_version), now()
  FROM shaped
  ON CONFLICT (shape_id) DO UPDATE SET
    geom           = EXCLUDED.geom,
    point_count    = EXCLUDED.point_count,
    source_version = EXCLUDED.source_version,
    updated_at     = now()
  RETURNING 1
)
SELECT COUNT(*)::int FROM upserted;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_gtfs_shapes_bulk(jsonb, text)
  TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Populate gtfs_stop_route from spatial proximity (paged).
--
-- Algorithm (per route_id+direction_id):
--   1. Pick one representative shape_id from gtfs_trips.
--   2. Find all stops within `buffer_meters` of that shape's LineString.
--   3. Insert (stop_id, route_id, direction_id) — ON CONFLICT DO NOTHING.
--
-- The 110000.0 divisor converts buffer_meters to degrees (a good
-- approximation near 32° N latitude), enabling the GIST index on
-- gtfs_stops.geom for the ST_DWithin scan; an ST_Distance::geography
-- check then enforces the true metric distance.
--
-- Service-role typically caps statement_timeout at 30s — paging with
-- route_limit ≈ 300 keeps every batch well under that.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.populate_stop_route_from_shapes(numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.populate_stop_route_from_shapes(
  buffer_meters numeric DEFAULT 30,
  route_offset  integer DEFAULT 0,
  route_limit   integer DEFAULT 300
)
RETURNS TABLE (
  route_directions_processed integer,
  links_inserted             integer,
  last_route_id              integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  rd_count       integer := 0;
  inserted       integer := 0;
  last_rid       integer := NULL;
  buffer_degrees numeric := buffer_meters / 110000.0;
BEGIN
  WITH rep_shapes AS (
    SELECT DISTINCT ON (t.route_id, t.direction_id)
      t.route_id,
      t.direction_id,
      t.shape_id
    FROM public.gtfs_trips t
    WHERE t.shape_id IS NOT NULL
      AND t.direction_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.gtfs_shapes s WHERE s.shape_id = t.shape_id
      )
    ORDER BY t.route_id, t.direction_id, t.shape_id
  ),
  paged AS (
    SELECT * FROM rep_shapes
    ORDER BY route_id, direction_id
    OFFSET route_offset LIMIT route_limit
  ),
  joined AS (
    SELECT
      ps.route_id,
      ps.direction_id,
      st.stop_id
    FROM paged ps
    JOIN public.gtfs_shapes sh ON sh.shape_id = ps.shape_id
    JOIN LATERAL (
      SELECT s.stop_id
      FROM public.gtfs_stops s
      WHERE s.geom IS NOT NULL
        AND ST_DWithin(s.geom, sh.geom, buffer_degrees)
        AND ST_Distance(s.geom::geography, sh.geom::geography) <= buffer_meters
    ) st ON TRUE
  ),
  inserted_rows AS (
    INSERT INTO public.gtfs_stop_route (stop_id, route_id, direction_id, source_version, updated_at)
    SELECT j.stop_id, j.route_id, j.direction_id,
           'spatial-' || buffer_meters::text || 'm',
           now()
    FROM joined j
    ON CONFLICT (stop_id, route_id, direction_id) DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM paged),
    (SELECT count(*) FROM inserted_rows),
    (SELECT max(route_id) FROM paged)
  INTO rd_count, inserted, last_rid;

  RETURN QUERY SELECT rd_count, inserted, last_rid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_stop_route_from_shapes(numeric, integer, integer)
  TO authenticated, service_role;
