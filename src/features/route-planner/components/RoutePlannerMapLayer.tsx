import { useEffect, useMemo, useRef } from 'react';
import { Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  optionId,
  useRoutePlannerStore,
  type RoutePlanOption,
} from '@/stores/routePlannerStore';
import { formatMeters } from '../formatters';

const ENDPOINT_PANE = 'routePlannerEndpoints';
const SHAPE_PANE = 'routePlannerShape';

function makeEndpointIcon(tone: 'emerald' | 'rose', glyph: 'A' | 'B'): L.DivIcon {
  const palette =
    tone === 'emerald'
      ? { bg: '#10b981', glow: 'rgba(16,185,129,0.45)' }
      : { bg: '#f43f5e', glow: 'rgba(244,63,94,0.45)' };
  return L.divIcon({
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${palette.bg};color:#fff;font-weight:700;
      display:grid;place-items:center;
      box-shadow:0 0 0 3px rgba(255,255,255,0.18),0 0 14px ${palette.glow};
      font-family:Inter,system-ui,sans-serif;font-size:12px;
      ">${glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    className: '',
  });
}

function makeStopIcon(tone: 'emerald' | 'rose'): L.DivIcon {
  const bg = tone === 'emerald' ? '#10b981' : '#f43f5e';
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:#0a0e1a;border:2px solid ${bg};
      box-shadow:0 0 8px ${bg}80;
      "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: '',
  });
}

const ICONS = {
  origin: makeEndpointIcon('emerald', 'A'),
  destination: makeEndpointIcon('rose', 'B'),
  fromStop: makeStopIcon('emerald'),
  toStop: makeStopIcon('rose'),
} as const;

/**
 * Renders the route-planner endpoints and selected option on top of Leaflet:
 *   * A / B markers for origin & destination
 *   * Stop markers (from / to) of the currently selected option
 *   * Dashed walking lines: A→from-stop, to-stop→B
 *   * Solid colored polyline: transit segment along the shape
 *   * Light, semi-transparent polylines for *other* options (so the user
 *     understands what else is on offer at a glance)
 *
 * Map clicks set the endpoint that matches `pickingMode` (when set).
 */
