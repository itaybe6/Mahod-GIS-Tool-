import { useEffect, useMemo } from 'react';
import {
  MapContainer as LeafletMap,
  TileLayer,
  LayerGroup,
  Marker,
  Polyline,
  Popup,
  ScaleControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
} from '@/constants/mapConfig';
import { TILE_LAYERS } from '@/lib/leaflet/tile-layers';
import { useMapStore } from '@/stores/mapStore';
import { useUploadStore } from '@/stores/uploadStore';
import { MapLegend } from './MapLegend';
import { MapMunicipalityBadge } from './MapMunicipalityBadge';
import { Mapbox3DView } from './Mapbox3DView';
import { UploadedPolygonLayer } from './UploadedPolygonLayer';
import { PolygonDrawController } from './PolygonDrawController';
import { DrawModeOverlay } from './DrawModeOverlay';
import { AnalysisResultsLayer } from './AnalysisResultsLayer';
import { gtfsStopRowsToTransitStops } from '@/features/gtfs/gtfsStopMapUtils';
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
} from '@/features/map/mockData';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { MAP_POPUP_CLASS, buildMapPopupHtml, type MapPopupOptions } from './mapPopup';

/**
 * Renders one of our themed map popups inside a react-leaflet `<Popup>`.
 * The body is produced by `buildMapPopupHtml()` so the markup matches what
 * the Mapbox GL view emits and shares the same `.mahod-popup` styling.
 */
function MapPopupBody({ options }: { options: MapPopupOptions }): JSX.Element {
  return <div dangerouslySetInnerHTML={{ __html: buildMapPopupHtml(options) }} />;
}

const MARKER_TONE_COLORS = {
  red: '#ef4444',
  emerald: '#10b981',
  amber: '#f59e0b',
  purple: '#8b5cf6',
} as const;

