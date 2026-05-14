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
import { AnalysisResultsLayer } from './AnalysisResultsLayer';
import { gtfsStopRowsToTransitStops } from '@/features/gtfs/gtfsStopMapUtils';
import { useGtfsStops } from '@/features/gtfs/useGtfsStops';
import {
  ACCIDENTS,
  INFRA_POINTS,
  ROADS,
  ROUTES,
  TRANSIT_STOPS,
} from '@/features/map/mockData';
import { isSupabaseConfigured } from '@/lib/supabase/client';

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

          {activeLayers.accidents && (
            <LayerGroup>
              {ACCIDENTS.map((acc, idx) => (
                <Marker
                  key={`acc-${idx}`}
                  position={acc.position}
                  icon={MARKER_ICONS.accidents}
                >
                  <Popup>
                    <strong>{acc.name}</strong>
                    <br />
                    תאונות: {acc.count}
                    <br />
                    חומרה: גבוהה
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          )}

          {activeLayers.transit && (
            <LayerGroup>
              {transitStops.map((stop, idx) => (
                <Marker
                  key={stop.stopId != null ? `gtfs-${stop.stopId}` : `stop-${idx}`}
                  position={stop.position}
                  icon={MARKER_ICONS.transit}
                >
                  <Popup>
                    <strong>{stop.name}</strong>
                    <br />
                    סוג: {stop.type}
                    {stop.stopId != null && (
                      <>
                        <br />
                        מזהה תחנה: {stop.stopId}
                      </>
                    )}
                    {stop.stopCode != null && (
                      <>
                        <br />
                        קוד: {stop.stopCode}
                      </>
                    )}
                    {stop.zoneId != null && stop.zoneId !== '' && (
                      <>
                        <br />
                        אזור: {stop.zoneId}
                      </>
                    )}
                  </Popup>
                </Marker>
              ))}
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
                  <Popup>
                    <strong>{route.name}</strong>
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
                  <Popup>
                    <strong>{road.name}</strong>
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
                  <Popup>
                    <strong>{point.name}</strong>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          )}

          <AnalysisResultsLayer />
        </LeafletMap>
      )}

      <MapLegend dateRange="01.04.2025 — 10.05.2025" title="צפיפות תאונות — אזור גוש דן" />
      <MapMunicipalityBadge />
    </div>
  );
}
