import { useEffect } from 'react';
import {
  MapContainer as LeafletMap,
  ScaleControl,
  TileLayer,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
} from '@/constants/mapConfig';
import { TILE_LAYERS } from '@/lib/leaflet/tile-layers';
import { useMapStore } from '@/stores/mapStore';
import { useRoutePlannerStore } from '@/stores/routePlannerStore';
import { RoutePlannerMapLayer } from './RoutePlannerMapLayer';

/**
 * One-shot fly when `mapStore.focusRequest` is set (from the address autocomplete).
 * Same pattern as `MapFocusController` in the main map view, kept local here so
 * the route planner doesn't drag in the analysis / upload / GTFS layers.
 */
function FocusController(): null {
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
        { padding: [28, 28], maxZoom: MAX_MAP_ZOOM, animate: true, duration: 1 }
      );
    } else {
      map.flyTo([lat, lng], zoom ?? 15, { duration: 1 });
    }
    useMapStore.getState().clearMapFocusRequest();
  }, [focusRequest, map]);

  return null;
}

/**
 * Slim Leaflet map dedicated to the route-planner page. Reuses the project
 * tile-layer registry but skips the heavy MapView baggage (mock layers,
 * analysis results, uploaded polygons) so this view stays focused on A→B.
 */
export function RoutePlannerMap(): JSX.Element {
  const mapType = useMapStore((s) => s.mapType);
  const pickingMode = useRoutePlannerStore((s) => s.pickingMode);
  const tileConfig = mapType === 'mapbox3d' ? TILE_LAYERS.dark : TILE_LAYERS[mapType];

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-md border border-border bg-[#050810]">
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
        <TileLayer
          key={tileConfig.url}
          url={tileConfig.url}
          attribution={tileConfig.attribution}
          maxZoom={tileConfig.maxZoom}
          {...(tileConfig.subdomains ? { subdomains: tileConfig.subdomains } : {})}
        />
        <ScaleControl position="bottomleft" metric imperial={false} />
        <FocusController />
        <RoutePlannerMapLayer />
      </LeafletMap>

      {pickingMode && (
        <div className="pointer-events-none absolute start-1/2 top-3 z-[1000] -translate-x-1/2">
          <div className="pointer-events-auto rounded-full border border-brand-teal/40 bg-bg-2/95 px-3 py-1.5 text-[12px] text-text shadow-lg backdrop-blur">
            לחץ על המפה כדי לבחור{' '}
            <span className="font-semibold text-brand-teal">
              {pickingMode === 'origin' ? 'נקודת מוצא (A)' : 'יעד (B)'}
            </span>
            <button
              type="button"
              onClick={() => useRoutePlannerStore.getState().setPickingMode(null)}
              className="ms-2 rounded-full border border-border bg-bg-1 px-2 py-0.5 text-[10.5px] text-text-faint hover:text-danger"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
