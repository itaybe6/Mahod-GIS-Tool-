-- Remove unused columns from gtfs_agency (aligned with GTFS usage in app).
ALTER TABLE public.gtfs_agency
  DROP COLUMN IF EXISTS agency_fare_url,
  DROP COLUMN IF EXISTS source_version;
