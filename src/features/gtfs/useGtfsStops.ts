import { useQuery } from '@tanstack/react-query';

import type { GtfsStopRow } from '@/features/gtfs/gtfsStopMapUtils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const PAGE = 1000;
/**
 * Hard cap on how many stops we'll page in for a single bbox. The Leaflet
 * marker layer becomes unresponsive somewhere around 5–10k DOM nodes, so we
 * stop well below that and surface a console warning if the bbox is too
 * coarse — the right fix in that case is to upload a tighter polygon.
 */
const MAX_STOPS_PER_BBOX = 8000;

/** `[minLng, minLat, maxLng, maxLat]` — same shape as `useUploadStore.bbox`. */
export type StopsBbox = readonly [number, number, number, number];

async function fetchStopsInBbox(bbox: StopsBbox): Promise<GtfsStopRow[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const all: GtfsStopRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('gtfs_stops')
      .select(
        'stop_id, stop_code, stop_name, stop_lat, stop_lon, location_type, stop_desc, zone_id'
      )
      .not('stop_lat', 'is', null)
      .not('stop_lon', 'is', null)
      .gte('stop_lat', minLat)
      .lte('stop_lat', maxLat)
      .gte('stop_lon', minLng)
      .lte('stop_lon', maxLng)
      .order('stop_id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as GtfsStopRow[]));
    if (data.length < PAGE) break;
    from += PAGE;

    if (all.length >= MAX_STOPS_PER_BBOX) {
      console.warn(
        `[useGtfsStops] reached ${MAX_STOPS_PER_BBOX} stops in bbox — truncating to keep the map responsive. ` +
          'Upload a tighter polygon to load more.'
      );
      break;
    }
  }

  return all;
}

/**
 * תחנות GTFS שנמצאות בתוך ה-bbox של הפוליגון שהמשתמש העלה.
 *
 * חשוב: עד שהמשתמש מעלה פוליגון השאילתה מושבתת לחלוטין — אחרת היינו
 * שואבים את כל ~30K התחנות בארץ ומציירים כל אחת כ-Marker, מה שגורם
 * לדפדפן להיתקע אחרי כמה שניות.
 */
export function useGtfsStops(bbox: StopsBbox | null | undefined) {
  return useQuery({
    queryKey: ['gtfs-stops', 'map', bbox ?? null],
    queryFn: () => fetchStopsInBbox(bbox as StopsBbox),
    enabled: isSupabaseConfigured && bbox != null,
    staleTime: 1000 * 60 * 30,
  });
}
