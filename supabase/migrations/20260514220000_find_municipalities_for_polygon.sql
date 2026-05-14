-- ============================================================
-- find_municipalities_for_polygon
--
-- Given a WGS84 GeoJSON polygon (Polygon / MultiPolygon / Feature /
-- FeatureCollection — all as TEXT), returns the municipalities that
-- intersect with it, sorted by overlap area DESC.
--
-- If no municipality intersects the polygon (e.g. offshore polygons,
-- or polygons over regional councils that aren't in our table), we
-- fall back to the nearest municipality within NEAREST_MAX_M metres
-- and flag it with `is_nearest: true` + `distance_m`.
--
-- Used by the upload flow: as soon as the user uploads a polygon we
-- run this RPC to display "the polygon is located in: <city>".
--
-- SECURITY INVOKER — RLS on `municipalities` still applies. We add a
-- public SELECT policy below so anon clients can use the function
-- through PostgREST without a service-role key.
-- ============================================================

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS municipalities_public_select ON public.municipalities;
CREATE POLICY municipalities_public_select ON public.municipalities
  FOR SELECT TO anon, authenticated USING (true);

DROP FUNCTION IF EXISTS public.find_municipalities_for_polygon(TEXT);

CREATE OR REPLACE FUNCTION public.find_municipalities_for_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  input_json    jsonb;
  input_type    text;
  poly          geometry;
  poly_area     double precision;
  hits_count    integer;
  result        jsonb;
  NEAREST_MAX_M constant double precision := 20000; -- 20 km fallback radius
BEGIN
  BEGIN
    input_json := polygon_geojson::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'polygon_geojson is not valid JSON';
  END;

  input_type := input_json->>'type';

  IF input_type = 'Feature' THEN
    poly := ST_SetSRID(ST_GeomFromGeoJSON((input_json->'geometry')::text), 4326);
  ELSIF input_type = 'FeatureCollection' THEN
    SELECT ST_SetSRID(
             ST_Union(ST_GeomFromGeoJSON((feat->'geometry')::text)),
             4326)
    INTO poly
    FROM jsonb_array_elements(input_json->'features') feat
    WHERE feat ? 'geometry' AND feat->'geometry' IS NOT NULL;
  ELSE
    poly := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  END IF;

  IF poly IS NULL OR ST_IsEmpty(poly) THEN
    RETURN jsonb_build_object('municipalities', '[]'::jsonb, 'polygon_area_m2', 0);
  END IF;

  poly_area := ST_Area(poly::geography);

  -- 1) Try direct overlap first.
  WITH hits AS (
    SELECT
      m.semel_yishuv,
      m.name_he,
      m.name_en,
      m.nafa,
      m.mahoz,
      ST_Area(ST_Intersection(m.geom, poly)::geography) AS overlap_area_m2
    FROM public.municipalities m
    WHERE m.geom IS NOT NULL
      AND ST_Intersects(m.geom, poly)
  ),
  ranked AS (
    SELECT *
    FROM hits
    WHERE overlap_area_m2 > 0
    ORDER BY overlap_area_m2 DESC
    LIMIT 10
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'semel_yishuv',    semel_yishuv,
        'name_he',         name_he,
        'name_en',         name_en,
        'nafa',            nafa,
        'mahoz',           mahoz,
        'overlap_area_m2', overlap_area_m2,
        'overlap_pct',     CASE WHEN poly_area > 0
                                THEN ROUND((overlap_area_m2 / poly_area * 100)::numeric, 2)
                                ELSE NULL END,
        'is_nearest',      false,
        'distance_m',      0
      )
      ORDER BY overlap_area_m2 DESC
    ),
    '[]'::jsonb
  ),
  COUNT(*)
  INTO result, hits_count
  FROM ranked;

  -- 2) If nothing intersected, fall back to nearest municipality within NEAREST_MAX_M.
  IF hits_count = 0 THEN
    SELECT jsonb_build_array(jsonb_build_object(
      'semel_yishuv',    semel_yishuv,
      'name_he',         name_he,
      'name_en',         name_en,
      'nafa',            nafa,
      'mahoz',           mahoz,
      'overlap_area_m2', 0,
      'overlap_pct',     0,
      'is_nearest',      true,
      'distance_m',      ROUND(dist_m::numeric, 0)
    ))
    INTO result
    FROM (
      SELECT
        m.semel_yishuv,
        m.name_he,
        m.name_en,
        m.nafa,
        m.mahoz,
        ST_Distance(m.geom::geography, poly::geography) AS dist_m
      FROM public.municipalities m
      WHERE m.geom IS NOT NULL
      ORDER BY m.geom <-> poly
      LIMIT 1
    ) closest
    WHERE dist_m <= NEAREST_MAX_M;
  END IF;

  RETURN jsonb_build_object(
    'municipalities',  COALESCE(result, '[]'::jsonb),
    'polygon_area_m2', poly_area
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_municipalities_for_polygon(TEXT) TO anon, authenticated;
