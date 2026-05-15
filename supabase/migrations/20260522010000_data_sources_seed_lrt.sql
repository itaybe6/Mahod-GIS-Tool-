-- ============================================================
-- Seed data_sources row for 'lrt' (הרכבת הקלה)
-- ============================================================
--
-- מיגרציה קודמת (20260521120000_data_sources_urls_from_data_sources_doc.sql)
-- הניחה שכבר קיימת שורה עם name='lrt' ועדכנה רק את ה-display_name וה-URL.
-- אבל ב-seed המקורי (20260513120000_initial_schema.sql) השורה הזו לא קיימת,
-- כך שאצל פרויקטים חדשים ה-UPDATE לא משפיע על שום שורה.
--
-- כעת, כשנכנס adapter ייעודי ל-lrt בפונקציה update-agent, אנחנו רוצים שהשורה
-- תהיה קיימת ופעילה כדי שה-Edge Function תאתר אותה בשאילתה
-- `select * from data_sources where status = 'active'`.
-- ============================================================

INSERT INTO public.data_sources (name, display_name, source_url, status)
VALUES (
  'lrt',
  'הרכבת הקלה (lrt_stat)',
  'https://data.gov.il/he/datasets/ministry_of_transport/lrt_stat',
  'active'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_url   = EXCLUDED.source_url,
  status       = 'active',
  updated_at   = NOW();
