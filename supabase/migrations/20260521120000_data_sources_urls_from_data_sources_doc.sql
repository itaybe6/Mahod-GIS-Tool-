-- Align public.data_sources URLs and labels with docs/DATA_SOURCES.md

UPDATE public.data_sources SET
  display_name = 'רשת כבישים — רשות הדרכים (ROADAUTHORITY)',
  source_url = 'https://data.gov.il/dataset/roadauthority',
  updated_at = NOW()
WHERE name = 'roadauthority';

UPDATE public.data_sources SET
  display_name = 'ספירות תנועה — משרד התחבורה (vehicle_counts)',
  source_url = 'https://data.gov.il/he/datasets/ministry_of_transport/vehicle_counts',
  updated_at = NOW()
WHERE name = 'traffic_counts';

UPDATE public.data_sources SET
  display_name = 'תשתיות רכבת ישראל (rail_stat)',
  source_url = 'https://data.gov.il/he/datasets/ministry_of_transport/rail_stat',
  updated_at = NOW()
WHERE name = 'railway';

UPDATE public.data_sources SET
  display_name = 'הרכבת הקלה (lrt_stat)',
  source_url = 'https://data.gov.il/he/datasets/ministry_of_transport/lrt_stat',
  updated_at = NOW()
WHERE name = 'lrt';
