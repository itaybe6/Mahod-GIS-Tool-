-- ============================================================================
-- מטרה: לפתוח קריאה ציבורית ל-infra_* (כדי שהקליינט יוכל לטעון
-- את שכבות התשתיות ישירות ל-Leaflet / Mapbox), ולחשוף RPC קל-משקל
-- שמחזיר את כל תחנות הרכבת עם קואורדינטות WGS84 כעמודות פשוטות.
--
-- עד היום ה-tables היו עם RLS דלוק וללא policy => ה-anon role ראה 0 שורות
-- ולכן אי אפשר היה לצייר את התחנות במפה.
-- ============================================================================

-- 1. Public SELECT policies (אותו דפוס כמו gtfs_public_select)
ALTER TABLE public.infra_railway_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infra_railway_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infra_metro_stations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infra_metro_lines      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS infra_public_select ON public.infra_railway_stations;
CREATE POLICY infra_public_select ON public.infra_railway_stations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS infra_public_select ON public.infra_railway_lines;
CREATE POLICY infra_public_select ON public.infra_railway_lines
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS infra_public_select ON public.infra_metro_stations;
CREATE POLICY infra_public_select ON public.infra_metro_stations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS infra_public_select ON public.infra_metro_lines;
CREATE POLICY infra_public_select ON public.infra_metro_lines
  FOR SELECT TO anon, authenticated USING (true);

-- 2. RPC: רשימה מלאה של תחנות רכבת עם lon/lat כעמודות, מוכן לקריאה
--    מהקליינט בלי לפענח EWKB hex של geom.
CREATE OR REPLACE FUNCTION public.list_railway_stations()
RETURNS TABLE (
  station_id   INTEGER,
  station_name TEXT,
  status       TEXT,
  is_active    BOOLEAN,
  lon          DOUBLE PRECISION,
  lat          DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.station_id,
    s.station_name,
    COALESCE(s.status, 'planned')   AS status,
    COALESCE(s.is_active, FALSE)    AS is_active,
    ST_X(s.geom)::double precision  AS lon,
    ST_Y(s.geom)::double precision  AS lat
  FROM public.infra_railway_stations s
  WHERE s.geom IS NOT NULL
    AND s.station_id IS NOT NULL
  ORDER BY s.station_id;
$$;

GRANT EXECUTE ON FUNCTION public.list_railway_stations() TO anon, authenticated;

COMMENT ON FUNCTION public.list_railway_stations() IS
  'מחזיר את כל תחנות הרכבת הכבדה עם קואורדינטות WGS84 כעמודות lon/lat. SECURITY DEFINER כדי להימנע מתלות ב-RLS של הקליינט.';
