import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';

const PALETTE: Record<AnalysisLayerKey, { color: string; label: string }> = {
  transit: { color: '#10b981', label: 'תח"צ' },
  accidents: { color: '#ef4444', label: 'תאונה' },
  roads: { color: '#f59e0b', label: 'דרך' },
  infrastructure: { color: '#a855f7', label: 'תשתית' },
  traffic: { color: '#0ea5e9', label: 'ספירת תנועה' },
};

const ANALYSIS_PANE = 'analysisResults';

function isNonEmptyFeatureCollection(fc: unknown): fc is FeatureCollection {
  if (!fc || typeof fc !== 'object') return false;
  const o = fc as { type?: string; features?: unknown };
  return o.type === 'FeatureCollection' && Array.isArray(o.features) && o.features.length > 0;
}

/**
 * Renders the per-layer FeatureCollections returned by `analyze-area`
 * on the Leaflet map. Visibility follows **which layers the server returned**
 * (non-empty FeatureCollections), not `mapStore.activeLayers` — those toggles
 * control mock/static overlays and were hiding analysis markers when "תאונות"
 * was switched off in the layers card.
 *
 * Uses an SVG renderer + high z-index pane so circles stay visible on top of
 * `preferCanvas` raster maps (Canvas default path renderer can bury GeoJSON).
 */
export function AnalysisResultsLayer(): JSX.Element | null {
  const map = useMap();
  const results = useAnalysisStore((s) => s.results);
  const svgRenderersRef = useRef<Partial<Record<AnalysisLayerKey, L.SVG>>>({});

  useEffect(() => {
    if (map.getPane(ANALYSIS_PANE)) return;
    const pane = map.createPane(ANALYSIS_PANE);
    pane.style.zIndex = '650';
  }, [map]);

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
        const colour = PALETTE[key].color;
        // Re-mount on key change so Leaflet rebuilds child layers cleanly.
        const dataKey = `${key}-${layer.features.features.length}-${layer.counts.count}`;
        return (
          <GeoJSON
            key={dataKey}
            pane={ANALYSIS_PANE}
            data={layer.features}
            pointToLayer={(feature, latlng) => {
              let radius = 5;
              if (key === 'accidents') {
                const n = Number(
                  (feature.properties as Record<string, unknown> | undefined)?.accidents ?? 0
                );
                radius = Math.min(12, 4 + Math.sqrt(Math.max(0, n)) * 0.5);
              }
              return L.circleMarker(latlng, {
                radius,
                renderer: getSvgRenderer(key),
                color: key === 'accidents' ? 'rgba(255,255,255,0.92)' : colour,
                weight: key === 'accidents' ? 2 : 1.5,
                fillColor: colour,
                fillOpacity: 0.85,
              });
            }}
            style={() => ({
              renderer: getSvgRenderer(key),
              color: colour,
              weight: 2.5,
              opacity: 0.9,
              fillColor: colour,
              fillOpacity: 0.18,
            })}
            onEachFeature={(feature, leafletLayer) => {
              leafletLayer.bindPopup(buildPopupHtml(key, feature));
            }}
          />
        );
      })}
    </>
  );
}

function buildPopupHtml(key: AnalysisLayerKey, feature: Feature<Geometry>): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const label = PALETTE[key].label;
  const lines: string[] = [`<strong>${escapeHtml(label)}</strong>`];

  const pushIf = (k: string, prefix?: string): void => {
    const v = props[k];
    if (v === undefined || v === null || v === '') return;
    lines.push(`${prefix ? `${prefix}: ` : ''}${escapeHtml(String(v))}`);
  };

  if (key === 'transit') {
    pushIf('stop_name');
    pushIf('routes', 'מספר קווים');
  } else if (key === 'accidents') {
    pushIf('id', 'מזהה אזור (TAZ)');
    pushIf('city', 'יישוב');
    pushIf('accidents', 'תאונות (סכום TAZ)');
    pushIf('fatal', 'הרוגים');
    pushIf('severe_inj', 'פצועים קשה');
    pushIf('light_inj', 'פצועים קל');
    pushIf('year', 'שנה');
    pushIf('month', 'חודש');
    pushIf('type', 'סוג');
    pushIf('severity', 'חומרה');
  } else if (key === 'roads') {
    pushIf('road_number', 'כביש');
    pushIf('road_name');
    pushIf('authority', 'רשות');
    if (typeof props.length_m === 'number') {
      lines.push(`אורך: ${(props.length_m as number).toFixed(0)} מ'`);
    }
  } else if (key === 'infrastructure') {
    pushIf('category', 'סוג');
    pushIf('name');
    pushIf('status', 'סטטוס');
  } else if (key === 'traffic') {
    pushIf('description', 'תיאור');
    pushIf('count_type', 'סוג');
    pushIf('count_date', 'תאריך');
    if (typeof props.total_volume === 'number' && props.total_volume > 0) {
      lines.push(`נפח כולל: ${(props.total_volume as number).toLocaleString('he-IL')}`);
    }
    if (typeof props.volume_rows === 'number' && props.volume_rows > 0) {
      lines.push(`רשומות: ${(props.volume_rows as number).toLocaleString('he-IL')}`);
    }
  }

  return lines.join('<br/>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
