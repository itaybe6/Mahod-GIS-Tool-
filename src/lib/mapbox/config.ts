/**
 * Mapbox GL JS configuration: access token, style URL, and 3D defaults.
 *
 * The token is read from `VITE_MAPBOX_ACCESS_TOKEN` (public, scope it via URL
 * restrictions in your Mapbox account). When missing, `Mapbox3DView` renders a
 * fallback panel instead of attempting to initialise the map.
 */

/** Public token; restrict by URL in the Mapbox dashboard. `undefined` ⇒ fallback UI. */
export const MAPBOX_ACCESS_TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

/**
 * Default 3D style. We use Mapbox Standard because it ships with built-in 3D
 * buildings, lighting, and terrain — no extra layer wiring required.
 */
export const MAPBOX_STYLE_URL: string =
  import.meta.env.VITE_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/standard';

/** Initial camera tuned for a flyover feel over the Gush Dan region. */
export const MAPBOX_3D_DEFAULTS = {
  /** `[lng, lat]` (Mapbox convention). */
  center: [34.7818, 32.0853] as [number, number],
  zoom: 14,
  pitch: 60,
  bearing: -17.6,
  minZoom: 6,
  maxZoom: 20,
} as const;

/** Official Mapbox RTL plugin (required for correct Hebrew/Arabic glyph order). */
export const MAPBOX_RTL_PLUGIN_URL =
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js';
