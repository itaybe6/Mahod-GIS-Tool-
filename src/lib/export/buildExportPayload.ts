import area from '@turf/area';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { AnalysisResults, LayerResult } from '@/stores/analysisStore';
import type { ExportAnalysisPayload } from './exportPayloadTypes';

function isPolygonal(g: Geometry): g is Polygon | MultiPolygon {
  return g.type === 'Polygon' || g.type === 'MultiPolygon';
}

/** Geodesic area of a FeatureCollection in km² (WGS84). */
export function featureCollectionAreaKm2(fc: FeatureCollection): number {
  let sumM2 = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (g && isPolygonal(g)) {
      sumM2 += area(f as Feature<Polygon | MultiPolygon>);
    }
  }
  return sumM2 / 1_000_000;
}

function readTransit(layer: LayerResult | undefined): ExportAnalysisPayload['publicTransport'] {
  const fc = layer?.features;
  const feats = fc?.features ?? [];
  let routesServingSum = 0;
  for (const f of feats) {
    const r = (f.properties as { routes?: unknown } | null)?.routes;
    if (typeof r === 'number' && Number.isFinite(r)) routesServingSum += r;
  }
  return {
    stopsCount: layer?.counts.count ?? 0,
    routesServingSum,
    agenciesCount: 0,
  };
}

function readAccidents(layer: LayerResult | undefined): ExportAnalysisPayload['accidents'] {
  const fc = layer?.features;
  const feats = fc?.features ?? [];
  const byYear: Record<string, number> = {};
  for (const f of feats) {
    const p = f.properties as {
      year?: unknown;
      accidents?: unknown;
    } | null;
    const y = typeof p?.year === 'number' && Number.isFinite(p.year) ? p.year : null;
    if (y == null) continue;
    const acc = typeof p?.accidents === 'number' && Number.isFinite(p.accidents) ? p.accidents : 0;
    const key = String(y);
    byYear[key] = (byYear[key] ?? 0) + acc;
  }
  const bd = layer?.counts.breakdown as
    | { fatal?: unknown; severe?: unknown; light?: unknown; total_accidents?: unknown }
    | undefined;
  const fatal = typeof bd?.fatal === 'number' ? bd.fatal : 0;
  const severe = typeof bd?.severe === 'number' ? bd.severe : 0;
  const light = typeof bd?.light === 'number' ? bd.light : 0;
  const total = layer?.counts.count ?? 0;
  return {
    total,
    bySeverity: { fatal, severe, light },
    byYear,
  };
}

function readRoads(layer: LayerResult | undefined): ExportAnalysisPayload['roads'] {
  const fc = layer?.features;
  const feats = fc?.features ?? [];
  const byAuthority: Record<string, number> = {};
  for (const f of feats) {
    const p = f.properties as { authority?: unknown; length_m?: unknown } | null;
    const name = typeof p?.authority === 'string' && p.authority !== '' ? p.authority : 'לא ידוע';
    const len = typeof p?.length_m === 'number' && Number.isFinite(p.length_m) ? p.length_m : 0;
    byAuthority[name] = (byAuthority[name] ?? 0) + len;
  }
  const bd = layer?.counts.breakdown as { total_length_m?: unknown } | undefined;
  const totalLengthMeters =
    typeof bd?.total_length_m === 'number' && Number.isFinite(bd.total_length_m)
      ? bd.total_length_m
      : Object.values(byAuthority).reduce((a, b) => a + b, 0);
  return {
    totalLengthMeters,
    segmentsCount: layer?.counts.count ?? 0,
    byAuthority,
  };
}

export function buildExportAnalysisPayload(
  polygon: FeatureCollection,
  results: AnalysisResults,
  opts: { polygonName?: string | null; analyzedAt?: Date }
): ExportAnalysisPayload {
  const analyzedAt = opts.analyzedAt ?? new Date();
  return {
    metadata: {
      ...(opts.polygonName != null && opts.polygonName !== ''
        ? { polygonName: opts.polygonName }
        : {}),
      polygonAreaKm2: featureCollectionAreaKm2(polygon),
      analyzedAt: analyzedAt.toISOString(),
    },
    publicTransport: readTransit(results.transit),
    accidents: readAccidents(results.accidents),
    roads: readRoads(results.roads),
  };
}
