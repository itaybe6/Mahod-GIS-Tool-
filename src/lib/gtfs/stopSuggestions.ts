import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { GeocodeFeatureNormalized } from '@/lib/mapbox/geocoding';

const MAX_LEN = 80;

/** Strip LIKE wildcards so user input cannot broaden the pattern. */
function escapeForIlikeFragment(raw: string): string {
  return raw.trim().slice(0, MAX_LEN).replace(/[%_\\]/g, ' ');
}

/**
 * GTFS stop name search for autocomplete (Hebrew names, e.g. "ת. רכבת …").
 * Mapbox Geocoding v5 no longer reliably returns POIs such as rail stations;
 * this fills the gap using `gtfs_stops` already in Supabase.
 */
export async function fetchGtfsStopSuggestions(
  query: string,
  limit = 8
): Promise<GeocodeFeatureNormalized[]> {
  if (!isSupabaseConfigured) return [];
  const frag = escapeForIlikeFragment(query);
  if (frag.length < 2) return [];

  const pattern = `%${frag}%`;

  const byName = supabase
    .from('gtfs_stops')
    .select('stop_id, stop_name, stop_lat, stop_lon')
    .not('stop_lat', 'is', null)
    .not('stop_lon', 'is', null)
    .ilike('stop_name', pattern)
    .order('stop_name', { ascending: true })
    .limit(limit);

  const numeric = Number(frag.replace(/\s/g, ''));
  const byCode =
    Number.isInteger(numeric) && numeric > 0 && String(numeric).length <= 6
      ? supabase
          .from('gtfs_stops')
          .select('stop_id, stop_name, stop_lat, stop_lon')
          .not('stop_lat', 'is', null)
          .not('stop_lon', 'is', null)
          .eq('stop_code', numeric)
          .limit(4)
      : Promise.resolve({ data: [] as const, error: null });

  const [{ data: nameRows, error: nameErr }, { data: codeRows, error: codeErr }] =
    await Promise.all([byName, byCode]);

  if (nameErr || codeErr) return [];

  const rows = [...(codeRows ?? []), ...(nameRows ?? [])];
  const dedup = new Map<number, (typeof rows)[0]>();
  for (const row of rows) {
    if (row.stop_id != null) dedup.set(row.stop_id, row);
  }

  const out: GeocodeFeatureNormalized[] = [];
  for (const row of dedup.values()) {
    const lat = row.stop_lat;
    const lng = row.stop_lon;
    const name = row.stop_name;
    const id = row.stop_id;
    if (lat == null || lng == null || typeof name !== 'string') continue;
    out.push({
      id: `gtfs-stop-${id}`,
      text: name,
      place_name: `${name} — תחנת תח״צ`,
      place_type: ['poi'],
      center: [lng, lat],
    });
    if (out.length >= limit) break;
  }
  return out;
}
