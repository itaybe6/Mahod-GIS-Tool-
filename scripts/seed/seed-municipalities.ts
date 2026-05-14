/**
 * scripts/seed-municipalities.ts
 *
 * Seeds the `municipalities` table from the official MOIN GIS portal shapefile.
 *
 * Source:  https://gisdata-moinil.opendata.arcgis.com/datasets/
 *          4d97c52bb29f4c51990ab5b7ac44a0c5
 * Layer:   גבולות שיפוט - רצף (Municipal Boundaries — Continuous)
 *
 * Pipeline:
 *   1. Read the .zip from disk
 *   2. Parse with shpjs (auto-reprojects from EPSG:2039 → 4326 using the .prj inside)
 *   3. Drop "ללא שיפוט" features (non-municipal areas)
 *   4. Group by CR_LAMAS, dissolve same-code polygons into MultiPolygons (29 exclaves)
 *   5. Upsert each authority into Supabase via on-conflict on semel_yishuv
 *
 * Run:    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/seed/seed-municipalities.ts
 *         Or put the env vars in .env.local / .env and run the same command.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import shp from 'shpjs';
import ws from 'ws';
import type {
  FeatureCollection,
  Polygon,
  MultiPolygon,
  Position,
} from 'geojson';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Types — match the DBF schema we verified against the real file
// ─────────────────────────────────────────────────────────────────────────────

interface MuniProperties {
  Muni_Heb: string;        // "תל אביב - יפו"
  Muni_Eng: string;        // "Tel Aviv-Yafo"
  Sug_Muni: string;        // עירייה / מועצה מקומית / מועצה אזורית / מועצה מקומית תעשייתית / ללא שיפוט
  CR_PNIM: string;         // Interior Ministry code (string, may be empty)
  CR_LAMAS: string;        // CBS code = accidents.semel_yishuv (string, may be empty)
  Machoz: string;          // מחוז name in Hebrew
  Hearot: string;
  Eshkol_MPn: string;
  Sign_Date: string | null; // ISO date (shpjs converts DBF dates to strings)
  Tikun1: string | null;
  Tikun2: string | null;
  Tikun3: string | null;
  Tikun4: string | null;
  Tikun5: string | null;
  Tikun6: string | null;
  Tikun7: string | null;
  Tikun8: string | null;
  Tikun9: string | null;
  Tikun10: string | null;
  Tikun11: string | null;
  Tikun12: string | null;
  Tikun13: string | null;
  Tikun14: string | null;
  Tikun15: string | null;
  Precision: string;
  FIRST_Nafa: string;      // נפה name in Hebrew
  LAST_Nafa2: string;
  Shape_Leng: number;
  Shape_Area: number;
  [key: string]: unknown;
}

interface MuniRow {
  semel_yishuv: number;
  name_he: string;
  name_en: string | null;
  sug_muni: string | null;
  cr_pnim: string | null;
  mahoz: string | null;
  nafa: string | null;
  eshkol_name: string | null;
  sign_date: string | null;
  last_tikun: string | null;
  area_sqkm: number | null;
  shape_length_m: number | null;
  notes: string | null;
  geom_json: string;   // intercepted by trigger → geom
  source_version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ZIP_PATH = process.env.MUNI_ZIP_PATH ?? './input/muni_il.zip';
const CHUNK_SIZE = 50;          // Supabase request size cap is generous, but PostGIS payloads are big
const SOURCE_NAME = 'municipalities';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Same rule as `src/lib/supabase/client.ts`: `createClient` needs the project origin only (no `/rest/v1`). */
function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

/**
 * Pick the most-recent valid date from Sign_Date + Tikun1..15.
 * Source has 15 amendment-date columns; we want the latest non-null one.
 */
function latestTikun(props: MuniProperties): string | null {
  const dates: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const v = props[`Tikun${i}` as keyof MuniProperties];
    if (typeof v === 'string' && v) dates.push(v);
  }
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

/**
 * Merge two Polygon|MultiPolygon geometries into a single MultiPolygon.
 * We treat each Polygon as a single member; this is a "stack into a MultiPolygon"
 * dissolve, NOT a true topological union (which would require turf.union).
 * That's the right choice here: source polygons for one authority don't overlap;
 * they're just disjoint exclaves, so concatenation is exact and ~1000× faster.
 */
function mergeGeometries(
  a: Polygon | MultiPolygon,
  b: Polygon | MultiPolygon,
): MultiPolygon {
  const polysOf = (g: Polygon | MultiPolygon): Position[][][] =>
    g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

  return {
    type: 'MultiPolygon',
    coordinates: [...polysOf(a), ...polysOf(b)],
  };
}

/** Wrap a Polygon as a MultiPolygon (or pass MultiPolygon through). */
function asMulti(g: Polygon | MultiPolygon): MultiPolygon {
  return g.type === 'MultiPolygon'
    ? g
    : { type: 'MultiPolygon', coordinates: [g.coordinates] };
}