export function RoutePlannerMapLayer(): JSX.Element | null {
  const map = useMap();
  const origin = useRoutePlannerStore((s) => s.origin);
  const destination = useRoutePlannerStore((s) => s.destination);
  const pickingMode = useRoutePlannerStore((s) => s.pickingMode);
  const setOrigin = useRoutePlannerStore((s) => s.setOrigin);
  const setDestination = useRoutePlannerStore((s) => s.setDestination);
  const results = useRoutePlannerStore((s) => s.results);
  const selectedOptionId = useRoutePlannerStore((s) => s.selectedOptionId);

  const cursorRestoreRef = useRef<string>('');

  // Build panes once so shapes render above tiles but below popups.
  useEffect(() => {
    if (!map.getPane(SHAPE_PANE)) {
      const pane = map.createPane(SHAPE_PANE);
      pane.style.zIndex = '610';
    }
    if (!map.getPane(ENDPOINT_PANE)) {
      const pane = map.createPane(ENDPOINT_PANE);
      pane.style.zIndex = '660';
    }
  }, [map]);

  // Crosshair cursor while picking, so the affordance is obvious.
  useEffect(() => {
    const container = map.getContainer();
    if (pickingMode) {
      cursorRestoreRef.current = container.style.cursor;
      container.style.cursor = 'crosshair';
    } else if (cursorRestoreRef.current !== '') {
      container.style.cursor = cursorRestoreRef.current;
      cursorRestoreRef.current = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [map, pickingMode]);

  // Whenever the selected option changes, gently nudge the camera so it's visible.
  const selectedOption = useMemo<RoutePlanOption | null>(() => {
    if (!results || !selectedOptionId) return null;
    return results.options.find((o) => optionId(o) === selectedOptionId) ?? null;
  }, [results, selectedOptionId]);

  useEffect(() => {
    if (!selectedOption || !origin || !destination) return;
    const pts: L.LatLngTuple[] = [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
      [selectedOption.from_stop.lat, selectedOption.from_stop.lng],
      [selectedOption.to_stop.lat, selectedOption.to_stop.lng],
    ];
    map.fitBounds(L.latLngBounds(pts), {
      padding: [60, 60],
      maxZoom: 16,
      animate: true,
      duration: 0.8,
    });
  }, [selectedOption, origin, destination, map]);

  useMapEvents({
    click(e) {
      const mode = useRoutePlannerStore.getState().pickingMode;
      if (!mode) return;
      const { lat, lng } = e.latlng;
      const endpoint = {
        lat,
        lng,
        label: `נקודה (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      };
      if (mode === 'origin') setOrigin(endpoint);
      else setDestination(endpoint);
    },
  });

  return (
    <>
      {origin && (
        <Marker
          position={[origin.lat, origin.lng]}
          icon={ICONS.origin}
          pane={ENDPOINT_PANE}
        >
          <Popup>
            <strong>נקודת מוצא (A)</strong>
            <br />
            {origin.label}
          </Popup>
        </Marker>
      )}
      {destination && (
        <Marker
          position={[destination.lat, destination.lng]}
          icon={ICONS.destination}
          pane={ENDPOINT_PANE}
        >
          <Popup>
            <strong>יעד (B)</strong>
            <br />
            {destination.label}
          </Popup>
        </Marker>
      )}

      {results &&
        results.options.map((opt) => {
          const id = optionId(opt);
          if (id === selectedOptionId) return null;
          const coords = opt.shape_segment?.coordinates ?? [];
          if (coords.length < 2) return null;
          return (
            <Polyline
              key={`alt-${id}`}
              positions={coords.map(([lng, lat]) => [lat, lng] as L.LatLngTuple)}
              pathOptions={{
                color: '#64748b',
                weight: 3,
                opacity: 0.4,
                dashArray: '1 6',
              }}
              pane={SHAPE_PANE}
            />
          );
        })}

      {selectedOption && (
        <>
          {selectedOption.shape_segment?.coordinates &&
            selectedOption.shape_segment.coordinates.length >= 2 && (
              <Polyline
                key={`sel-${optionId(selectedOption)}`}
                positions={selectedOption.shape_segment.coordinates.map(
                  ([lng, lat]) => [lat, lng] as L.LatLngTuple
                )}
                pathOptions={{
                  color: '#4caf50',
                  weight: 6,
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                pane={SHAPE_PANE}
              >
                <Popup>
                  <strong>{selectedOption.route_short_name ?? `קו ${selectedOption.route_id}`}</strong>
                  <br />
                  {selectedOption.route_long_name ?? ''}
                  <br />
                  נסיעה: {formatMeters(selectedOption.transit_distance_m)}
                </Popup>
              </Polyline>
            )}

          {origin && (
            <Polyline
              positions={[
                [origin.lat, origin.lng],
                [selectedOption.from_stop.lat, selectedOption.from_stop.lng],
              ]}
              pathOptions={{
                color: '#10b981',
                weight: 3,
                opacity: 0.85,
                dashArray: '4 6',
              }}
              pane={SHAPE_PANE}
            />
          )}
          {destination && (
            <Polyline
              positions={[
                [selectedOption.to_stop.lat, selectedOption.to_stop.lng],
                [destination.lat, destination.lng],
              ]}
              pathOptions={{
                color: '#f43f5e',
                weight: 3,
                opacity: 0.85,
                dashArray: '4 6',
              }}
              pane={SHAPE_PANE}
            />
          )}

          <Marker
            position={[selectedOption.from_stop.lat, selectedOption.from_stop.lng]}
            icon={ICONS.fromStop}
            pane={ENDPOINT_PANE}
          >
            <Popup>
              <strong>תחנת עלייה</strong>
              <br />
              {selectedOption.from_stop.stop_name}
              <br />
              הליכה: {formatMeters(selectedOption.walk_to_stop_m)}
            </Popup>
          </Marker>
          <Marker
            position={[selectedOption.to_stop.lat, selectedOption.to_stop.lng]}
            icon={ICONS.toStop}
            pane={ENDPOINT_PANE}
          >
            <Popup>
              <strong>תחנת ירידה</strong>
              <br />
              {selectedOption.to_stop.stop_name}
              <br />
              הליכה: {formatMeters(selectedOption.walk_from_stop_m)}
            </Popup>
          </Marker>
        </>
      )}
    </>
  );
}
