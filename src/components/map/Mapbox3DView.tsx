import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import 'mapbox-gl/dist/mapbox-gl.css';

import {
  MAPBOX_3D_DEFAULTS,
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_RTL_PLUGIN_URL,
  MAPBOX_STYLE_URL,
} from '@/lib/mapbox/config';
import { gtfsStopRowsToTransitStops, transitStopsToGeoJSON } from '@/features/gtfs/gtfsStopMapUtils';
import { useGtfsStops } from '@/features/gtfs/useGtfsStops';
import {
  ACCIDENTS,
  INFRA_POINTS,
  ROADS,
  ROUTES,
  TRANSIT_STOPS,
  toMapboxLngLat,
} from '@/features/map/mockData';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useMapStore, type LastGeocodeCamera } from '@/stores/mapStore';
import { useUploadStore } from '@/stores/uploadStore';

/* -------------------------------------------------------------------------- */
/*                              GeoJSON builders                              */
/* -------------------------------------------------------------------------- */

function buildAccidentsGeoJSON(): FeatureCollection<Point, { name: string; count: number }> {
  return {
    type: 'FeatureCollection',
    features: ACCIDENTS.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toMapboxLngLat(a.position) },
      properties: { name: a.name, count: a.count },
    })),
  };
}

function buildInfraGeoJSON(): FeatureCollection<Point, { name: string }> {
  return {
    type: 'FeatureCollection',
    features: INFRA_POINTS.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toMapboxLngLat(p.position) },
      properties: { name: p.name },
    })),
  };
}

function buildRoadsGeoJSON(): FeatureCollection<LineString, { name: string }> {
  return {
    type: 'FeatureCollection',
    features: ROADS.map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.coords.map(toMapboxLngLat) },
      properties: { name: r.name },
    })),
  };
}

