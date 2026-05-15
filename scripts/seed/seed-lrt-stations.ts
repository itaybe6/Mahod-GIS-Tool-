/**
 * scripts/seed/seed-lrt-stations.ts
 *
 * Seeds the `infra_metro_stations` table from data.gov.il LRT stations layer.
 *
 * Source: https://data.gov.il/dataset/lrt_stat
 * Layer:  תחנות רכבת קלה (LRT_STAT)
 *
 * Pipeline:
 *   1. Read input/lrt_stat.zip from disk
 *   2. Parse with shpjs (auto-reprojects from EPSG:2039 → 4326 using the .prj inside)
 *   3. Validate required fields exist; warn on unknown field names
 *   4. Map Hebrew status → enum (קיימת/בבניה/בתכנון → operational/under_construction/planned)
 *   5. Upsert each station via onConflict: station_id (primary key)
 *
 * Run:    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/seed/seed-lrt-stations.ts
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import shp from 'shpjs';
import ws from 'ws';
import type { FeatureCollection, Point } from 'geojson';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Types — data.gov.il publishes two LRT shapefile shapes over time:
//   • "stations" style: ASSET_NO, NAME, … (same idea as RAIL_STAT)
//   • "entrances" layer: STAT_NAME, ENTRC_LBL, LINE, STATUS, …
// ─────────────────────────────────────────────────────────────────────────────

interface LrtProperties {
  ASSET_NO?: number;
  NAME?: string;
  MAAGAN_ID?: number;
  MGN_TYPE?: number;
  SOURCE?: string;
  STATUS?: string;
  KAV_CODE?: number | string;
  MGN_UPD?: Date | string | null;
  YEARMONTH?: number;
  TYPE?: string;
  /** Current LRT entrances / stations layer (Hebrew labels in DBF). */
  STAT_NAME?: string;
  ENTRC_LBL?: string | number;
  LINE?: string | number;
  X?: number;
  Y?: number;
  ENTRC_EXIT?: string | number;
  ACSBL_ENTR?: string | number;
  ENTRC_TYPE?: string | number;
  NOTES?: string;
  COMP?: string | number;
  MTR_AREA?: string | number;
  [key: string]: unknown;
}

type LrtSchemaMode = 'rail_asset' | 'lrt_entrance';

type StatusEn = 'operational' | 'under_construction' | 'planned';

