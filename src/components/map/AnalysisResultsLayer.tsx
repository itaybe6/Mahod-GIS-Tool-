import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON, LayerGroup, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import type { LatLngTuple } from '@/types/common';
import {
  ANALYSIS_PALETTE,
  buildAnalysisPopupHtml,
  getRepresentativeLatLng,
} from './analysisLayerShared';

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
  const activeLayers = useMapStore((s) => s.activeLayers);
  const svgRenderersRef = useRef<Partial<Record<AnalysisLayerKey, L.SVG>>>({});

  // Tracks Leaflet layer instances for each GeoJSON feature (for programmatic focus).
  const featureLayersRef = useRef<Partial<Record<AnalysisLayerKey, L.Layer[]>>>({});

  /* ── Setup analysis pane ──────────────────────────────────────── */
  // The pane MUST exist before any Marker / GeoJSON child with
  // `pane="analysisResults"` is mounted — otherwise Leaflet's `_initIcon`
  // crashes with `Cannot read properties of undefined (reading 'appendChild')`
  // because `map._panes[name]` resolves to `undefined`.
  //
  // Doing this in a `useEffect` was too late: when the user switched from
  // Mapbox 3D back to Leaflet while analysis results were already in the
  // store, the children rendered on the SAME commit as the pane-creation
  // effect, so the markers tried to add themselves before the pane existed.
  // The mutation is idempotent, so running it during render (including under
  // StrictMode's double-invocation) is safe.
  if (!map.getPane(ANALYSIS_PANE)) {
    const pane = map.createPane(ANALYSIS_PANE);
    pane.style.zIndex = '650';
  }

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
    return (Object.keys(ANALYSIS_PALETTE) as AnalysisLayerKey[]).filter((key) => {
      if (!activeLayers[key]) return false;
      const lr = results[key];
      return lr != null && isNonEmptyFeatureCollection(lr.features);
    });
  }, [results, activeLayers]);

  if (visibleLayers.length === 0 || !results) return null;

  return (
    <>
      {visibleLayers.map((key) => {
        const layer = results[key]!;
        const { color: colour } = ANALYSIS_PALETTE[key];
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
                  position: toLatLngTuple(getRepresentativeLatLng(feature.geometry)),
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
                leafletLayer.bindPopup(
                  buildAnalysisPopupHtml(key, feature.properties ?? {}, colour)
                );
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
                    dangerouslySetInnerHTML={{
                      __html: buildAnalysisPopupHtml(key, feature.properties ?? {}, colour),
                    }}
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

function toLatLngTuple(c: { lat: number; lng: number } | null): LatLngTuple | null {
  return c ? [c.lat, c.lng] : null;
}