function buildRoutesGeoJSON(): FeatureCollection<LineString, { name: string; color: string }> {
  return {
    type: 'FeatureCollection',
    features: ROUTES.map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.coords.map(toMapboxLngLat) },
      properties: { name: r.name, color: r.color },
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*                                RTL plugin                                  */
/* -------------------------------------------------------------------------- */

/**
 * `mapboxgl.setRTLTextPlugin` must be called exactly once per page lifetime.
 * Guard with a module-level flag because the component may mount/unmount.
 */
let rtlPluginRequested = false;

function ensureRTLPlugin(): void {
  if (rtlPluginRequested) return;
  rtlPluginRequested = true;
  try {
    mapboxgl.setRTLTextPlugin(
      MAPBOX_RTL_PLUGIN_URL,
      (err) => {
        if (err) console.warn('[mapbox] RTL plugin failed to load', err);
      },
      true
    );
  } catch (err) {
    console.warn('[mapbox] RTL plugin already set', err);
  }
}

/* -------------------------------------------------------------------------- */
/*                              Source / layer ids                            */
/* -------------------------------------------------------------------------- */

const SOURCES = {
  accidents: 'src-accidents',
  transit: 'src-transit-stops',
  routes: 'src-transit-routes',
  roads: 'src-roads',
  infra: 'src-infra',
  upload: 'src-upload-polygon',
} as const;

const LAYERS = {
  accidents: 'lyr-accidents',
  transit: 'lyr-transit-stops',
  routes: 'lyr-transit-routes',
  roads: 'lyr-roads',
  infra: 'lyr-infra',
  uploadFill: 'lyr-upload-fill',
  uploadExtrusion: 'lyr-upload-extrusion',
  uploadLine: 'lyr-upload-line',
} as const;

const EMPTY_GEOJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const MAPBOX_STANDARD_TOP_SLOT = 'top';
const UPLOAD_POLYGON_EXTRUSION_HEIGHT_METERS = 40;

/* -------------------------------------------------------------------------- */
/*                              Token-missing UI                              */
/* -------------------------------------------------------------------------- */

function TokenFallback(): JSX.Element {
  return (
    <div className="absolute inset-0 z-[500] grid place-items-center bg-[#050810] p-8 text-center">
      <div className="max-w-md rounded-md border border-border bg-bg-2/80 p-6 shadow-[0_10px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-text-dim">
          MAPBOX 3D
        </div>
        <div className="mb-3 text-[15px] font-medium text-text">
          חסר טוקן גישה ל־Mapbox
        </div>
        <p className="text-[13px] leading-relaxed text-text-faint">
          הגדירו את <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
            VITE_MAPBOX_ACCESS_TOKEN
          </code>{' '}
          בקובץ <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">.env</code>{' '}
          והפעילו מחדש את שרת הפיתוח כדי להציג את המפה בתלת־מימד.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export interface Mapbox3DViewProps {
  className?: string;
}

/**
 * 3D Mapbox GL view rendered side-by-side with Leaflet inside `MapView`.
 * Reads `activeLayers` from the map store and reactively toggles each layer's
 * visibility without rebuilding the map.
 */
export function Mapbox3DView({ className }: Mapbox3DViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const [glMapReady, setGlMapReady] = useState(false);

  const activeLayers = useMapStore((s) => s.activeLayers);
  const uploadedPolygon = useUploadStore((s) => s.polygon);
  const uploadedBbox = useUploadStore((s) => s.bbox);
  // טעינת תחנות נעשית רק עבור ה-bbox של הפוליגון שהועלה (אחרת המפה
  // מקבלת ~30K Markers ונתקעת).
  const { data: gtfsRows, isFetched: gtfsFetched } = useGtfsStops(uploadedBbox);

  /* ----------------------------- init map ----------------------------- */
  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || !containerRef.current) return;

    ensureRTLPlugin();
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE_URL,
      center: MAPBOX_3D_DEFAULTS.center,
      zoom: MAPBOX_3D_DEFAULTS.zoom,
      pitch: MAPBOX_3D_DEFAULTS.pitch,
      bearing: MAPBOX_3D_DEFAULTS.bearing,
      minZoom: MAPBOX_3D_DEFAULTS.minZoom,
      maxZoom: MAPBOX_3D_DEFAULTS.maxZoom,
      antialias: true,
      attributionControl: true,
      cooperativeGestures: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    mapRef.current = map;

    map.on('load', () => {
      loadedRef.current = true;

      const initialTransit = isSupabaseConfigured
        ? EMPTY_GEOJSON
        : transitStopsToGeoJSON(TRANSIT_STOPS);

      // Sources --------------------------------------------------------
      map.addSource(SOURCES.accidents, { type: 'geojson', data: buildAccidentsGeoJSON() });
      map.addSource(SOURCES.transit, { type: 'geojson', data: initialTransit });
      map.addSource(SOURCES.routes, { type: 'geojson', data: buildRoutesGeoJSON() });
      map.addSource(SOURCES.roads, { type: 'geojson', data: buildRoadsGeoJSON() });
      map.addSource(SOURCES.infra, { type: 'geojson', data: buildInfraGeoJSON() });
      map.addSource(SOURCES.upload, {
        type: 'geojson',
        data: useUploadStore.getState().polygon ?? EMPTY_GEOJSON,
      });

      // User-uploaded polygon — flat fill on the ground, plus a translucent
      // 3D extrusion so the shape is clearly visible at any pitch / camera
      // angle, plus a bright outline drawn on top of everything.
      // Layers are added with `slot: 'top'` so the Mapbox Standard imported
      // style places them above buildings & terrain shading; if the style
      // doesn't have a `top` slot Mapbox silently falls back to appending
      // them at the end (which is also "above everything").
      map.addLayer({
        id: LAYERS.uploadFill,
        type: 'fill',
        source: SOURCES.upload,
        slot: MAPBOX_STANDARD_TOP_SLOT,
        paint: {
          'fill-color': '#4cc9c0',
          'fill-opacity': 0.22,
          'fill-emissive-strength': 0.9,
        },
      });
      map.addLayer({
        id: LAYERS.uploadExtrusion,
        type: 'fill-extrusion',
        source: SOURCES.upload,
        slot: MAPBOX_STANDARD_TOP_SLOT,
        paint: {
          'fill-extrusion-color': '#4cc9c0',
          'fill-extrusion-opacity': 0.35,
          'fill-extrusion-base': 0,
          'fill-extrusion-height': UPLOAD_POLYGON_EXTRUSION_HEIGHT_METERS,
          'fill-extrusion-emissive-strength': 1,
        },
      });
      map.addLayer({
        id: LAYERS.uploadLine,
        type: 'line',
        source: SOURCES.upload,
        slot: MAPBOX_STANDARD_TOP_SLOT,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#4cc9c0',
          'line-width': 4,
          'line-opacity': 1,
          'line-emissive-strength': 1,
        },
      });

      // Transit routes (line) ------------------------------------------
      map.addLayer({
        id: LAYERS.routes,
        type: 'line',
        source: SOURCES.routes,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [2, 1.2],
        },
      });

      // Roads (line) ---------------------------------------------------
      map.addLayer({
        id: LAYERS.roads,
        type: 'line',
        source: SOURCES.roads,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 3.5,
          'line-opacity': 0.8,
        },
      });

      // Accidents (red circles, sized by count) ------------------------
      map.addLayer({
        id: LAYERS.accidents,
        type: 'circle',
        source: SOURCES.accidents,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            5,
            6,
            15,
            14,
          ],
          'circle-color': '#ef4444',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.75)',
        },
      });

      // Transit stops (emerald) ----------------------------------------
      map.addLayer({
        id: LAYERS.transit,
        type: 'circle',
        source: SOURCES.transit,
        paint: {
          'circle-radius': 7,
          'circle-color': '#10b981',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(5,8,16,0.75)',
          'circle-emissive-strength': 0.9,
        },
      });

      // Infrastructure (purple) ----------------------------------------
      map.addLayer({
        id: LAYERS.infra,
        type: 'circle',
        source: SOURCES.infra,
        paint: {
          'circle-radius': 7,
          'circle-color': '#a855f7',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.75)',
        },
      });

      // Apply current visibility state immediately
      applyVisibility(map, useMapStore.getState().activeLayers);

      // Popups ---------------------------------------------------------
      attachPopup(map, LAYERS.accidents, (props) =>
        `<strong>${escapeHtml(String(props.name))}</strong><br/>תאונות: ${escapeHtml(
          String(props.count)
        )}<br/>חומרה: גבוהה`
      );
      attachPopup(map, LAYERS.transit, (props) => {
        const name = escapeHtml(stringifyProperty(props.name));
        const typ = escapeHtml(stringifyProperty(props.type));
        const sid =
          props.stop_id != null
            ? `<br/>מזהה תחנה: ${escapeHtml(stringifyProperty(props.stop_id))}`
            : '';
        const code =
          props.stop_code != null
            ? `<br/>קוד: ${escapeHtml(stringifyProperty(props.stop_code))}`
            : '';
        const zoneValue = stringifyProperty(props.zone_id);
        const zone =
          props.zone_id != null && zoneValue.length > 0 ? `<br/>אזור: ${escapeHtml(zoneValue)}` : '';
        return `<strong>${name}</strong><br/>סוג: ${typ}${sid}${code}${zone}`;
      });
      attachPopup(map, LAYERS.infra, (props) => `<strong>${escapeHtml(String(props.name))}</strong>`);
      attachPopup(map, LAYERS.roads, (props) => `<strong>${escapeHtml(String(props.name))}</strong>`);
      attachPopup(map, LAYERS.routes, (props) => `<strong>${escapeHtml(String(props.name))}</strong>`);

      // If the user geocoded on Leaflet, `focusRequest` was already consumed there.
      // Restore that camera on first GL load when we are not prioritising an upload bbox.
      const uploadBbox = useUploadStore.getState().bbox;
      const lastCam = useMapStore.getState().lastGeocodeCamera;
      if (lastCam !== null && uploadBbox == null) {
        flyMapToLastGeocodeCamera(map, lastCam);
      }

      setGlMapReady(true);
    });

    return () => {
      loadedRef.current = false;
      setGlMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ------------------------- reactive visibility ----------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    applyVisibility(map, activeLayers);
  }, [activeLayers]);

  /* ---------------------- Supabase gtfs_stops → transit source --------- */
  // התחנות מוזרמות ל-Mapbox רק כשיש bbox מועלה. כשהמשתמש מנקה את הפוליגון
  // אנחנו מאפסים את ה-GeoJSON Source כדי שתחנות לא יישארו "תלויות" על המפה.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current) return;
    const src = getGeoJsonSource(map, SOURCES.transit);
    if (!src) return;

    if (!isSupabaseConfigured) {
      src.setData(transitStopsToGeoJSON(TRANSIT_STOPS));
      return;
    }

    if (!uploadedBbox) {
      src.setData(EMPTY_GEOJSON);
      return;
    }

    if (!gtfsFetched) return;
    const stops = gtfsStopRowsToTransitStops(gtfsRows ?? []);
    src.setData(transitStopsToGeoJSON(stops));
  }, [glMapReady, gtfsFetched, gtfsRows, uploadedBbox]);

  /* ------------------------ uploaded polygon sync ---------------------- */
  // Push the latest GeoJSON into the existing source whenever the user
  // uploads (or clears) a shapefile. `glMapReady` is in the deps so that a
  // polygon that already existed in the store BEFORE the 3D view mounted
  // (e.g. user uploaded in 2D, then switched to 3D) is still pushed into the
  // source the moment the map finishes loading.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current) return;
    const src = getGeoJsonSource(map, SOURCES.upload);
    if (!src) return;
    src.setData(uploadedPolygon ?? EMPTY_GEOJSON);
  }, [uploadedPolygon, glMapReady]);

  // Fly to the bbox of the uploaded polygon. Depends on `glMapReady` so the
  // first fit happens AFTER the map loads — without it the effect runs once
  // pre-load (returns early) and never re-fires for a bbox that was already
  // in the store at mount time, leaving the camera stranded in Tel Aviv
  // while the polygon sits off-screen.
  const lastZoomedBboxRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current || !uploadedBbox) return;
    const key = uploadedBbox.join(',');
    if (lastZoomedBboxRef.current === key) return;
    lastZoomedBboxRef.current = key;
    const [minLng, minLat, maxLng, maxLat] = uploadedBbox;
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, maxZoom: 16, duration: 800, pitch: MAPBOX_3D_DEFAULTS.pitch }
    );
  }, [uploadedBbox, glMapReady]);

  const focusRequest = useMapStore((s) => s.focusRequest);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current || !focusRequest) return;
    const { lat, lng, zoom, bbox } = focusRequest;
    if (bbox && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 50, maxZoom: 17, duration: 1100, pitch: MAPBOX_3D_DEFAULTS.pitch }
      );
    } else {
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? 15,
        duration: 1100,
        essential: true,
      });
    }
    useMapStore.getState().clearMapFocusRequest();
  }, [focusRequest, glMapReady]);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div className={`relative h-full w-full ${className ?? ''}`}>
        <TokenFallback />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full ${className ?? ''}`}
      style={{ background: '#050810' }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/** Instant camera sync after GL load (avoids staying on default TLV when switching from 2D). */
function flyMapToLastGeocodeCamera(map: mapboxgl.Map, cam: LastGeocodeCamera): void {
  if (cam.bbox !== undefined && cam.bbox.length === 4) {
    const [minLng, minLat, maxLng, maxLat] = cam.bbox;
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 50,
        maxZoom: 17,
        duration: 0,
        pitch: MAPBOX_3D_DEFAULTS.pitch,
      }
    );
    return;
  }
  map.jumpTo({
    center: [cam.lng, cam.lat],
    zoom: cam.zoom,
    pitch: MAPBOX_3D_DEFAULTS.pitch,
    bearing: MAPBOX_3D_DEFAULTS.bearing,
  });
}

function applyVisibility(
  map: mapboxgl.Map,
  active: { transit: boolean; accidents: boolean; roads: boolean; infrastructure: boolean }
): void {
  setLayerVisibility(map, LAYERS.accidents, active.accidents);
  setLayerVisibility(map, LAYERS.transit, active.transit);
  setLayerVisibility(map, LAYERS.routes, active.transit);
  setLayerVisibility(map, LAYERS.roads, active.roads);
  setLayerVisibility(map, LAYERS.infra, active.infrastructure);
}

function setLayerVisibility(map: mapboxgl.Map, layerId: string, visible: boolean): void {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

function attachPopup(
  map: mapboxgl.Map,
  layerId: string,
  renderHtml: (props: Record<string, unknown>) => string
): void {
  map.on('click', layerId, (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const coords = featureCenter(feature, e.lngLat);
    new mapboxgl.Popup({ closeButton: true, offset: 12 })
      .setLngLat(coords)
      .setHTML(renderHtml(feature.properties ?? {}))
      .addTo(map);
  });
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

function getGeoJsonSource(map: mapboxgl.Map, sourceId: string): mapboxgl.GeoJSONSource | null {
  const source: unknown = map.getSource(sourceId);
  if (!source || typeof source !== 'object' || !('setData' in source)) return null;
  return source as mapboxgl.GeoJSONSource;
}

function featureCenter(
  feature: GeoJSON.Feature,
  fallback: mapboxgl.LngLat
): [number, number] {
  if (feature.geometry.type === 'Point') {
    const coords = feature.geometry.coordinates;
    if (coords.length >= 2) {
      return [coords[0]!, coords[1]!];
    }
  }
  return [fallback.lng, fallback.lat];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stringifyProperty(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
