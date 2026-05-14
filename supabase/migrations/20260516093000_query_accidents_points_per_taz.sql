-- One map Point per TAZ aggregate row whose municipality intersects the
-- analysis polygon (same spatial filter as before). Without true TAZ
-- geometries we anchor on ST_PointOnSurface(municipality.geom) and apply a
-- small deterministic ST_Project offset per object_id so multiple zones in
-- the same city remain visually separable — similar density to many transit
-- / traffic station markers.

CREATE OR REPLACE FUNCTION public.query_accidents_in_polygon(polygon_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  poly geometry := ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326);
  fc     jsonb;
  total  bigint;
  fatal  bigint;
  severe bigint;
  light  bigint;
  nfeat  integer;
BEGIN
  WITH ms AS (
    SELECT m.semel_yishuv, m.name_he, m.geom
    FROM public.municipalities m
    WHERE m.geom IS NOT NULL
      AND ST_Intersects(m.geom, poly)
  ),
  hits AS (
    SELECT
      a.*,
      ms.geom AS muni_geom,
      ms.name_he AS muni_name
    FROM public.accidents a
    INNER JOIN ms ON ms.semel_yishuv = a.citycode
    WHERE a.citycode IS NOT NULL AND a.citycode <> 0
  ),
  pts AS (
    SELECT
      h.*,
      ST_SetSRID(
        ST_Project(
          ST_PointOnSurface(h.muni_geom)::geography,
          LEAST(
            2800.0,
            (ABS(h.object_id) % 22 + 1)::double precision * 125.0
          ),
          radians(
            ((h.object_id::bigint * 97 + COALESCE(h.gov_oid, 0)::bigint) % 360)::double precision
          )
        )::geometry,
        4326
      ) AS map_geom
    FROM hits h
  ),
  fc_json AS (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(p.map_geom)::jsonb,
              'properties', jsonb_build_object(
                'id', p.object_id,
                'citycode', p.citycode,
                'city', COALESCE(p.city, p.muni_name),
                'year', (p.yearmonth / 100),
                'month', (p.yearmonth % 100),
                'severity', NULL,
                'type', 'taz_aggregate',
                'accidents', COALESCE(p.sumacciden, 0),
                'fatal', COALESCE(p.dead, 0),
                'severe_inj', COALESCE(p.sever_inj, 0),
                'light_inj', COALESCE(p.sligh_inj, 0)
              )
            )
            ORDER BY p.object_id
          )
          FROM pts p
        ),
        '[]'::jsonb
      )
    ) AS j
  ),
  tot AS (
    SELECT
      COALESCE(SUM(COALESCE(h.sumacciden, 0)), 0)::bigint AS total,
      COALESCE(SUM(COALESCE(h.dead, 0)), 0)::bigint AS fatal,
      COALESCE(SUM(COALESCE(h.sever_inj, 0)), 0)::bigint AS severe,
      COALESCE(SUM(COALESCE(h.sligh_inj, 0)), 0)::bigint AS light,
      COUNT(*)::int AS nfeatures
    FROM hits h
  )
  SELECT fj.j, t.total, t.fatal, t.severe, t.light, t.nfeatures
  INTO fc, total, fatal, severe, light, nfeat
  FROM fc_json fj
  CROSS JOIN tot t;

  RETURN jsonb_build_object(
    'features', COALESCE(fc, '{"type":"FeatureCollection","features":[]}'::jsonb),
    'counts', jsonb_build_object(
      'count', COALESCE(nfeat, 0),
      'breakdown', jsonb_build_object(
        'total_accidents', total,
        'fatal', fatal,
        'severe', severe,
        'light', light
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.query_accidents_in_polygon(TEXT) TO anon, authenticated;
