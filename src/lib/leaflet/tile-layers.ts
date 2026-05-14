import type { LeafletMapType } from '@/constants/mapConfig';

export interface TileLayerConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

/**
 * Map tile providers used by the 4 base-map switcher.
 * Keep this list in sync with `LEAFLET_MAP_TYPES` in `constants/mapConfig.ts`.
 */
export const TILE_LAYERS: Record<LeafletMapType, TileLayerConfig> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap, © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    maxZoom: 19,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
    maxZoom: 17,
  },
};