interface MetroStationRow {
  station_id: string;
  station_name: string;
  line_id: string | null; // nullable FK — will be linked when lrt_line is loaded
  status: StatusEn;
  /** EWKT for PostGIS column `geom` (same pattern as seed-railway-stations). */
  geom: string;
  source_url: string;
  source_version: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ZIP_PATH = process.env.LRT_ZIP_PATH ?? './input/lrt_stat.zip';
const CHUNK_SIZE = 100;
const SOURCE_NAME = 'lrt';
const STATION_ID_PREFIX = 'lrt_';  // distinguishes from heavy-rail / future metro

const STATUS_MAP: Record<string, StatusEn> = {
  'קיימת':  'operational',
  'בבניה':  'under_construction',
  'בתכנון': 'planned',
};

// Fields we read explicitly (anything else → one-time "unknown" warning).
const KNOWN_FIELDS = new Set([
  'ASSET_NO', 'NAME', 'MAAGAN_ID', 'MGN_TYPE', 'SOURCE',
  'STATUS', 'KAV_CODE', 'MGN_UPD', 'YEARMONTH', 'TYPE',
  'X', 'Y', 'ENTRC_EXIT', 'ACSBL_ENTR', 'ENTRC_TYPE', 'NOTES', 'LINE',
  'COMP', 'MTR_AREA', 'STAT_NAME', 'ENTRC_LBL',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  return raw.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

/** Split feature props into known fields (typed) + unknowns (logged only). */
function splitProps(props: LrtProperties): {
  known: LrtProperties;
  extras: Record<string, unknown>;
} {
  const known: LrtProperties = {};
  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (KNOWN_FIELDS.has(k)) {
      (known as Record<string, unknown>)[k] = v;
    } else {
      extras[k] = v;
    }
  }
  return { known, extras };
}

function detectLrtSchema(sampleKeys: string[]): LrtSchemaMode {
  const keySet = new Set(sampleKeys);
  if (keySet.has('ASSET_NO') && keySet.has('NAME')) return 'rail_asset';
  if (keySet.has('STAT_NAME')) return 'lrt_entrance';
  throw new Error(
    'Unrecognized LRT_STAT shapefile columns. Expected either (ASSET_NO + NAME) or STAT_NAME. ' +
      `Got: ${sampleKeys.join(', ')}`,
  );
}

/** Stable, deterministic id for the entrances schema. */
function entranceDeterministicId(props: LrtProperties, lon: number, lat: number): string {
  const raw = [
    props.LINE != null ? String(props.LINE) : '',
    props.STAT_NAME != null ? String(props.STAT_NAME) : '',
    props.ENTRC_LBL != null ? String(props.ENTRC_LBL) : '',
    lon.toFixed(6),
    lat.toFixed(6),
  ].join('|');
  const h = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 20);
  return `${STATION_ID_PREFIX}e_${h}`;
}

function entranceStationId(props: LrtProperties, lon: number, lat: number): string {
  return entranceDeterministicId(props, lon, lat);
}

function entranceDisplayName(props: LrtProperties): string {
  const stat = (props.STAT_NAME ?? '').trim();
  const lbl = props.ENTRC_LBL != null ? String(props.ENTRC_LBL).trim() : '';
  if (stat && lbl) return `${stat} · ${lbl}`;
  return stat || lbl || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
  const url = normalizeSupabaseUrl(rawUrl);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY');
  }
  const supabase = createClient(url, key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: ws as any },
  });

  // ── 1. Read + parse ─────────────────────────────────────────────────────
  console.log(`📂 Reading ${ZIP_PATH}…`);
  const buf = await readFile(ZIP_PATH);
  console.log(`   buffer: ${(buf.length / 1024).toFixed(1)} KB`);

  console.log('🔍 Parsing shapefile (this auto-reprojects from ITM to WGS84)…');
  const gj = (await shp(buf)) as FeatureCollection<Point, LrtProperties>;
  console.log(`   features: ${gj.features.length}`);

  // ── 2. Detect shapefile schema + warn on unknown columns ─────────────────
  let schema: LrtSchemaMode | null = null;
  if (gj.features.length > 0) {
    const sampleKeys = Object.keys(gj.features[0].properties);
    schema = detectLrtSchema(sampleKeys);
    console.log(
      `   schema: ${schema === 'rail_asset' ? 'stations (ASSET_NO / NAME)' : 'entrances (STAT_NAME / ENTRC_LBL)'}`,
    );
    const unknownKeys = sampleKeys.filter((k) => !KNOWN_FIELDS.has(k));
    if (unknownKeys.length > 0) {
      console.warn(`   ⚠ columns not mapped by this script: ${unknownKeys.join(', ')}`);
    }
  }

  // ── 3. Build rows ───────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const rows: MetroStationRow[] = [];
  let skippedNoId = 0;
  let skippedNoName = 0;
  let skippedNoGeom = 0;
  let sourceVersion = today;

  for (const f of gj.features) {
    const { known } = splitProps(f.properties);

    if (!f.geometry || f.geometry.type !== 'Point') {
      skippedNoGeom++;
      continue;
    }
    const [lon, lat] = f.geometry.coordinates;

    if (schema === 'lrt_entrance') {
      const name = entranceDisplayName(known);
      if (!name.trim()) {
        skippedNoName++;
        continue;
      }
      const sid = entranceStationId(known, lon, lat);
      const statusEn = STATUS_MAP[known.STATUS?.trim() ?? ''] ?? 'planned';
      if (known.YEARMONTH && sourceVersion === today) {
        sourceVersion = String(known.YEARMONTH);
      }
      rows.push({
        station_id: sid,
        station_name: name,
        line_id: null,
        status: statusEn,
        geom: `SRID=4326;POINT(${lon} ${lat})`,
        source_url: 'https://data.gov.il/dataset/lrt_stat',
        source_version: sourceVersion,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    // schema === 'rail_asset' (legacy export)
    if (known.ASSET_NO == null) {
      skippedNoId++;
      continue;
    }
    if (!known.NAME || !known.NAME.trim()) {
      skippedNoName++;
      continue;
    }
    const statusEn = STATUS_MAP[known.STATUS?.trim() ?? ''] ?? 'planned';
    if (known.YEARMONTH && sourceVersion === today) {
      sourceVersion = String(known.YEARMONTH);
    }
    rows.push({
      station_id: `${STATION_ID_PREFIX}${Math.round(known.ASSET_NO)}`,
      station_name: known.NAME.trim(),
      line_id: null,
      status: statusEn,
      geom: `SRID=4326;POINT(${lon} ${lat})`,
      source_url: 'https://data.gov.il/dataset/lrt_stat',
      source_version: sourceVersion,
      updated_at: new Date().toISOString(),
    });
  }

  if (skippedNoId > 0) {
    console.warn(
      `   ⚠ skipped ${skippedNoId} rows without ${
        schema === 'lrt_entrance' ? 'stable id' : 'ASSET_NO'
      }`,
    );
  }
  if (skippedNoName > 0) {
    console.warn(
      `   ⚠ skipped ${skippedNoName} rows without ${
        schema === 'lrt_entrance' ? 'STAT_NAME/ENTRC_LBL label' : 'NAME'
      }`,
    );
  }
  if (skippedNoGeom > 0) console.warn(`   ⚠ skipped ${skippedNoGeom} rows without Point geometry`);
  console.log(`✅ Prepared ${rows.length} rows for upsert (version ${sourceVersion})`);

  // Status breakdown
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`   status breakdown: ${JSON.stringify(byStatus)}`);

  // ── 4. Lookup source_id, log start ──────────────────────────────────────
  const { data: sourceRow, error: sourceErr } = await supabase
    .from('data_sources')
    .select('id')
    .eq('name', SOURCE_NAME)
    .single();
  if (sourceErr || !sourceRow) {
    throw new Error(`data_sources row '${SOURCE_NAME}' not found — run 003_lrt_stations_prep.sql first.`);
  }
  const sourceId = sourceRow.id as number;

  const { data: logRow } = await supabase
    .from('update_log')
    .insert({ source_id: sourceId, status: 'running', trigger: 'manual' })
    .select('id')
    .single();
  const logId = (logRow?.id as number | undefined) ?? null;

  // ── 5. Upsert in chunks ─────────────────────────────────────────────────
  console.log('☁️  Upserting to Supabase…');
  try {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('infra_metro_stations')
        .upsert(chunk, { onConflict: 'station_id' });
      if (error) {
        console.error(`   ✗ chunk ${i / CHUNK_SIZE + 1}: ${error.message}`);
        throw error;
      }
      process.stdout.write(
        `   ✓ ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}\r`,
      );
    }
    console.log('');

    // ── 6. Update data_sources ledger ─────────────────────────────────────
    await supabase
      .from('data_sources')
      .update({
        last_checked_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        record_count: rows.length,
        status: 'active',
        metadata: {
          source_crs: 'EPSG:2039',
          target_crs: 'EPSG:4326',
          total_features_in_source: gj.features.length,
          loaded: rows.length,
          version: sourceVersion,
          status_breakdown: byStatus,
        },
      })
      .eq('id', sourceId);

    if (logId) {
      await supabase
        .from('update_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          rows_updated: rows.length,
          notes: `Loaded ${rows.length} LRT stations (version ${sourceVersion})`,
        })
        .eq('id', logId);
    }

    console.log('🎉 Done.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (logId) {
      await supabase
        .from('update_log')
        .update({
          finished_at: new Date().toISOString(),
          status: 'failed',
          error_message: msg,
        })
        .eq('id', logId);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});
