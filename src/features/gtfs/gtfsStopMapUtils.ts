import type { FeatureCollection, Point } from 'geojson';

import type { TransitStop } from '@/features/map/mockData';
import { toMapboxLngLat } from '@/features/map/mockData';
import type { Database } from '@/lib/supabase/types';
import type { LatLngTuple } from '@/types/common';

export type GtfsStopRow = Database['public']['Tables']['gtfs_stops']['Row'];

/** GTFS `location_type` → תווית קצרה בעברית */
export function gtfsLocationTypeHebrew(locationType: number | null): string {
  switch (locationType) {
    case 0:
      return 'תחנה / עצירה';
    case 1:
      return 'תחנת אם';
    case 2:
      return 'כניסה / יציאה';
    case 3:
      return 'צומת';
    case 4:
      return 'אזור עלייה';
    default:
      if (locationType == null) return 'תחנה';
      return `סוג ${locationType}`;
  }
}

export function gtfsStopRowsToTransitStops(rows: GtfsStopRow[]): TransitStop[] {
  const out: TransitStop[] = [];
  for (const r of rows) {
    if (r.stop_lat == null || r.stop_lon == null) continue;
    const position: LatLngTuple = [r.stop_lat, r.stop_lon];
    out.push({
      position,
      name: r.stop_name,
      type: gtfsLocationTypeHebrew(r.location_type),
      stopId: r.stop_id,
      stopCode: r.stop_code,
      zoneId: r.zone_id,
    });
  }
  return out;
}

export function transitStopsToGeoJSON(
  stops: TransitStop[]
): FeatureCollection<
  Point,
  { name: string; type: string; stop_id?: number; stop_code?: number | null; zone_id?: string | null }
> {
  return {
    type: 'FeatureCollection',
    features: stops.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toMapboxLngLat(s.position) },
      properties: {
        name: s.name,
        type: s.type,
        ...(s.stopId != null ? { stop_id: s.stopId } : {}),
        ...(s.stopCode != null ? { stop_code: s.stopCode } : {}),
        ...(s.zoneId != null && s.zoneId !== '' ? { zone_id: s.zoneId } : {}),
      },
    })),
  };
}
