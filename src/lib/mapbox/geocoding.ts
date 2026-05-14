/**
 * Mapbox Geocoding API v5 (mapbox.places) — forward autocomplete and reverse.
 * @see https://docs.mapbox.com/api/search/geocoding/
 */

import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox/config';

/** Rough bounding box for Israel / Palestine area (minLng, minLat, maxLng, maxLat). */
export const ISRAEL_REGION_BBOX: readonly [number, number, number, number] = [
  34.22, 29.48, 35.92, 33.35,
];

/** Default camera bias (Gush Dan): lng, lat. */
export const DEFAULT_PROXIMITY: readonly [number, number] = [34.7818, 32.0853];

export interface GeocodeContextItem {
  id: string;
  text: string;
  short_code?: string;
}

/** Normalized feature for app UI and map focus. */
export interface GeocodeFeatureNormalized {
  id: string;
  text: string;
  place_name: string;
  place_type: string[];
  /** Always `[lng, lat]` (Mapbox order). */
  center: [number, number];
  bbox?: [number, number, number, number];
  context?: GeocodeContextItem[];
  address?: string;
}

interface RawGeocodeFeature {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];
  bbox?: [number, number, number, number];
  address?: string;
  context?: unknown;
}

interface RawGeocodeResponse {
  features?: RawGeocodeFeature[];
}

function parseContext(raw: unknown): GeocodeContextItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GeocodeContextItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = o.id;
    const text = o.text;
    if (typeof id !== 'string' || typeof text !== 'string') continue;
    const short_code = o.short_code;
    out.push({
      id,
      text,
      ...(typeof short_code === 'string' ? { short_code } : {}),
    });
  }
  return out.length ? out : undefined;
}

export function normalizeGeocodeFeature(f: RawGeocodeFeature): GeocodeFeatureNormalized | null {
  const id = f.id;
  const text = f.text;
  const place_name = f.place_name;
  const center = f.center;
  if (
    typeof id !== 'string' ||
    typeof text !== 'string' ||
    typeof place_name !== 'string' ||
    !Array.isArray(center) ||
    center.length < 2 ||
    typeof center[0] !== 'number' ||
    typeof center[1] !== 'number'
  ) {
    return null;
  }
  const place_type = Array.isArray(f.place_type)
    ? f.place_type.filter((t): t is string => typeof t === 'string')
    : [];
  let bbox: [number, number, number, number] | undefined;
  if (
    Array.isArray(f.bbox) &&
    f.bbox.length === 4 &&
    f.bbox.every((n) => typeof n === 'number')
  ) {
    bbox = f.bbox as [number, number, number, number];
  }
  const out: GeocodeFeatureNormalized = {
    id,
    text,
    place_name,
    place_type,
    center: [center[0], center[1]],
  };
  if (bbox !== undefined) out.bbox = bbox;
  const ctx = parseContext(f.context);
  if (ctx !== undefined) out.context = ctx;
  if (typeof f.address === 'string') out.address = f.address;
  return out;
}

export interface ForwardGeocodeParams {
  /** Already trimmed search string (will be encodeURIComponent’d in the path). */
  query: string;
  /** Comma-separated Mapbox `types`, e.g. `place,locality` or `address`. */
  types: string;
  accessToken?: string;
  limit?: number;
  language?: string;
  country?: string;
  bbox?: readonly [number, number, number, number] | null;
  proximity?: readonly [number, number] | null;
  fuzzyMatch?: boolean;
}

/**
 * Forward geocode with autocomplete. Returns normalized features or [] on failure.
 */
export async function fetchMapboxGeocodeAutocomplete(
  params: ForwardGeocodeParams
): Promise<GeocodeFeatureNormalized[]> {
  const token = params.accessToken ?? MAPBOX_ACCESS_TOKEN;
  if (!token || params.query.length < 1) return [];

  const limit = params.limit ?? 8;
  const language = params.language ?? 'he';
  const country = params.country ?? 'il';
  const fuzzyMatch = params.fuzzyMatch !== false;

  const path = encodeURIComponent(params.query);
  const sp = new URLSearchParams({
    access_token: token,
    autocomplete: 'true',
    language,
    country,
    limit: String(limit),
    types: params.types,
    fuzzyMatch: String(fuzzyMatch),
  });

  if (params.bbox && params.bbox.length === 4) {
    sp.set('bbox', params.bbox.join(','));
  }
  if (params.proximity && params.proximity.length === 2) {
    sp.set('proximity', `${params.proximity[0]},${params.proximity[1]}`);
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${sp.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as RawGeocodeResponse;
    const features = data.features ?? [];
    const normalized: GeocodeFeatureNormalized[] = [];
    for (const raw of features) {
      const n = normalizeGeocodeFeature(raw);
      if (n) normalized.push(n);
    }
    return normalized;
  } catch {
    return [];
  }
}

export interface ReverseGeocodeParams {
  lng: number;
  lat: number;
  accessToken?: string;
  limit?: number;
  types?: string;
  language?: string;
  country?: string;
}

/**
 * Reverse geocode coordinates → place features (Hebrew / Israel by default).
 */
export async function fetchMapboxReverseGeocode(
  params: ReverseGeocodeParams
): Promise<GeocodeFeatureNormalized[]> {
  const token = params.accessToken ?? MAPBOX_ACCESS_TOKEN;
  if (!token) return [];

  const limit = params.limit ?? 5;
  const language = params.language ?? 'he';
  const country = params.country ?? 'il';
  const types = params.types ?? 'address,place,locality,poi';

  const sp = new URLSearchParams({
    access_token: token,
    language,
    country,
    limit: String(limit),
    types,
  });

  const coordPath = `${params.lng},${params.lat}`;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordPath}.json?${sp.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as RawGeocodeResponse;
    const features = data.features ?? [];
    const normalized: GeocodeFeatureNormalized[] = [];
    for (const raw of features) {
      const n = normalizeGeocodeFeature(raw);
      if (n) normalized.push(n);
    }
    return normalized;
  } catch {
    return [];
  }
}
