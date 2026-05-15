import { create } from 'zustand';
import type { MapType } from '@/constants/mapConfig';
import type { LayerKey, MapDomainTab } from '@/types/common';
import { useUploadStore } from '@/stores/uploadStore';

const ALL_LAYER_KEYS: LayerKey[] = ['transit', 'accidents', 'roads', 'infrastructure', 'traffic'];

/** Exactly one domain visible — driven by the dashboard top tab strip. */
function exclusiveActiveLayers(domain: LayerKey): Record<LayerKey, boolean> {
  return Object.fromEntries(ALL_LAYER_KEYS.map((k) => [k, k === domain])) as Record<
    LayerKey,
    boolean
  >;
}

function allLayersEnabled(): Record<LayerKey, boolean> {
  return Object.fromEntries(ALL_LAYER_KEYS.map((k) => [k, true])) as Record<LayerKey, boolean>;
}

export interface FocusAnalysisFeature {
  layerKey: LayerKey;
  featureIndex: number;
}

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
  /** Active tab in the map top-bar (`all` = every layer on the map). */
  activeDomain: MapDomainTab;
  /** Latest geocode focus; cleared by map views after applying. */
  focusRequest: MapFocusRequest | null;
  /** Last successful geocode camera — reapplied when entering Mapbox GL if no upload bbox. */
  lastGeocodeCamera: LastGeocodeCamera | null;
  /** When set, AnalysisResultsLayer flies to this feature and opens its popup. */
  focusAnalysisFeature: FocusAnalysisFeature | null;

  setMapType: (type: MapType) => void;
  toggleLayer: (layer: LayerKey) => void;
  setLayer: (layer: LayerKey, enabled: boolean) => void;
  setActiveDomain: (domain: MapDomainTab) => void;
  requestMapFocus: (
    lat: number,
    lng: number,
    zoom?: number,
    bbox?: [number, number, number, number]
  ) => void;
  clearMapFocusRequest: () => void;
  setFocusAnalysisFeature: (v: FocusAnalysisFeature) => void;
  clearFocusAnalysisFeature: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  mapType: 'mapbox3d',
  activeLayers: allLayersEnabled(),
  activeDomain: 'all',
  focusRequest: null,
  lastGeocodeCamera: null,
  focusAnalysisFeature: null,

  setMapType: (type) => {
    if (type === 'mapbox3d') {
      const { inputMode, setInputMode, setDrawingPhase } = useUploadStore.getState();
      if (inputMode === 'draw') {
        setInputMode('upload');
        setDrawingPhase('idle');
      }
    }
    set({ mapType: type });
  },
  toggleLayer: (layer) =>
    set((state) => ({
      activeLayers: { ...state.activeLayers, [layer]: !state.activeLayers[layer] },
    })),
  setLayer: (layer, enabled) =>
    set((state) => ({
      activeLayers: { ...state.activeLayers, [layer]: enabled },
    })),
  setActiveDomain: (domain) =>
    set({
      activeDomain: domain,
      activeLayers: domain === 'all' ? allLayersEnabled() : exclusiveActiveLayers(domain),
    }),
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
  setFocusAnalysisFeature: (v) => set({ focusAnalysisFeature: v }),
  clearFocusAnalysisFeature: () => set({ focusAnalysisFeature: null }),
}));
