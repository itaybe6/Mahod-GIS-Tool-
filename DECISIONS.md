# Statistics Page Decisions

- The repository is a Vite + React Router app, not a Next.js App Router app. I implemented the requested `/statistics` experience in the existing architecture instead of adding a parallel `app/` tree.
- Data fetching runs client-side through the existing Supabase browser client and React Query. Heavy statistics are still computed in SQL views/RPC, not in JavaScript.
- `recharts` and `@tanstack/react-table` were added because they were requested but were not present in `package.json`.
- The `accidents` table stores one row per statistical area, so labels and copy avoid implying one row equals one accident event.
- Spatial clustering is lazy-loaded and returns no rows until `accidents.geom` is populated; the UI shows the requested Hebrew notice in that case.
- The motorcycle insight cannot directly attribute motorcycle involvement to severe injuries from the available aggregate columns, so it compares motorcycle share of known vehicles with severe-injury share of total injuries.
- The SQL migrations use the requested filenames and grant public read/execute access consistent with existing anon/authenticated select patterns.
