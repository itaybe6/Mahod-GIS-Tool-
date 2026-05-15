import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import type { LatLngTuple } from '@/types/common';

export type RailwayStationStatus = 'operational' | 'under_construction' | 'planned';
export type MetroStationStatus = RailwayStationStatus;

/** Display-ready railway station, geometry already in Leaflet `[lat, lng]` order. */
export interface RailwayStation {
  stationId: number;
  name: string;
  status: RailwayStationStatus;
  isActive: boolean;
  /** `[lat, lng]` — Leaflet order. Use `toMapboxLngLat` for Mapbox GL. */
  position: LatLngTuple;
}

/** Display-ready metro/LRT station, geometry already in Leaflet `[lat, lng]` order. */
export interface MetroStation {
  stationId: string;
  name: string;
  status: MetroStationStatus;
  /** `[lat, lng]` — Leaflet order. Use `toMapboxLngLat` for Mapbox GL. */
  position: LatLngTuple;
}

const QUERY_KEY = ['infra', 'railway-stations'] as const;
const METRO_QUERY_KEY = ['infra', 'metro-stations'] as const;

async function fetchRailwayStations(): Promise<RailwayStation[]> {
  // Calls the SECURITY DEFINER RPC so we don't have to decode EWKB hex on the client.
  const { data, error } = await supabase.rpc('list_railway_stations');
  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    stationId: row.station_id,
    name: row.station_name,
    status: row.status,
    isActive: row.is_active,
    position: [row.lat, row.lon],
  }));
}

async function fetchMetroStations(): Promise<MetroStation[]> {
  // Calls SECURITY DEFINER RPC so we don't decode EWKB hex on the client.
  const { data, error } = await supabase.rpc('list_metro_stations');
  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    stationId: row.station_id,
    name: row.station_name,
    status: row.status,
    position: [row.lat, row.lon],
  }));
}

/**
 * כל תחנות הרכבת הכבדה (~110 רשומות) — נתון בסיס שלא משתנה לעיתים קרובות,
 * אז staleTime ארוך. כשאין Supabase מוגדר ה-query מושבת והקליינט נופל ל-fallback.
 */
export function useRailwayStations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRailwayStations,
    enabled: isSupabaseConfigured,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
  });
}

/** כל תחנות המטרו/רק"ל שנמצאות בטבלת infra_metro_stations. */
export function useMetroStations() {
  return useQuery({
    queryKey: METRO_QUERY_KEY,
    queryFn: fetchMetroStations,
    enabled: isSupabaseConfigured,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
  });
}
