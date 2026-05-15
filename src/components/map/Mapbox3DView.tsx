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
  useMetroStations,
  type MetroStation,
  useRailwayStations,
  type RailwayStation,
  type RailwayStationStatus,
} from '@/features/infrastructure/useRailwayStations';
import {
  ACCIDENTS,
  INFRA_POINTS,
  ROADS,
  ROUTES,
  TRANSIT_STOPS,
  toMapboxLngLat,
} from '@/features/map/mockData';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore, type LastGeocodeCamera } from '@/stores/mapStore';
import { useUploadStore } from '@/stores/uploadStore';
import type { LayerKey } from '@/types/common';
import {
  ANALYSIS_LAYER_KEYS,
  ANALYSIS_PALETTE,
  buildAnalysisPopupHtml,
  getRepresentativeLatLng,
} from './analysisLayerShared';
import { MAP_POPUP_CLASS, buildMapPopupHtml } from './mapPopup';

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

interface RailwayStationFeatureProps {
  station_id: string | number;
  name: string;
  status: RailwayStationStatus;
  status_label: string;
  station_kind: 'railway' | 'metro';
}

const RAILWAY_STATION_LABEL: Record<RailwayStationStatus, string> = {
  operational: 'תחנה פעילה',
  under_construction: 'בבנייה',
  planned: 'מתוכננת',
};

const EMPTY_RAILWAY_GEOJSON: FeatureCollection<Point, RailwayStationFeatureProps> = {
  type: 'FeatureCollection',
  features: [],
};

function buildRailwayStationsGeoJSON(
  stations: ReadonlyArray<RailwayStation>,
): FeatureCollection<Point, RailwayStationFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toMapboxLngLat(s.position) },
      properties: {
        station_id: s.stationId,
        name: s.name,
        status: s.status,
        status_label: RAILWAY_STATION_LABEL[s.status],
        station_kind: 'railway',
      },
    })),
  };
}

function buildMetroStationsGeoJSON(
  stations: ReadonlyArray<MetroStation>,
): FeatureCollection<Point, RailwayStationFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toMapboxLngLat(s.position) },
      properties: {
        station_id: s.stationId,
        name: s.name,
        status: s.status,
        status_label: RAILWAY_STATION_LABEL[s.status],
        station_kind: 'metro',
      },
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
  railwayStations: 'src-railway-stations',
  upload: 'src-upload-polygon',
} as const;

