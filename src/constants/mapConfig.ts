import type { LatLngTuple } from 'leaflet';

/**
 * Default map configuration centered on Tel Aviv / Gush Dan.
 */

export const DEFAULT_MAP_CENTER: LatLngTuple = [32.0853, 34.7818];
export const DEFAULT_MAP_ZOOM = 12;
export const MIN_MAP_ZOOM = 6;
export const MAX_MAP_ZOOM = 19;

/** Raster base maps (Leaflet `TileLayer`). */
export const LEAFLET_MAP_TYPES = ['dark', 'osm', 'sat', 'topo'] as const;
export type LeafletMapType = (typeof LEAFLET_MAP_TYPES)[number];

/** All entries in the top-bar map switcher (Leaflet tiles + Mapbox GL 3D). */
export const MAP_TYPES = [...LEAFLET_MAP_TYPES, 'mapbox3d'] as const;
export type MapType = (typeof MAP_TYPES)[number];

export const MAP_TYPE_LABELS: Record<MapType, string> = {
  dark: 'DARK',
  osm: 'OSM',
  sat: 'SAT',
  topo: 'TOPO',
  mapbox3d: '3D',
};

export const MAP_TYPE_HEBREW_LABELS: Record<MapType, string> = {
  dark: 'כהה',
  osm: 'OpenStreetMap',
  sat: 'לוויין',
  topo: 'טופוגרפי',
  mapbox3d: 'Mapbox תלת־מימד',
};
