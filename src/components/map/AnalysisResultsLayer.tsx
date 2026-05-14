import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, LayerGroup, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import type { LatLngTuple } from '@/types/common';

const PALETTE: Record<AnalysisLayerKey, { color: string; label: string }> = {
  transit: { color: '#10b981', label: 'תחבורה ציבורית' },
  accidents: { color: '#ef4444', label: 'תאונות דרכים' },
  roads: { color: '#f59e0b', label: 'דרכים' },
  infrastructure: { color: '#a855f7', label: 'תשתיות' },
  traffic: { color: '#0ea5e9', label: 'ספירות תנועה' },
};

const ANALYSIS_PANE = 'analysisResults';

function makeAnalysisPulseIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `<div class="marker-glow analysis-marker-glow" style="--marker-color: ${color}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: 'custom-map-marker',
  });
}

function isNonEmptyFeatureCollection(fc: unknown): fc is FeatureCollection {
  if (!fc || typeof fc !== 'object') return false;
  const o = fc as { type?: string; features?: unknown };
  return o.type === 'FeatureCollection' && Array.isArray(o.features) && o.features.length > 0;
}

/**
 * Renders per-layer FeatureCollections from `analyze-area` on the Leaflet map.
 * Each point feature gets a pulse DivIcon matching the layer colour.
 * Line features (roads) also get a midpoint pulse marker.
 * When `focusAnalysisFeature` is set via mapStore, flies to the target and opens its popup.
 */
export function AnalysisResultsLayer(): JSX.Element | null {
  const map = useMap();
  const results = useAnalysisStore((s) => s.results);
  const svgRenderersRef = useRef<Partial<Record<AnalysisLayerKey, L.SVG>>>({});

  // Tracks Leaflet layer instances for each GeoJSON feature (for programmatic focus).
  const featureLayersRef = useRef<Partial<Record<AnalysisLayerKey, L.Layer[]>>>({});

  /* ── Setup analysis pane ──────────────────────────────────────── */
  useEffect(() => {
    if (map.getPane(ANALYSIS_PANE)) return;
    const pane = map.createPane(ANALYSIS_PANE);
    pane.style.zIndex = '650';
  }, [map]);

  /* ── Focus feature (fly + open popup) ────────────────────────── */
  const focusAnalysisFeature = useMapStore((s) => s.focusAnalysisFeature);

  useEffect(() => {
    if (!focusAnalysisFeature) return;
    const { layerKey, featureIndex } = focusAnalysisFeature;
    const layers = featureLayersRef.current[layerKey as AnalysisLayerKey];
    const target = layers?.[featureIndex];

    if (target) {
      const marker = target as L.Marker;
      if (typeof marker.getLatLng === 'function') {
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.55 });
        window.setTimeout(() => {
          if (marker.openPopup) marker.openPopup();
        }, 650);
      }
    }
    useMapStore.getState().clearFocusAnalysisFeature();
  }, [focusAnalysisFeature, map]);

  /* ── SVG renderer per layer ───────────────────────────────────── */
  const getSvgRenderer = (key: AnalysisLayerKey): L.SVG => {
    let r = svgRenderersRef.current[key];
    if (!r) {
      r = L.svg({ padding: 0.25 });
      svgRenderersRef.current[key] = r;
    }
    return r;
  };

  const visibleLayers = useMemo(() => {
    if (!results) return [] as AnalysisLayerKey[];
    return (Object.keys(PALETTE) as AnalysisLayerKey[]).filter((key) => {
      const lr = results[key];
      return lr != null && isNonEmptyFeatureCollection(lr.features);
    });
  }, [results]);

  if (visibleLayers.length === 0 || !results) return null;

  return (
    <>
      {visibleLayers.map((key) => {
        const layer = results[key]!;
        const { color: colour } = PALETTE[key];
        const pulseIcon = makeAnalysisPulseIcon(colour);
        const dataKey = `${key}-${layer.features.features.length}-${layer.counts.count}`;

        // Reset stored layer refs when data changes (GeoJSON remounts via key prop).
        featureLayersRef.current[key] = [];

        const linePulseMarkers =
          key === 'roads'
            ? layer.features.features
                .map((feature, featureIndex) => ({
                  feature,
                  featureIndex,
                  position: getRepresentativePosition(feature.geometry),
                }))
                .filter(
                  (
                    item
                  ): item is {
                    feature: Feature<Geometry>;
                    featureIndex: number;
                    position: LatLngTuple;
                  } => item.position != null
                )
            : [];

        return (
          <LayerGroup key={dataKey}>
            <GeoJSON
              pane={ANALYSIS_PANE}
              data={layer.features}
              pointToLayer={(_feature, latlng) => L.marker(latlng, { icon: pulseIcon })}
              style={() => ({
                renderer: getSvgRenderer(key),
                color: colour,
                weight: 2.5,
                opacity: 0.9,
                fillColor: colour,
                fillOpacity: 0.18,
              })}
              onEachFeature={(feature, leafletLayer) => {
                featureLayersRef.current[key]!.push(leafletLayer);
                leafletLayer.bindPopup(buildPopupHtml(key, feature, colour));
              }}
            />
            {linePulseMarkers.map(({ feature, featureIndex, position }) => (
              <Marker
                key={`${dataKey}-pulse-${featureIndex}`}
                position={position}
                icon={pulseIcon}
                pane={ANALYSIS_PANE}
                eventHandlers={{
                  add: (e) => {
                    // Store ref so focus mechanism can fly to this marker.
                    const arr = featureLayersRef.current[key];
                    if (arr) arr[featureIndex] = e.target as L.Marker;
                  },
                }}
              >
                <Popup>
                  <span
                    dangerouslySetInnerHTML={{ __html: buildPopupHtml(key, feature, colour) }}
                  />
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        );
      })}
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function getRepresentativePosition(geometry: Geometry): LatLngTuple | null {
  switch (geometry.type) {
    case 'Point':
      return positionToLatLng(geometry.coordinates);
    case 'MultiPoint':
      return positionToLatLng(geometry.coordinates[0]);
    case 'LineString':
      return positionToLatLng(geometry.coordinates[Math.floor(geometry.coordinates.length / 2)]);
    case 'MultiLineString': {
      const line = geometry.coordinates.find((coords) => coords.length > 0);
      return line ? positionToLatLng(line[Math.floor(line.length / 2)]) : null;
    }
    case 'Polygon':
      return positionToLatLng(geometry.coordinates[0]?.[0]);
    case 'MultiPolygon':
      return positionToLatLng(geometry.coordinates[0]?.[0]?.[0]);
    default:
      return null;
  }
}

function positionToLatLng(position: Position | undefined): LatLngTuple | null {
  if (!position || position.length < 2) return null;
  const [lng, lat] = position;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return [lat, lng];
}

function buildPopupHtml(
  key: AnalysisLayerKey,
  feature: Feature<Geometry>,
  colour: string
): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const title = getFeatureTitle(key, props);
  const rows = getPopupRows(key, props);

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="lp-row"><span class="lp-k">${escHtml(k)}</span><span class="lp-v">${escHtml(v)}</span></div>`
    )
    .join('');

  return `<div class="lp">
    <div class="lp-hd">
      <span class="lp-dot" style="background:${colour};box-shadow:0 0 6px ${colour}99"></span>
      <span class="lp-title">${escHtml(title)}</span>
    </div>
    <div class="lp-body">${rowsHtml}</div>
  </div>`;
}

