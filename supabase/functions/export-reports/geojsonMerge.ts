export interface GeoJsonFeature {
  type: 'Feature';
  geometry: unknown;
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

function asFeatureArrayFromRpcEnvelope(envelope: unknown, layer: string): GeoJsonFeature[] {
  if (!envelope || typeof envelope !== 'object') return [];
  const featuresWrapper = (envelope as { features?: unknown }).features;
  if (!featuresWrapper || typeof featuresWrapper !== 'object') return [];
  const inner = featuresWrapper as { features?: unknown };
  if (!Array.isArray(inner.features)) return [];
  const out: GeoJsonFeature[] = [];
  for (const raw of inner.features) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as { type?: string; geometry?: unknown; properties?: Record<string, unknown> };
    if (f.type !== 'Feature' || f.geometry == null) continue;
    out.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: { layer, ...(f.properties ?? {}) },
    });
  }
  return out;
}

export function mergeLayerGeoJson(
  results: Array<{ layer: string; envelope: unknown }>
): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];
  for (const { layer, envelope } of results) {
    features.push(...asFeatureArrayFromRpcEnvelope(envelope, layer));
  }
  return { type: 'FeatureCollection', features };
}
