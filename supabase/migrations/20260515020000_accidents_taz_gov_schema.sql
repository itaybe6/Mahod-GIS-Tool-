-- CBS TAZ road-accident aggregates (accid_taz style CSV from data.gov.il).
-- Replaces prior LMS per-accident point table. Spatial RPC joins by citycode ↔ municipalities.semel_yishuv.

DROP FUNCTION IF EXISTS public.query_accidents_in_polygon(TEXT);

DROP VIEW IF EXISTS public.v_accidents_with_municipality;

DROP TABLE IF EXISTS public.accidents CASCADE;

CREATE TABLE public.accidents (
  gov_oid          INTEGER,
  object_id        INTEGER PRIMARY KEY,
  pop_2018         INTEGER,
  usetype          TEXT,
  usetypecod       SMALLINT,
  city             TEXT,
  mainuse          TEXT,
  tazarea          NUMERIC(24, 6),
  sumacciden       INTEGER,
  dead             INTEGER,
  sever_inj        INTEGER,
  sligh_inj        INTEGER,
  pedestrinj       INTEGER,
  inj0_19          INTEGER,
  inj20_64         INTEGER,
  inj65_           INTEGER,
  injtotal         INTEGER,
  totdrivers       INTEGER,
  motorcycle       INTEGER,
  truck            INTEGER,
  bicycle          INTEGER,
  private_vehicle  INTEGER,
  vehicles         INTEGER,
  acc_index        NUMERIC(18, 6),
  yearmonth        INTEGER NOT NULL,
  citycode         INTEGER,
  shape_length     NUMERIC(24, 12),
  shape_area       NUMERIC(28, 12),
  source_version   TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accidents_citycode ON public.accidents (citycode);
CREATE INDEX idx_accidents_yearmonth ON public.accidents (yearmonth);

COMMENT ON TABLE public.accidents IS
  'Aggregated road accidents by TAZ (traffic analysis zone), CBS accid_taz export from data.gov.il — not individual LMS accident points.';

CREATE OR REPLACE VIEW public.v_accidents_with_municipality AS
SELECT
  a.*,
  m.name_he AS municipality_name,
  m.mahoz   AS mahoz_text
FROM public.accidents a
LEFT JOIN public.municipalities m ON a.citycode = m.semel_yishuv;

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
BEGIN
  WITH ms AS (
    SELECT m.semel_yishuv, m.name_he, m.geom
    FROM public.municipalities m
    WHERE m.geom IS NOT NULL
      AND ST_Intersects(m.geom, poly)
  ),
  agg AS (
    SELECT
      a.citycode,
      MAX(a.city) AS city_label,
      MAX(a.yearmonth)::int AS ym,
      SUM(COALESCE(a.sumacciden, 0))::bigint AS sum_accidents,
      SUM(COALESCE(a.dead, 0))::bigint AS sum_dead,
      SUM(COALESCE(a.sever_inj, 0))::bigint AS sum_sever,
      SUM(COALESCE(a.sligh_inj, 0))::bigint AS sum_sligh
    FROM public.accidents a
    INNER JOIN ms ON ms.semel_yishuv = a.citycode
    WHERE a.citycode IS NOT NULL AND a.citycode <> 0
    GROUP BY a.citycode
  ),
  fc_json AS (
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(ST_PointOnSurface(ms.geom))::jsonb,
              'properties', jsonb_build_object(
                'id', a.citycode,
                'city', a.city_label,
                'year', (a.ym / 100),
                'month', (a.ym % 100),
                'severity', NULL,
                'type', 'taz_aggregate',
                'accidents', a.sum_accidents,
                'fatal', a.sum_dead,
                'severe_inj', a.sum_sever,
                'light_inj', a.sum_sligh
              )
            )
            ORDER BY a.citycode
          )
          FROM agg a
          JOIN ms ON ms.semel_yishuv = a.citycode
        ),
        '[]'::jsonb
      )
    ) AS j
  ),
  tot AS (
    SELECT
      COALESCE(SUM(sum_accidents), 0)::bigint AS total,
      COALESCE(SUM(sum_dead), 0)::bigint AS fatal,
      COALESCE(SUM(sum_sever), 0)::bigint AS severe,
      COALESCE(SUM(sum_sligh), 0)::bigint AS light
    FROM agg
  )
  SELECT fj.j, t.total, t.fatal, t.severe, t.light
  INTO fc, total, fatal, severe, light
  FROM fc_json fj
  CROSS JOIN tot t;

  RETURN jsonb_build_object(
    'features', COALESCE(fc, '{"type":"FeatureCollection","features":[]}'::jsonb),
    'counts', jsonb_build_object(
      'count', total,
      'breakdown', jsonb_build_object(
        'fatal', fatal,
        'severe', severe,
        'light', light
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.query_accidents_in_polygon(TEXT) TO anon, authenticated;

ALTER TABLE public.accidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accidents_public_select ON public.accidents;
CREATE POLICY accidents_public_select ON public.accidents
  FOR SELECT TO anon, authenticated USING (true);

UPDATE public.data_sources
SET
  display_name = 'תאונות דרכים — מרוכז לפי אזורי TAZ (CBS)',
  source_url = 'https://www.gov.il/he/departments/guides/data-gov',
  metadata = COALESCE(metadata, '{}'::jsonb) || '{"format":"accid_taz_csv","model":"taz_aggregate"}'::jsonb,
  updated_at = NOW()
WHERE name = 'accidents';