function getFeatureTitle(key: AnalysisLayerKey, props: Record<string, unknown>): string {
  switch (key) {
    case 'transit':
      return str(props.stop_name ?? props.name ?? '—');
    case 'accidents':
      return props.city ? str(props.city) : `אזור TAZ ${str(props.id ?? '—')}`;
    case 'roads':
      return props.road_name
        ? str(props.road_name)
        : props.road_number
          ? `כביש ${str(props.road_number)}`
          : '—';
    case 'infrastructure':
      return str(props.name ?? props.category ?? '—');
    case 'traffic':
      return str(props.description ?? props.count_type ?? '—');
    default:
      return '—';
  }
}

function getPopupRows(
  key: AnalysisLayerKey,
  props: Record<string, unknown>
): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, val: unknown) => {
    const v = str(val);
    if (v && v !== 'null' && v !== 'undefined') rows.push([label, v]);
  };

  switch (key) {
    case 'transit':
      add('סוג', props.type);
      add('מזהה תחנה', props.stop_id);
      add('קוד', props.stop_code);
      add('אזור', props.zone_id);
      if (typeof props.routes === 'number' && props.routes > 0) add('קווים', props.routes);
      break;
    case 'accidents':
      add('יישוב', props.city);
      if (typeof props.accidents === 'number') add('תאונות', props.accidents);
      if (typeof props.fatal === 'number' && props.fatal > 0) add('הרוגים', props.fatal);
      if (typeof props.severe_inj === 'number' && props.severe_inj > 0)
        add('פצועים קשה', props.severe_inj);
      if (typeof props.light_inj === 'number' && props.light_inj > 0)
        add('פצועים קל', props.light_inj);
      add('שנה', props.year);
      add('חומרה', props.severity);
      break;
    case 'roads':
      if (props.road_number) add('מספר כביש', props.road_number);
      add('רשות', props.authority);
      if (typeof props.length_m === 'number')
        add('אורך', `${Math.round(props.length_m).toLocaleString('he-IL')} מ'`);
      break;
    case 'infrastructure':
      add('סוג', props.category);
      add('סטטוס', props.status);
      break;
    case 'traffic':
      add('סוג ספירה', props.count_type);
      add('תאריך', props.count_date);
      if (typeof props.total_volume === 'number' && props.total_volume > 0)
        add('נפח כולל', props.total_volume.toLocaleString('he-IL'));
      if (typeof props.volume_rows === 'number' && props.volume_rows > 0)
        add('רשומות', props.volume_rows.toLocaleString('he-IL'));
      break;
  }
  return rows;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