const LAYERS = {
  accidents: 'lyr-accidents',
  transit: 'lyr-transit-stops',
  routes: 'lyr-transit-routes',
  roads: 'lyr-roads',
  infra: 'lyr-infra',
  railwayStations: 'lyr-railway-stations',
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
/*                          Analysis result sources / ids                     */
/* -------------------------------------------------------------------------- */

/**
 * Per-analysis-layer Mapbox source/layer ids. Each of the five analysis
 * keys (transit / accidents / roads / infrastructure / traffic) gets:
 *   - 1 GeoJSON source containing every feature returned by `analyze-area`.
 *   - 3 layers filtered by geometry-type: `fill` for polygons (e.g. accident
 *     TAZ shapes), `line` for road segments, `circle` for point features.
 */
const ANALYSIS_SOURCE_IDS: Record<AnalysisLayerKey, string> = {
  transit: 'src-analysis-transit',
  accidents: 'src-analysis-accidents',
  roads: 'src-analysis-roads',
  infrastructure: 'src-analysis-infra',
  traffic: 'src-analysis-traffic',
};

type AnalysisSubLayer = 'fill' | 'line' | 'circle';
const ANALYSIS_SUB_LAYERS: ReadonlyArray<AnalysisSubLayer> = ['fill', 'line', 'circle'];

function analysisLayerId(key: AnalysisLayerKey, kind: AnalysisSubLayer): string {
  return `lyr-analysis-${key}-${kind}`;
}

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
  const { data: railwayStations } = useRailwayStations();
  const { data: metroStations } = useMetroStations();
  const analysisResults = useAnalysisStore((s) => s.results);
  const focusAnalysisFeature = useMapStore((s) => s.focusAnalysisFeature);

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
      map.addSource(SOURCES.railwayStations, {
        type: 'geojson',
        data: EMPTY_RAILWAY_GEOJSON,
      });
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

      // Railway + metro/LRT — שני גווני סגול (אינדיגו מול סגול עמוק), בלי פוקסיה.
      //   • railway: #4338ca / #4f46e5 / #6366f1
      //   • metro:   #6b21a8 / #7e22ce / #9333ea
      map.addLayer({
        id: LAYERS.railwayStations,
        type: 'circle',
        source: SOURCES.railwayStations,
        paint: {
          'circle-radius': [
            'match',
            ['get', 'status'],
            'operational', 7,
            'under_construction', 6.5,
            'planned', 5,
            6,
          ],
          'circle-color': [
            'match',
            ['get', 'station_kind'],
            'metro', [
              'match',
              ['get', 'status'],
              'operational', '#6b21a8',
              'under_construction', '#7e22ce',
              'planned', '#9333ea',
              '#6b21a8',
            ],
            'railway', [
              'match',
              ['get', 'status'],
              'operational', '#4338ca',
              'under_construction', '#4f46e5',
              'planned', '#6366f1',
              '#4338ca',
            ],
            '#a855f7',
          ],
          'circle-opacity': [
            'match',
            ['get', 'status'],
            'operational', 0.95,
            'under_construction', 0.9,
            'planned', 0.55,
            0.9,
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(255,255,255,0.7)',
          'circle-emissive-strength': 0.8,
        },
      });

      // Analysis result layers ----------------------------------------
      // One GeoJSON source per analysis key (data is pushed reactively
      // by the `analysisResults` effect below). Each source feeds three
      // layers — fill / line / circle — filtered by geometry-type so the
      // same source can render polygons (accident TAZ), lines (road
      // segments), and points (transit stops, traffic counters, infra).
      for (const key of ANALYSIS_LAYER_KEYS) {
        const colour = ANALYSIS_PALETTE[key].color;
        const sourceId = ANALYSIS_SOURCE_IDS[key];

        map.addSource(sourceId, { type: 'geojson', data: EMPTY_GEOJSON });

        map.addLayer({
          id: analysisLayerId(key, 'fill'),
          type: 'fill',
          source: sourceId,
          slot: MAPBOX_STANDARD_TOP_SLOT,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': colour,
            'fill-opacity': 0.2,
            'fill-emissive-strength': 0.7,
            'fill-outline-color': colour,
          },
        });

        map.addLayer({
          id: analysisLayerId(key, 'line'),
          type: 'line',
          source: sourceId,
          slot: MAPBOX_STANDARD_TOP_SLOT,
          filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': colour,
            'line-width': 3.5,
            'line-opacity': 0.95,
            'line-emissive-strength': 1,
          },
        });

        map.addLayer({
          id: analysisLayerId(key, 'circle'),
          type: 'circle',
          source: sourceId,
          slot: MAPBOX_STANDARD_TOP_SLOT,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 6.5,
            'circle-color': colour,
            'circle-opacity': 0.95,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': 'rgba(255,255,255,0.85)',
            'circle-emissive-strength': 1,
          },
        });
      }

      // Apply current visibility state immediately
      applyVisibility(map, useMapStore.getState().activeLayers);

      // Popups ---------------------------------------------------------
      // All map popups share the modern glassmorphic RTL card from
      // `mapPopup.ts` (see `MAP_POPUP_CLASS` / `buildMapPopupHtml`). Each layer
      // chooses its own accent colour so the popup matches the marker tone.
      attachPopup(map, LAYERS.accidents, (props) =>
        buildMapPopupHtml({
          accent: '#ef4444',
          eyebrow: 'מוקד תאונות',
          title: stringifyProperty(props.name),
          highlight: { value: stringifyProperty(props.count), label: 'תאונות בשנה האחרונה' },
          badge: { tone: 'high', label: 'חומרה גבוהה' },
        }),
      );
      attachPopup(map, LAYERS.transit, (props) => {
        const rows: { key: string; value: string }[] = [];
        const stopId = stringifyProperty(props.stop_id);
        if (stopId) rows.push({ key: 'מזהה תחנה', value: stopId });
        const stopCode = stringifyProperty(props.stop_code);
        if (stopCode) rows.push({ key: 'קוד תחנה', value: stopCode });
        const zone = stringifyProperty(props.zone_id);
        if (zone) rows.push({ key: 'אזור תעריף', value: zone });
        return buildMapPopupHtml({
          accent: '#10b981',
          eyebrow: 'תחבורה ציבורית',
          title: stringifyProperty(props.name),
          rows,
          badge: { tone: 'success', label: stringifyProperty(props.type) || 'תחנה פעילה' },
        });
      });
      attachPopup(map, LAYERS.infra, (props) =>
        buildMapPopupHtml({
          accent: '#a855f7',
          eyebrow: 'תשתיות',
          title: stringifyProperty(props.name),
        }),
      );
      attachPopup(map, LAYERS.roads, (props) =>
        buildMapPopupHtml({
          accent: '#f59e0b',
          eyebrow: 'דרכים',
          title: stringifyProperty(props.name),
        }),
      );
      attachPopup(map, LAYERS.routes, (props) =>
        buildMapPopupHtml({
          accent: '#0ea5e9',
          eyebrow: 'קו תחבורה',
          title: stringifyProperty(props.name),
        }),
      );
      // Analysis popups — share the .lp card with the Leaflet renderer so
      // both modes show identical content (and the same row formatting).
      for (const key of ANALYSIS_LAYER_KEYS) {
        const colour = ANALYSIS_PALETTE[key].color;
        for (const kind of ANALYSIS_SUB_LAYERS) {
          attachPopup(map, analysisLayerId(key, kind), (props) =>
            buildAnalysisPopupHtml(key, props, colour)
          );
        }
      }

      attachPopup(map, LAYERS.railwayStations, (props) => {
        const status = stringifyProperty(props.status);
        const isMetro = stringifyProperty(props.station_kind) === 'metro';
        const stationLabel = isMetro ? 'תחנת מטרו / רק"ל' : 'תחנת רכבת';
        const accent = isMetro
          ? status === 'planned'
            ? '#9333ea'
            : status === 'under_construction'
              ? '#7e22ce'
              : '#6b21a8'
          : status === 'planned'
            ? '#6366f1'
            : status === 'under_construction'
              ? '#4f46e5'
              : '#4338ca';
        const badgeTone: 'success' | 'medium' | 'neutral' =
          status === 'planned' ? 'neutral' : status === 'under_construction' ? 'medium' : 'success';
        return buildMapPopupHtml({
          accent,
          eyebrow: stationLabel,
          title: stringifyProperty(props.name),
          rows: [{ key: 'מזהה תחנה', value: stringifyProperty(props.station_id) }],
          badge: { tone: badgeTone, label: stringifyProperty(props.status_label) || 'סטטוס לא ידוע' },
        });
      });

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

  /* ------------------- analysis results → GeoJSON sources -------------- */
  // Push the latest `analyze-area` payload into the per-key Mapbox sources.
  // We must also reapply visibility here: when results arrive (or change)
  // the active-layers state may not change at all, but layers that were
  // hidden because they had no data should now flip on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current) return;
    for (const key of ANALYSIS_LAYER_KEYS) {
      const src = getGeoJsonSource(map, ANALYSIS_SOURCE_IDS[key]);
      if (!src) continue;
      const layer = analysisResults?.[key];
      src.setData(layer?.features ?? EMPTY_GEOJSON);
    }
    applyVisibility(map, useMapStore.getState().activeLayers);
  }, [analysisResults, glMapReady]);

  /* --------- Supabase infra_*_stations (railway + metro/LRT) → source --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current) return;
    const src = getGeoJsonSource(map, SOURCES.railwayStations);
    if (!src) return;
    const railGeo = buildRailwayStationsGeoJSON(railwayStations ?? []);
    const metroGeo = buildMetroStationsGeoJSON(metroStations ?? []);
    src.setData({
      type: 'FeatureCollection',
      features: [...railGeo.features, ...metroGeo.features],
    });
  }, [glMapReady, railwayStations, metroStations]);

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

  /* ------------------- focus a single analysis feature ----------------- */
  // Mirrors the Leaflet behaviour in `AnalysisResultsLayer`: when the user
  // clicks a row in the results panel we fly the GL camera to a
  // representative point of the geometry and pop the same `.lp` card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !glMapReady || !loadedRef.current || !focusAnalysisFeature) return;

    const { layerKey, featureIndex } = focusAnalysisFeature;
    const layer = analysisResults?.[layerKey];
    const feature = layer?.features.features[featureIndex];
    if (!feature) {
      useMapStore.getState().clearFocusAnalysisFeature();
      return;
    }

    const pos = getRepresentativeLatLng(feature.geometry);
    if (pos) {
      const targetZoom = Math.max(map.getZoom(), 15);
      map.flyTo({
        center: [pos.lng, pos.lat],
        zoom: targetZoom,
        duration: 700,
        essential: true,
      });
      const colour = ANALYSIS_PALETTE[layerKey].color;
      const html = buildAnalysisPopupHtml(layerKey, feature.properties ?? {}, colour);
      window.setTimeout(() => {
        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          offset: 16,
          maxWidth: '340px',
          className: MAP_POPUP_CLASS,
        })
          .setLngLat([pos.lng, pos.lat])
          .setHTML(html)
          .addTo(map);
      }, 750);
    }
    useMapStore.getState().clearFocusAnalysisFeature();
  }, [focusAnalysisFeature, analysisResults, glMapReady]);

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

function applyVisibility(map: mapboxgl.Map, active: Record<LayerKey, boolean>): void {
  setLayerVisibility(map, LAYERS.accidents, active.accidents);
  setLayerVisibility(map, LAYERS.transit, active.transit);
  setLayerVisibility(map, LAYERS.routes, active.transit);
  setLayerVisibility(map, LAYERS.roads, active.roads);
  setLayerVisibility(map, LAYERS.infra, active.infrastructure);
  setLayerVisibility(map, LAYERS.railwayStations, active.infrastructure);

  // Analysis sub-layers follow the same active-layers flag as their domain.
  // We don't gate on "results present" — leaving the layer visible with an
  // empty source is harmless and avoids extra plumbing.
  for (const key of ANALYSIS_LAYER_KEYS) {
    const visible = active[key] === true;
    for (const kind of ANALYSIS_SUB_LAYERS) {
      setLayerVisibility(map, analysisLayerId(key, kind), visible);
    }
  }
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
    new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: 16,
      maxWidth: '340px',
      className: MAP_POPUP_CLASS,
    })
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

function stringifyProperty(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