/** `geom` is GEOMETRY(..., 4326) without Z; source polygons may include Z in GeoJSON. */
function dropZ(g: MultiPolygon): MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: g.coordinates.map((poly) =>
      poly.map((ring) => ring.map((p) => [p[0], p[1]] as Position)),
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const url = normalizeSupabaseUrl(rawUrl);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY',
    );
  }
  // Node.js 20 has no built-in WebSocket that @supabase/realtime-js accepts; `ws` is already a project dependency.
  const supabase = createClient(url, key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: ws as any },
  });

  // ── 1. Read + parse ─────────────────────────────────────────────────────
  console.log(`📂 Reading ${ZIP_PATH}…`);
  const buf = await readFile(ZIP_PATH);
  console.log(`   buffer: ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  console.log('🔍 Parsing shapefile (this auto-reprojects from ITM to WGS84)…');
  const gj = (await shp(buf)) as FeatureCollection<
    Polygon | MultiPolygon,
    MuniProperties
  >;
  console.log(`   features: ${gj.features.length}`);

  // ── 2. Filter unincorporated areas ──────────────────────────────────────
  const real = gj.features.filter(
    (f) => f.properties.Sug_Muni !== 'ללא שיפוט',
  );
  console.log(`   after dropping 'ללא שיפוט': ${real.length}`);

  // ── 3. Dissolve by CR_LAMAS (handle exclaves) ───────────────────────────
  const byCode = new Map<
    string,
    { props: MuniProperties; geom: Polygon | MultiPolygon }
  >();

  for (const f of real) {
    const code = f.properties.CR_LAMAS?.trim();
    if (!code) {
      console.warn(
        `   ⚠ skipping "${f.properties.Muni_Heb}" — no CR_LAMAS code`,
      );
      continue;
    }
    const existing = byCode.get(code);
    if (existing) {
      existing.geom = mergeGeometries(existing.geom, f.geometry);
    } else {
      byCode.set(code, { props: f.properties, geom: f.geometry });
    }
  }
  console.log(`   unique authorities after dissolve: ${byCode.size}`);

  // ── 4. Build rows ───────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const rows: MuniRow[] = [];
  let skippedNonNumeric = 0;

  for (const [code, { props, geom }] of byCode) {
    const semel = Number(code);
    if (!Number.isFinite(semel) || !Number.isInteger(semel)) {
      // INTEGER column needs a real integer; skip codes like "10a" if any appear
      skippedNonNumeric++;
      continue;
    }
    rows.push({
      semel_yishuv: semel,
      name_he: props.Muni_Heb?.trim() || 'Unknown',
      name_en: props.Muni_Eng?.trim() || null,
      sug_muni: props.Sug_Muni?.trim() || null,
      cr_pnim: props.CR_PNIM?.trim() || null,
      mahoz: props.Machoz?.trim() || null,
      nafa: props.FIRST_Nafa?.trim() || null,
      eshkol_name: props.Eshkol_MPn?.trim() || null,
      sign_date: props.Sign_Date || null,
      last_tikun: latestTikun(props),
      area_sqkm: props.Shape_Area
        ? Number((props.Shape_Area / 1e6).toFixed(3))
        : null,
      shape_length_m: props.Shape_Leng
        ? Number(props.Shape_Leng.toFixed(2))
        : null,
      notes: props.Hearot?.trim() || null,
      geom_json: JSON.stringify(dropZ(asMulti(geom))),
      source_version: today,
    });
  }
  if (skippedNonNumeric > 0) {
    console.warn(`   ⚠ skipped ${skippedNonNumeric} rows with non-integer CR_LAMAS`);
  }
  console.log(`✅ Prepared ${rows.length} rows for upsert`);

  // ── 5. Upsert in chunks ─────────────────────────────────────────────────
  console.log('☁️  Upserting to Supabase…');
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('municipalities')
      .upsert(chunk, { onConflict: 'semel_yishuv' });
    if (error) {
      console.error(`   ✗ chunk ${i / CHUNK_SIZE + 1}: ${error.message}`);
      throw error;
    }
    process.stdout.write(
      `   ✓ ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}\r`,
    );
  }
  console.log('');

  // ── 6. Update data_sources ledger ───────────────────────────────────────
  const { error: dsErr } = await supabase
    .from('data_sources')
    .update({
      last_checked_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      record_count: rows.length,
      status: 'active',
      metadata: {
        layer: 'גבולות שיפוט - רצף',
        source_crs: 'EPSG:2039',
        target_crs: 'EPSG:4326',
        total_features_in_source: gj.features.length,
        dropped_unincorporated: gj.features.length - real.length,
        unique_authorities_after_dissolve: byCode.size,
      },
    })
    .eq('name', SOURCE_NAME);
  if (dsErr) throw dsErr;

  console.log('🎉 Done.');
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