function makeMarkerIcon(tone: 'red' | 'emerald' | 'amber' | 'purple'): L.DivIcon {
  return L.divIcon({
    html: `<div class="marker-glow marker-${tone}" style="--marker-color: ${MARKER_TONE_COLORS[tone]}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: 'custom-map-marker',
  });
}

const MARKER_ICONS = {
  accidents: makeMarkerIcon('red'),
  transit: makeMarkerIcon('emerald'),
  infrastructure: makeMarkerIcon('purple'),
} as const;

/**
 * שתי תחנות הרכבת חולקות את שכבת "תשתיות" עם שני גווני סגול ברורים (בלי פוקסיה/ורוד):
 * - רכבת כבדה → אינדיגו-סגול כהה (#4338ca …).
 * - רק"ל / מטרו → סגול עמוק (#6b21a8 …).
 * בתוך כל משפחה שלוש דרגות לפי סטטוס.
 */
type StationKind = 'railway' | 'metro';

const STATION_STYLES: Record<
  StationKind,
  Record<RailwayStationStatus, { color: string; label: string; opacity: number }>
> = {
  railway: {
    operational: { color: '#4338ca', label: 'תחנה פעילה', opacity: 1 },
    under_construction: { color: '#4f46e5', label: 'בבנייה', opacity: 0.95 },
    planned: { color: '#6366f1', label: 'מתוכננת', opacity: 0.55 },
  },
  metro: {
    operational: { color: '#6b21a8', label: 'תחנה פעילה', opacity: 1 },
    under_construction: { color: '#7e22ce', label: 'בבנייה', opacity: 0.95 },
    planned: { color: '#9333ea', label: 'מתוכננת', opacity: 0.55 },
  },
};

function makeStationIcon(kind: StationKind, status: RailwayStationStatus): L.DivIcon {
  const { color, opacity } = STATION_STYLES[kind][status];
  return L.divIcon({
    html:
      `<div class="marker-glow" style="--marker-color: ${color};` +
      ` background:${color}; box-shadow:0 0 10px ${color}; opacity:${opacity}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: 'custom-map-marker',
  });
}

const STATION_ICONS: Record<StationKind, Record<RailwayStationStatus, L.DivIcon>> = {
  railway: {
    operational: makeStationIcon('railway', 'operational'),
    under_construction: makeStationIcon('railway', 'under_construction'),
    planned: makeStationIcon('railway', 'planned'),
  },
  metro: {
    operational: makeStationIcon('metro', 'operational'),
    under_construction: makeStationIcon('metro', 'under_construction'),
    planned: makeStationIcon('metro', 'planned'),
  },
};

/**
 * Imperative controller that ties the `mapStore.mapType` Zustand state to
 * react-leaflet's internal `tileLayer` instance. We render the actual
 * `TileLayer` via `<TileLayer key={mapType}>` so changing the type swaps the
 * tile provider without needing to touch the Leaflet API directly.
 */
function TileSwitcher(): null {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

/** Applies one-shot `mapStore.focusRequest` (geocode toolbar) then clears it. */
function MapFocusController(): null {
  const map = useMap();
  const focusRequest = useMapStore((s) => s.focusRequest);

  useEffect(() => {
    if (!focusRequest) return;
    const { lat, lng, zoom, bbox } = focusRequest;
    if (bbox && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [28, 28], maxZoom: MAX_MAP_ZOOM, animate: true, duration: 1.1 }
      );
    } else {
      map.flyTo([lat, lng], zoom ?? 15, { duration: 1.15 });
    }
    useMapStore.getState().clearMapFocusRequest();
  }, [focusRequest, map]);

  return null;
}

/**
 * When returning from Mapbox GL, `focusRequest` may already be cleared.
 * Apply `lastGeocodeCamera` once on Leaflet mount if there is no upload bbox.
 */
function LeafletGeocodeRestore(): null {
  const map = useMap();

  useEffect(() => {
    const cam = useMapStore.getState().lastGeocodeCamera;
    const uploadBbox = useUploadStore.getState().bbox;
    if (cam === null || uploadBbox != null) return;
    if (cam.bbox !== undefined && cam.bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = cam.bbox;
      map.fitBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng],
        ],
        { padding: [28, 28], maxZoom: MAX_MAP_ZOOM, animate: false }
      );
    } else {
      map.setView([cam.lat, cam.lng], cam.zoom, { animate: false });
    }
  }, [map]);

  return null;
}

export interface MapViewProps {
  className?: string;
}

/**
 * Top-level map view. Switches between Leaflet (raster tile providers) and
 * Mapbox GL (3D) based on `mapType`. Both backends consume the same mock
 * dataset so toggling map type preserves the visible markers / lines.
 */
export function MapView({ className }: MapViewProps): JSX.Element {
  const mapType = useMapStore((s) => s.mapType);
  const activeLayers = useMapStore((s) => s.activeLayers);
  // התחנות נטענות רק אחרי שהמשתמש מעלה פוליגון, ורק עבור ה-bbox שלו —
  // אחרת היינו שואבים עשרות אלפי תחנות ומקפיאים את הדפדפן.
  const uploadedBbox = useUploadStore((s) => s.bbox);
  const { data: gtfsRows, isFetched: gtfsFetched } = useGtfsStops(uploadedBbox);
  const transitStops = useMemo(() => {
    if (!isSupabaseConfigured) return TRANSIT_STOPS;
    if (!uploadedBbox) return [];
    if (!gtfsFetched || !gtfsRows) return [];
    return gtfsStopRowsToTransitStops(gtfsRows);
  }, [uploadedBbox, gtfsFetched, gtfsRows]);

  // 109 תחנות בסך הכל — בטוח לטעון את כולן בכל זמן ולצייר אותן ישירות ב-Leaflet.
  const { data: railwayStations } = useRailwayStations();
  const { data: metroStations } = useMetroStations();
  const is3D = mapType === 'mapbox3d';
  const tileConfig = is3D ? null : TILE_LAYERS[mapType];

  return (
    <div
      className={`relative h-full min-h-0 overflow-hidden rounded-md border border-border bg-[#050810] ${
        className ?? ''
      }`}
    >
      {is3D ? (
        <Mapbox3DView />
      ) : (
        <LeafletMap
          center={DEFAULT_MAP_CENTER}
          zoom={DEFAULT_MAP_ZOOM}
          minZoom={MIN_MAP_ZOOM}
          maxZoom={MAX_MAP_ZOOM}
          preferCanvas
          scrollWheelZoom
          zoomControl
          attributionControl
          style={{ width: '100%', height: '100%', background: '#050810' }}
        >
          {tileConfig && (
            <TileLayer
              key={mapType}
              url={tileConfig.url}
              attribution={tileConfig.attribution}
              maxZoom={tileConfig.maxZoom}
              {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
            />
          )}
          <ScaleControl position="bottomleft" metric imperial={false} />
          <TileSwitcher />
          <MapFocusController />
          <LeafletGeocodeRestore />
          <UploadedPolygonLayer />
          <PolygonDrawController />

          {activeLayers.accidents && (
            <LayerGroup>
              {ACCIDENTS.map((acc, idx) => (
                <Marker
                  key={`acc-${idx}`}
                  position={acc.position}
                  icon={MARKER_ICONS.accidents}
                >
                  <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                    <MapPopupBody
                      options={{
                        accent: '#ef4444',
                        eyebrow: 'מוקד תאונות',
                        title: acc.name,
                        highlight: { value: acc.count, label: 'תאונות בשנה האחרונה' },
                        badge: { tone: 'high', label: 'חומרה גבוהה' },
                      }}
                    />
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          )}

          {activeLayers.transit && (
            <LayerGroup>
              {transitStops.map((stop, idx) => {
                const rows: { key: string; value: string | number }[] = [];
                if (stop.stopId != null) rows.push({ key: 'מזהה תחנה', value: stop.stopId });
                if (stop.stopCode != null) rows.push({ key: 'קוד תחנה', value: stop.stopCode });
                if (stop.zoneId != null && stop.zoneId !== '')
                  rows.push({ key: 'אזור תעריף', value: stop.zoneId });
                return (
                  <Marker
                    key={stop.stopId != null ? `gtfs-${stop.stopId}` : `stop-${idx}`}
                    position={stop.position}
                    icon={MARKER_ICONS.transit}
                  >
                    <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                      <MapPopupBody
                        options={{
                          accent: '#10b981',
                          eyebrow: 'תחבורה ציבורית',
                          title: stop.name,
                          rows,
                          badge: { tone: 'success', label: stop.type ?? 'תחנה פעילה' },
                        }}
                      />
                    </Popup>
                  </Marker>
                );
              })}
              {ROUTES.map((route) => (
                <Polyline
                  key={route.name}
                  positions={route.coords}
                  pathOptions={{
                    color: route.color,
                    weight: 3,
                    opacity: 0.85,
                    dashArray: '6 4',
                  }}
                >
                  <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                    <MapPopupBody
                      options={{
                        accent: route.color,
                        eyebrow: 'קו תחבורה',
                        title: route.name,
                      }}
                    />
                  </Popup>
                </Polyline>
              ))}
            </LayerGroup>
          )}

          {activeLayers.roads && (
            <LayerGroup>
              {ROADS.map((road) => (
                <Polyline
                  key={road.name}
                  positions={road.coords}
                  pathOptions={{ color: '#f59e0b', weight: 3.5, opacity: 0.75 }}
                >
                  <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                    <MapPopupBody
                      options={{
                        accent: '#f59e0b',
                        eyebrow: 'דרכים',
                        title: road.name,
                      }}
                    />
                  </Popup>
                </Polyline>
              ))}
            </LayerGroup>
          )}

          {activeLayers.infrastructure && (
            <LayerGroup>
              {INFRA_POINTS.map((point, idx) => (
                <Marker
                  key={`inf-${idx}`}
                  position={point.position}
                  icon={MARKER_ICONS.infrastructure}
                >
                  <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                    <MapPopupBody
                      options={{
                        accent: '#a855f7',
                        eyebrow: 'תשתיות',
                        title: point.name,
                      }}
                    />
                  </Popup>
                </Marker>
              ))}
              {(railwayStations ?? []).map((station: RailwayStation) => {
                const style = STATION_STYLES.railway[station.status];
                const tone: 'success' | 'medium' | 'neutral' =
                  station.status === 'planned'
                    ? 'neutral'
                    : station.status === 'under_construction'
                      ? 'medium'
                      : 'success';
                return (
                  <Marker
                    key={`rail-st-${station.stationId}`}
                    position={station.position}
                    icon={STATION_ICONS.railway[station.status]}
                  >
                    <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                      <MapPopupBody
                        options={{
                          accent: style.color,
                          eyebrow: 'תחנת רכבת',
                          title: station.name,
                          rows: [{ key: 'מזהה תחנה', value: station.stationId }],
                          badge: { tone, label: style.label },
                        }}
                      />
                    </Popup>
                  </Marker>
                );
              })}
              {(metroStations ?? []).map((station: MetroStation) => {
                const style = STATION_STYLES.metro[station.status];
                const tone: 'success' | 'medium' | 'neutral' =
                  station.status === 'planned'
                    ? 'neutral'
                    : station.status === 'under_construction'
                      ? 'medium'
                      : 'success';
                return (
                  <Marker
                    key={`metro-st-${station.stationId}`}
                    position={station.position}
                    icon={STATION_ICONS.metro[station.status]}
                  >
                    <Popup className={MAP_POPUP_CLASS} maxWidth={340} minWidth={256}>
                      <MapPopupBody
                        options={{
                          accent: style.color,
                          eyebrow: 'תחנת מטרו / רק"ל',
                          title: station.name,
                          rows: [{ key: 'מזהה תחנה', value: station.stationId }],
                          badge: { tone, label: style.label },
                        }}
                      />
                    </Popup>
                  </Marker>
                );
              })}
            </LayerGroup>
          )}

          <AnalysisResultsLayer />
        </LeafletMap>
      )}

      <MapLegend dateRange="01.04.2025 — 10.05.2025" title="צפיפות תאונות — אזור גוש דן" />
      <MapMunicipalityBadge />
      {!is3D && <DrawModeOverlay />}
    </div>
  );
}
