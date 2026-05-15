-- Official portal page for CBS TAZ accident aggregates (accid_taz) used by public.accidents

UPDATE public.data_sources
SET
  display_name = 'תאונות דרכים — אגרגציית TAZ (accid_taz)',
  source_url = 'https://data.gov.il/he/datasets/ministry_of_transport/accid_taz',
  metadata = COALESCE(metadata, '{}'::jsonb)
    || '{"format":"accid_taz_csv","model":"taz_aggregate","portal_slug":"ministry_of_transport/accid_taz"}'::jsonb,
  updated_at = NOW()
WHERE name = 'accidents';
