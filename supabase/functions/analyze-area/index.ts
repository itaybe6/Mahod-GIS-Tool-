// Supabase Edge Function: analyze-area
// ----------------------------------------------------------------
// Receives a WGS84 GeoJSON polygon (single Polygon, MultiPolygon, or
// a Feature/FeatureCollection wrapping one) plus a `layers` selector,
// and runs the 4 spatial query RPCs defined in
// `supabase/migrations/20260514210000_create_polygon_query_functions.sql`.
//
// All requested layers are queried in parallel; per-layer failures are
// surfaced individually so a single broken table doesn't kill the whole
// response (mission requirement: "show partial results when only part
// of the data is available").
//
// Local dev:
//   supabase functions serve analyze-area --env-file ./supabase/.env
// Deploy:
//   supabase functions deploy analyze-area
// ----------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface LayerSelection {
  transit?: boolean;
  accidents?: boolean;
  roads?: boolean;
  infrastructure?: boolean;
}

interface RequestBody {
  polygon: unknown;
  layers: LayerSelection;
}

const RPC_NAMES = {
  transit: 'query_gtfs_in_polygon',
  accidents: 'query_accidents_in_polygon',
  roads: 'query_roads_in_polygon',
  infrastructure: 'query_infra_in_polygon',
} as const;

type LayerKey = keyof typeof RPC_NAMES;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Reduce any GeoJSON shape (Polygon / MultiPolygon / Feature / FeatureCollection)
 * to a bare geometry object that PostGIS' `ST_GeomFromGeoJSON` can ingest.
 *
 * If the input has multiple polygon features we wrap them as a single
 * MultiPolygon — that's fine for `ST_Within`/`ST_Intersects` filtering.
 */
function extractPolygonGeometry(input: unknown): object {
  if (!input || typeof input !== 'object') {
    throw new Error('polygon חסר או לא תקין');
  }
  const geom = input as { type?: string };

  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    return input as object;
  }

  if (geom.type === 'Feature') {
    const feat = input as { geometry?: object };
    if (!feat.geometry) throw new Error('Feature ללא geometry');
    return extractPolygonGeometry(feat.geometry);
  }

  if (geom.type === 'FeatureCollection') {
    const fc = input as { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> };
    const polys = (fc.features ?? [])
      .map((f) => f?.geometry)
      .filter(
        (g): g is { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } =>
          !!g && (g.type === 'Polygon' || g.type === 'MultiPolygon')
      );
    if (polys.length === 0) {
      throw new Error('FeatureCollection לא מכיל פוליגונים');
    }
    if (polys.length === 1) return polys[0]!;
    // Merge multiple polygons into a single MultiPolygon for the query.
    const coords: unknown[] = [];
    for (const p of polys) {
      if (p.type === 'Polygon') coords.push(p.coordinates);
      else if (Array.isArray(p.coordinates))
        coords.push(...(p.coordinates as unknown[]));
    }
    return { type: 'MultiPolygon', coordinates: coords };
  }

  throw new Error(`type לא נתמך: ${String(geom.type)}`);
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

  let polygonGeometry: object;
  try {
    polygonGeometry = extractPolygonGeometry(body.polygon);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 400);
  }

  const polygonText = JSON.stringify(polygonGeometry);
  const selection = body.layers ?? {};

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env' },
      500
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const startedAt = performance.now();

  const wantedKeys = (Object.keys(RPC_NAMES) as LayerKey[]).filter(
    (k) => selection[k] === true
  );
  if (wantedKeys.length === 0) {
    return jsonResponse({ error: 'יש לבחור לפחות שכבה אחת לניתוח' }, 400);
  }

  // Run the requested RPCs concurrently and capture per-layer errors so
  // a single broken layer doesn't blow up the whole response.
  const settled = await Promise.allSettled(
    wantedKeys.map(async (key) => {
      const rpcName = RPC_NAMES[key];
      const { data, error } = await supabase.rpc(rpcName, {
        polygon_geojson: polygonText,
      });
      if (error) throw new Error(`${rpcName}: ${error.message}`);
      return [key, data] as const;
    })
  );

  const results: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (let i = 0; i < settled.length; i += 1) {
    const key = wantedKeys[i]!;
    const outcome = settled[i]!;
    if (outcome.status === 'fulfilled') {
      results[key] = outcome.value[1];
    } else {
      errors[key] = outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
    }
  }

  return jsonResponse({
    results,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    durationMs: Math.round(performance.now() - startedAt),
  });
});
