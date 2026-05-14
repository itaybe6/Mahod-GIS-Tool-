import { create } from 'zustand';
import type { Database } from '@/lib/supabase/types';

export type RoutePlannerEndpointKind = 'origin' | 'destination';

/** Endpoint resolved either via geocoding (label) or by clicking the map (label optional). */
export interface RoutePlannerEndpoint {
  lat: number;
  lng: number;
  /** Display label — Mapbox `place_name` when geocoded, lat/lng string when picked from map. */
  label: string;
}

/** Full payload as returned by the `plan_transit_route` PostgREST RPC. */
export type RoutePlanResult =
  Database['public']['Functions']['plan_transit_route']['Returns'];

/** Single option inside `result.options`. */
export type RoutePlanOption = RoutePlanResult['options'][number];

export type RoutePlannerStatus = 'idle' | 'running' | 'ready' | 'error';

interface RoutePlannerState {
  origin: RoutePlannerEndpoint | null;
  destination: RoutePlannerEndpoint | null;

  /**
   * When set, the next click on the route-planner map sets that endpoint and
   * the picker is cleared. `null` means clicks are ignored.
   */
  pickingMode: RoutePlannerEndpointKind | null;

  /** Max walking distance allowed (origin→stop and stop→destination). */
  maxWalkMeters: number;

  status: RoutePlannerStatus;
  results: RoutePlanResult | null;
  error: string | null;

  /**
   * `route_id-direction_id` of the highlighted option (drawn thick on map).
   * Defaults to the first option when results arrive.
   */
  selectedOptionId: string | null;

  /** Wall-clock RPC time in ms (helpful debug info shown next to results). */
  durationMs: number | null;

  setOrigin: (endpoint: RoutePlannerEndpoint | null) => void;
  setDestination: (endpoint: RoutePlannerEndpoint | null) => void;
  swapEndpoints: () => void;
  setPickingMode: (mode: RoutePlannerEndpointKind | null) => void;
  setMaxWalkMeters: (meters: number) => void;
  beginRun: () => void;
  setResults: (results: RoutePlanResult, durationMs: number) => void;
  setError: (error: string) => void;
  selectOption: (optionId: string | null) => void;
  clear: () => void;
}

const DEFAULT_MAX_WALK_METERS = 800;

export function optionId(option: { route_id: number; direction_id: number }): string {
  return `${option.route_id}-${option.direction_id}`;
}

export const useRoutePlannerStore = create<RoutePlannerState>((set, get) => ({
  origin: null,
  destination: null,
  pickingMode: null,
  maxWalkMeters: DEFAULT_MAX_WALK_METERS,
  status: 'idle',
  results: null,
  error: null,
  selectedOptionId: null,
  durationMs: null,

  setOrigin: (origin) => set({ origin, pickingMode: null }),
  setDestination: (destination) => set({ destination, pickingMode: null }),
  swapEndpoints: () =>
    set({
      origin: get().destination,
      destination: get().origin,
      results: null,
      status: 'idle',
      selectedOptionId: null,
      error: null,
    }),
  setPickingMode: (mode) => set({ pickingMode: mode }),
  setMaxWalkMeters: (meters) => set({ maxWalkMeters: meters }),
  beginRun: () => set({ status: 'running', error: null, results: null }),
  setResults: (results, durationMs) => {
    const first = results.options[0];
    set({
      status: 'ready',
      results,
      error: null,
      durationMs,
      selectedOptionId: first ? optionId(first) : null,
    });
  },
  setError: (error) => set({ status: 'error', error }),
  selectOption: (selectedOptionId) => set({ selectedOptionId }),
  clear: () =>
    set({
      origin: null,
      destination: null,
      pickingMode: null,
      status: 'idle',
      results: null,
      error: null,
      selectedOptionId: null,
      durationMs: null,
    }),
}));

export function hasBothEndpoints(state: {
  origin: RoutePlannerEndpoint | null;
  destination: RoutePlannerEndpoint | null;
}): boolean {
  return state.origin != null && state.destination != null;
}
