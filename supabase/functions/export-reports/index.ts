import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { extractPolygonGeometry } from './polygon.ts';
import { mergeLayerGeoJson } from './geojsonMerge.ts';
import { renderReportCsv } from './csvReport.ts';
import { renderReportHtml } from './htmlReport.ts';
import type { MapFeature, MapLayerFeatures } from './mapSvg.ts';
import type { ReportData } from './types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type ExportFormat = 'geojson' | 'csv' | 'html';

interface LayerFlags {
  publicTransport: boolean;
  accidents: boolean;
  roads: boolean;
}

interface RequestBody {
  format?: string;
  polygon?: unknown;
  layers?: Partial<LayerFlags>;
  analysis?: unknown;
}

const RPC_NAMES: Array<{
  layerKey: keyof LayerFlags;
  rpc: string;
  exportLayer: string;
}> = [
  { layerKey: 'publicTransport', rpc: 'query_gtfs_in_polygon', exportLayer: 'gtfs_stop' },
  { layerKey: 'accidents', rpc: 'query_accidents_in_polygon', exportLayer: 'accident' },
  { layerKey: 'roads', rpc: 'query_roads_in_polygon', exportLayer: 'road' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function asciiFilename(ext: string): string {
  return `mahod-gis-${Date.now()}.${ext}`;
}

function parseLayers(v: unknown): LayerFlags {
  if (!v || typeof v !== 'object') {
    throw new Error('layers חסר');
  }
  const o = v as Record<string, unknown>;
  return {
    publicTransport: o.publicTransport === true,
    accidents: o.accidents === true,
    roads: o.roads === true,
  };
}

function parseReportData(v: unknown): ReportData {
  if (!v || typeof v !== 'object') throw new Error('analysis חסר');
  const o = v as Record<string, unknown>;
  const metaRaw = o.metadata;
  if (!metaRaw || typeof metaRaw !== 'object') throw new Error('metadata חסר');
  const meta = metaRaw as Record<string, unknown>;
  const polygonAreaKm2 =
    typeof meta.polygonAreaKm2 === 'number' && Number.isFinite(meta.polygonAreaKm2)
      ? meta.polygonAreaKm2
      : NaN;
  const analyzedAt = typeof meta.analyzedAt === 'string' ? meta.analyzedAt : '';
  if (!Number.isFinite(polygonAreaKm2) || analyzedAt === '') {
    throw new Error('metadata לא תקין');
  }

  const pt = o.publicTransport;
  if (!pt || typeof pt !== 'object') throw new Error('publicTransport חסר');
  const pto = pt as Record<string, unknown>;
  const stopsCount = typeof pto.stopsCount === 'number' ? pto.stopsCount : 0;
  const routesServingSum = typeof pto.routesServingSum === 'number' ? pto.routesServingSum : 0;
  const agenciesCount = typeof pto.agenciesCount === 'number' ? pto.agenciesCount : 0;

  const ac = o.accidents;
  if (!ac || typeof ac !== 'object') throw new Error('accidents חסר');
  const aco = ac as Record<string, unknown>;
  const total = typeof aco.total === 'number' ? aco.total : 0;
  const sev = aco.bySeverity;
  if (!sev || typeof sev !== 'object') throw new Error('bySeverity חסר');
  const sevo = sev as Record<string, unknown>;
  const fatal = typeof sevo.fatal === 'number' ? sevo.fatal : 0;
  const severe = typeof sevo.severe === 'number' ? sevo.severe : 0;
  const light = typeof sevo.light === 'number' ? sevo.light : 0;
  const byYearRaw = aco.byYear;
  const byYear: Record<string, number> = {};
  if (byYearRaw && typeof byYearRaw === 'object') {
    for (const [k, val] of Object.entries(byYearRaw as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) byYear[k] = val;
    }
  }

  const rd = o.roads;
  if (!rd || typeof rd !== 'object') throw new Error('roads חסר');
  const rdo = rd as Record<string, unknown>;
  const totalLengthMeters =
    typeof rdo.totalLengthMeters === 'number' && Number.isFinite(rdo.totalLengthMeters)
      ? rdo.totalLengthMeters
      : 0;
  const segmentsCount = typeof rdo.segmentsCount === 'number' ? rdo.segmentsCount : 0;
  const byAuthRaw = rdo.byAuthority;
  const byAuthority: Record<string, number> = {};
  if (byAuthRaw && typeof byAuthRaw === 'object') {
    for (const [k, val] of Object.entries(byAuthRaw as Record<string, unknown>)) {
      if (typeof val === 'number' && Number.isFinite(val)) byAuthority[k] = val;
    }
  }

  const dataVersions = meta.dataVersions;
  let dv: ReportData['metadata']['dataVersions'];
  if (dataVersions && typeof dataVersions === 'object') {
    const dvo = dataVersions as Record<string, unknown>;
    dv = {
      ...(typeof dvo.gtfs === 'string' ? { gtfs: dvo.gtfs } : {}),
      ...(typeof dvo.accidents === 'string' ? { accidents: dvo.accidents } : {}),
      ...(typeof dvo.roads === 'string' ? { roads: dvo.roads } : {}),
    };
  }

  return {
    metadata: {
      ...(typeof meta.polygonName === 'string' && meta.polygonName !== ''
        ? { polygonName: meta.polygonName }
        : {}),
      polygonAreaKm2,
      analyzedAt,
      ...(dv && Object.keys(dv).length > 0 ? { dataVersions: dv } : {}),
    },
    publicTransport: { stopsCount, routesServingSum, agenciesCount },
    accidents: { total, bySeverity: { fatal, severe, light }, byYear },
    roads: { totalLengthMeters, segmentsCount, byAuthority },
  };
}

/** Build a service-role Supabase client, or null if env is missing. */
function getServiceSupabase(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Call the per-layer `query_*_in_polygon` RPCs in parallel for the requested
 * layers. Each result is the raw envelope returned by the RPC (used by both
 * the GeoJSON merger and the HTML map overlay).
 */
async function fetchLayerEnvelopes(
  supabase: SupabaseClient,
  polygonText: string,
  wanted: typeof RPC_NAMES
): Promise<{ results: Array<{ layer: string; envelope: unknown }>; errors: string[] }> {
  const settled = await Promise.allSettled(
    wanted.map(async (w) => {
      const { data, error } = await supabase.rpc(w.rpc, { polygon_geojson: polygonText });
      if (error) throw new Error(`${w.rpc}: ${error.message}`);
      return { layer: w.exportLayer, envelope: data };
    })
  );

  const results: Array<{ layer: string; envelope: unknown }> = [];
  const errors: string[] = [];
  for (let i = 0; i < settled.length; i += 1) {
    const out = settled[i]!;
    if (out.status === 'fulfilled') {
      results.push(out.value);
    } else {
      errors.push(out.reason instanceof Error ? out.reason.message : String(out.reason));
    }
  }
  return { results, errors };
}

/** Pull the inner `Feature[]` array out of an RPC envelope (`{features:{features:[…]}}`). */
function envelopeToFeatures(envelope: unknown): MapFeature[] {
  if (!envelope || typeof envelope !== 'object') return [];
  const wrap = (envelope as { features?: unknown }).features;
  if (!wrap || typeof wrap !== 'object') return [];
  const inner = (wrap as { features?: unknown }).features;
  if (!Array.isArray(inner)) return [];
  const out: MapFeature[] = [];
  for (const raw of inner) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as { type?: string; geometry?: unknown; properties?: Record<string, unknown> };
    if (f.type !== 'Feature' || f.geometry == null) continue;
    out.push({ geometry: f.geometry, properties: f.properties });
  }
  return out;
}

async function handleGeoJson(body: RequestBody): Promise<Response> {
  let polygonGeometry: object;
  try {
    polygonGeometry = extractPolygonGeometry(body.polygon);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  let layers: LayerFlags;
  try {
    layers = parseLayers(body.layers);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  const wanted = RPC_NAMES.filter((x) => layers[x.layerKey]);
  if (wanted.length === 0) {
    return jsonResponse({ error: 'יש לבחור לפחות שכבה אחת לייצוא' }, 400);
  }

  const supabase = getServiceSupabase();
  if (!supabase) {
    return jsonResponse({ error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }
  const polygonText = JSON.stringify(polygonGeometry);

  const { results: layerResults, errors: errs } = await fetchLayerEnvelopes(
    supabase,
    polygonText,
    wanted
  );
  if (layerResults.length === 0) {
    return jsonResponse({ error: 'כל השכבות נכשלו', details: errs }, 502);
  }

  const fc = mergeLayerGeoJson(layerResults);
  const filename = asciiFilename('geojson');
  return new Response(JSON.stringify(fc), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...(errs.length > 0 ? { 'X-Export-Warnings': errs.join(' | ') } : {}),
    },
  });
}

async function handleSummary(format: 'csv' | 'html', body: RequestBody): Promise<Response> {
  let report: ReportData;
  try {
    report = parseReportData(body.analysis);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  if (format === 'csv') {
    const csv = renderReportCsv(report);
    const filename = asciiFilename('csv');
    return new Response(csv, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // HTML: polygon + per-layer features are optional — used for the inline OSM
  // map overlay. If anything is missing or fails we degrade gracefully and
  // still render the rest of the report.
  let polygonGeometry: object | undefined;
  try {
    polygonGeometry = extractPolygonGeometry(body.polygon);
  } catch {
    polygonGeometry = undefined;
  }

  let mapFeatures: MapLayerFeatures = {};
  if (polygonGeometry) {
    let layers: LayerFlags | null = null;
    try {
      layers = parseLayers(body.layers);
    } catch {
      // No layers selected — render polygon without overlays.
    }
    const wanted = layers ? RPC_NAMES.filter((x) => layers![x.layerKey]) : [];
    const supabase = wanted.length > 0 ? getServiceSupabase() : null;
    if (supabase && wanted.length > 0) {
      const polygonText = JSON.stringify(polygonGeometry);
      try {
        const { results } = await fetchLayerEnvelopes(supabase, polygonText, wanted);
        const byLayer: Record<string, MapFeature[]> = {};
        for (const r of results) {
          byLayer[r.layer] = envelopeToFeatures(r.envelope);
        }
        mapFeatures = {
          ...(byLayer.gtfs_stop ? { publicTransport: byLayer.gtfs_stop } : {}),
          ...(byLayer.accident ? { accidents: byLayer.accident } : {}),
          ...(byLayer.road ? { roads: byLayer.road } : {}),
        };
      } catch {
        // Soft-fail: report is still useful without the overlay.
        mapFeatures = {};
      }
    }
  }

  const html = await renderReportHtml(report, polygonGeometry, mapFeatures);
  const filename = asciiFilename('html');
  return new Response(html, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: 'Body חייב להיות JSON תקין' }, 400);
  }

  const format = body.format as ExportFormat | undefined;
  if (format !== 'geojson' && format !== 'csv' && format !== 'html') {
    return jsonResponse({ error: 'format חייב להיות geojson, csv או html' }, 400);
  }

  if (format === 'geojson') {
    return handleGeoJson(body);
  }
  return handleSummary(format, body);
});
