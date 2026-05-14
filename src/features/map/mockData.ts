/**
 * Mock GIS data for the map view.
 *
 * Tuples are stored as `[lat, lng]` (matching Leaflet's expected order). Use
 * `toMapboxLngLat` when feeding Mapbox GL, which expects `[lng, lat]`.
 *
 * Replace accidents / roads / infra with Supabase queries when wired in.
 * Transit stop markers use `gtfs_stops` when `VITE_SUPABASE_*` is set (see `useGtfsStops`).
 */

import type { LatLngTuple } from '@/types/common';

export interface AccidentPoint {
  /** `[lat, lng]` */
  position: LatLngTuple;
  name: string;
  count: number;
}

export interface TransitStop {
  /** `[lat, lng]` */
  position: LatLngTuple;
  name: string;
  type: string;
  /** מזהה מתוך `gtfs_stops` כשהנקודה נטענת מ-Supabase */
  stopId?: number;
  stopCode?: number | null;
  zoneId?: string | null;
}

export interface InfrastructurePoint {
  /** `[lat, lng]` */
  position: LatLngTuple;
  name: string;
}

export interface RoadSegment {
  name: string;
  /** Each coord is `[lat, lng]` */
  coords: LatLngTuple[];
}

export interface TransitRoute {
  name: string;
  color: string;
  /** Each coord is `[lat, lng]` */
  coords: LatLngTuple[];
}

export const ACCIDENTS: AccidentPoint[] = [
  { position: [32.0707, 34.7766], name: 'צומת הרצל / אלנבי', count: 12 },
  { position: [32.0879, 34.7818], name: 'כיכר רבין', count: 8 },
  { position: [32.064, 34.771], name: 'פלורנטין', count: 6 },
  { position: [32.1067, 34.8083], name: 'רמת גן — דרך אבא הלל', count: 11 },
  { position: [32.0501, 34.7547], name: 'יפו — שדרות ירושלים', count: 9 },
  { position: [32.1133, 34.8556], name: 'בני ברק — ז׳בוטינסקי', count: 7 },
  { position: [32.0823, 34.7951], name: 'אבן גבירול / ארלוזורוב', count: 14 },
  { position: [32.1547, 34.8388], name: 'פתח תקווה — סנטר', count: 5 },
  { position: [32.0454, 34.8233], name: 'חולון — דרך משה דיין', count: 8 },
];

export const TRANSIT_STOPS: TransitStop[] = [
  { position: [32.0853, 34.7818], name: 'סבידור מרכז', type: 'רכבת' },
  { position: [32.0719, 34.7916], name: 'תחנת ארלוזורוב', type: 'אוטובוס' },
  { position: [32.0639, 34.7639], name: 'תחנת המפרץ', type: 'אוטובוס' },
  { position: [32.1003, 34.8253], name: 'תחנת השלום', type: 'רכבת קלה' },
  { position: [32.0567, 34.7626], name: 'תחנת מרכזית חדשה', type: 'אוטובוס' },
  { position: [32.0922, 34.7702], name: 'כיכר המדינה', type: 'אוטובוס' },
];

export const INFRA_POINTS: InfrastructurePoint[] = [
  { position: [32.0995, 34.7794], name: 'גשר מעריב' },
  { position: [32.0531, 34.761], name: 'מנהרת מנשה' },
  { position: [32.083, 34.805], name: 'תחמ״ש איילון' },
];

export const ROADS: RoadSegment[] = [
  {
    name: 'כביש איילון',
    coords: [
      [32.135, 34.825],
      [32.115, 34.815],
      [32.085, 34.795],
      [32.055, 34.775],
      [32.025, 34.755],
    ],
  },
  {
    name: 'ז׳בוטינסקי',
    coords: [
      [32.09, 34.87],
      [32.09, 34.84],
      [32.087, 34.81],
      [32.085, 34.79],
    ],
  },
  {
    name: 'דרך נמיר',
    coords: [
      [32.115, 34.795],
      [32.095, 34.789],
      [32.078, 34.781],
    ],
  },
];

export const ROUTES: TransitRoute[] = [
  {
    name: 'קו 5',
    color: '#10b981',
    coords: [
      [32.11, 34.84],
      [32.095, 34.82],
      [32.082, 34.795],
      [32.068, 34.778],
      [32.05, 34.762],
    ],
  },
  {
    name: 'קו 142',
    color: '#81c784',
    coords: [
      [32.13, 34.81],
      [32.105, 34.8],
      [32.085, 34.79],
      [32.065, 34.78],
      [32.045, 34.77],
    ],
  },
  {
    name: 'הרכבת הקלה — אדום',
    color: '#ef4444',
    coords: [
      [32.155, 34.84],
      [32.115, 34.825],
      [32.09, 34.808],
      [32.075, 34.79],
      [32.05, 34.755],
    ],
  },
];

/** Convert a Leaflet `[lat, lng]` tuple to Mapbox `[lng, lat]`. */
export function toMapboxLngLat([lat, lng]: LatLngTuple): [number, number] {
  return [lng, lat];
}
