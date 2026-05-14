import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import type { LayerKey } from '@/types/common';

const PALETTE: Record<AnalysisLayerKey, { color: string; label: string }> = {
  transit: { color: '#10b981', label: 'תח"צ' },
  accidents: { color: '#ef4444', label: 'תאונה' },
  roads: { color: '#f59e0b', label: 'דרך' },
  infrastructure: { color: '#a855f7', label: 'תשתית' },
};

/**
 * Both stores share the same 4-layer vocabulary, so the conversion is a
 * 1:1 cast — kept as a typed map to keep TS happy if the keys diverge later.
 */
const ANALYSIS_TO_MAP: Record<AnalysisLayerKey, LayerKey> = {
  transit: 'transit',
  accidents: 'accidents',
  roads: 'roads',
  infrastructure: 'infrastructure',
};

/**
 * Renders the per-layer FeatureCollections returned by `analyze-area`
 * directly on the Leaflet map. Each layer's visibility is gated by the
 * existing `mapStore.activeLayers` toggles, so the user can show / hide
 * categories from the top bar without re-running the analysis.
 *
 * Points become small circle markers; lines and polygons render as paths
 * styled with the layer's accent colour.
 */
export function AnalysisResultsLayer(): JSX.Element | null {
  const results = useAnalysisStore((s) => s.results);
  const activeLayers = useMapStore((s) => s.activeLayers);

  const visibleLayers = useMemo(() => {
    if (!results) return [] as AnalysisLayerKey[];
    return (Object.keys(PALETTE) as AnalysisLayerKey[]).filter(
      (key) => results[key] && activeLayers[ANALYSIS_TO_MAP[key]] !== false
    );
  }, [results, activeLayers]);

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
            data={layer.features}
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 5,
                color: colour,
                weight: 1.5,
                fillColor: colour,
                fillOpacity: 0.85,
              })
            }
            style={() => ({
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
    pushIf('year', 'שנה');
    pushIf('severity', 'חומרה');
    pushIf('type', 'סוג');
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
