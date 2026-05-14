import { create } from 'zustand';
import type { MapType } from '@/constants/mapConfig';
import type { LayerKey } from '@/types/common';

interface MapState {
  mapType: MapType;
  activeLayers: Record<LayerKey, boolean>;
  /** Active tab in the map top-bar (controls which domain is "spotlighted"). */
  activeDomain: LayerKey;

  setMapType: (type: MapType) => void;
  toggleLayer: (layer: LayerKey) => void;
  setLayer: (layer: LayerKey, enabled: boolean) => void;
  setActiveDomain: (domain: LayerKey) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mapType: 'dark',
  activeLayers: {
    transit: true,
    accidents: true,
    roads: false,
    infrastructure: true,
  },
  activeDomain: 'transit',

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
}));
