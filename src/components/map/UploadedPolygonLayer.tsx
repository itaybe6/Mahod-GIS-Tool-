import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useUploadStore } from '@/stores/uploadStore';

const POLYGON_STYLE: L.PathOptions = {
  color: '#4cc9c0',
  weight: 2,
  opacity: 0.95,
  fillColor: '#4cc9c0',
  fillOpacity: 0.12,
};

/**
 * Renders the user-uploaded shapefile (`useUploadStore.polygon`) as a Leaflet
 * GeoJSON layer. When a *new* polygon arrives, the map auto-zooms to its
 * bounds; clearing the upload (or leaving the page) removes the layer cleanly.
 *
 * Must be rendered as a child of `react-leaflet`'s `<MapContainer>` so the
 * `useMap()` hook resolves to the active Leaflet instance.
 */
export function UploadedPolygonLayer(): JSX.Element | null {
  const map = useMap();
  const polygon = useUploadStore((s) => s.polygon);
  const bbox = useUploadStore((s) => s.bbox);
  // Polygons authored via the in-map draw flow are tagged with
  // `properties.source === 'draw'` and owned by the geoman layer
  // (`PolygonDrawController`). Rendering them here too would stack two
  // identical fills on the map and create a duplicate popup target.
  const isDrawn = useMemo(() => {
    if (!polygon) return false;
    return polygon.features.some(
      (f) => (f.properties as { source?: string } | null)?.source === 'draw'
    );
  }, [polygon]);

  // Re-mount the GeoJSON child whenever the data identity changes so that
  // Leaflet rebuilds its internal layers (no stale features sticking around).
  const dataKey = useMemo(
    () => (polygon ? `${polygon.features.length}-${bbox?.join(',') ?? ''}` : 'none'),
    [polygon, bbox]
  );

  // Track the last bbox we zoomed to, so we don't keep resetting the map's
  // viewport on unrelated re-renders.
  const lastZoomedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!polygon || !bbox) {
      lastZoomedKey.current = null;
      return;
    }
    if (lastZoomedKey.current === dataKey) return;
    lastZoomedKey.current = dataKey;

    const [minLng, minLat, maxLng, maxLat] = bbox;
    const leafletBounds = L.latLngBounds(
      L.latLng(minLat, minLng),
      L.latLng(maxLat, maxLng)
    );
    map.fitBounds(leafletBounds, { padding: [40, 40], maxZoom: 16 });
  }, [polygon, bbox, dataKey, map]);

  if (!polygon) return null;
  if (isDrawn) return null;

  return (
    <GeoJSON
      key={dataKey}
      data={polygon}
      style={() => POLYGON_STYLE}
      onEachFeature={(feature, layer) => {
        const name =
          (feature.properties && (feature.properties.name as string)) ||
          (feature.properties && (feature.properties.NAME as string)) ||
          'פוליגון שהועלה';
        layer.bindPopup(
          `<strong>${escapeHtml(String(name))}</strong><br/>סוג: ${escapeHtml(
            feature.geometry.type
          )}`
        );
      }}
    />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
