# Data Sources

## GTFS Public Transportation

- Source: https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip
- Local shapes file: `public/gtfs/shapes.txt`
- Update cadence: monthly agent check, with hash comparison before seeding.
- Current version: derived from `GTFS_VERSION` when provided, otherwise the SHA-256 hash prefix of `shapes.txt`.
- Loaded table: `gtfs_shapes`, compressed to one LineString per `shape_id`.
