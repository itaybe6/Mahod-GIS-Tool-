import { create } from 'zustand';
import type { MapType } from '@/constants/mapConfig';
import type { LayerKey } from '@/types/common';

/** Drives one-shot fly / fit from toolbar geocode (Leaflet + Mapbox GL). */
export interface MapFocusRequest {
  seq: number;
  lat: number;
  lng: number;
  zoom?: number;
  /** Mapbox order: minLng, minLat, maxLng, maxLat — when set, prefer fitBounds. */
  bbox?: [number, number, number, number];
}

/** Survives Leaflet consuming `focusRequest` so 3D can restore camera after mode switch. */
export interface LastGeocodeCamera {
  lat: number;
  lng: number;
  zoom: number;
  bbox?: [number, number, number, number];
}

interface MapState {
  mapType: MapType;
  activeLayers: Record<LayerKey, boolean>;
  /** Active tab in the map top-bar (controls which domain is "spotlighted"). */
  activeDomain: LayerKey;
  /** Latest geocode focus; cleared by map views after applying. */
  focusRequest: MapFocusRequest | null;
  /** Last successful geocode camera — reapplied when entering Mapbox GL if no upload bbox. */
  lastGeocodeCamera: LastGeocodeCamera | null;

  setMapType: (type: MapType) => void;
  toggleLayer: (layer: LayerKey) => void;
  setLayer: (layer: LayerKey, enabled: boolean) => void;
  setActiveDomain: (domain: LayerKey) => void;
  requestMapFocus: (
    lat: number,
    lng: number,
    zoom?: number,
    bbox?: [number, number, number, number]
  ) => void;
  clearMapFocusRequest: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  mapType: 'dark',
  activeLayers: {
    transit: true,
    accidents: true,
    roads: false,
    infrastructure: true,
    traffic: true,
  },
  activeDomain: 'transit',
  focusRequest: null,
  lastGeocodeCamera: null,

  setMapType: (type) => set({ mapType: type }),
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: { ...state.activeLayers, [layer]: !state.activeLayers[layer] },
    })),
  setLayer: (layer, enabled) =>
    set((state) => ({
      activeLayers: { ...state.activeLayers, [layer]: enabled },
    })),
  setActiveDomain: (domain) => set({ activeDomain: domain }),
  requestMapFocus: (lat, lng, zoom, bbox) =>
    set(() => {
      const resolvedZoom = zoom ?? 15;
      const focusRequest: MapFocusRequest = { seq: Date.now(), lat, lng };
      if (zoom !== undefined) focusRequest.zoom = zoom;
      if (bbox !== undefined) focusRequest.bbox = bbox;

      const lastGeocodeCamera: LastGeocodeCamera = { lat, lng, zoom: resolvedZoom };
      if (bbox !== undefined) lastGeocodeCamera.bbox = bbox;

      return { focusRequest, lastGeocodeCamera };
    }),
  clearMapFocusRequest: () => set({ focusRequest: null }),
}));
