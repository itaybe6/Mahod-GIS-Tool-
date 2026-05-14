# Supabase — placeholder

This folder is intentionally minimal in the current iteration.

## Why is it empty?

Tables will be added **after** we explore the official data sources we plan to
ingest, so that the schema is shaped by real data rather than a guess.

## Upcoming data sources

| Domain         | Source                                                              | Notes                                                                  |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Public transit | `israel-public-transportation.zip` (GTFS)                           | agencies, routes, trips, stops, stop_times, calendar, shapes           |
| Road accidents | data.gov.il (LMS dataset)                                           | accidents, casualties, vehicles, road geometry attributes              |
| Roads          | Netivei Israel / OSM roads layer                                    | segments, classification, speed limit, kilometer markers               |
| Infrastructure | Israel Rail / NTA / Netivei Israel asset inventories (4th layer)    | bridges, tunnels, substations, train stations, depots                  |

## Next steps (do **not** start yet)

1. Decide between Supabase Postgres + PostGIS vs storage + edge functions for raw GTFS files.
2. Author schema migrations in `supabase/migrations/`.
3. Re-generate `generated.ts` via:

   ```bash
   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/generated.ts
   ```

4. Replace the empty `Database` type in `types.ts` with the generated one (or re-export it from `generated.ts`).

Until then, `client.ts` exports an unconfigured client that will short-circuit on missing env vars — components should guard with `isSupabaseConfigured` before querying.
