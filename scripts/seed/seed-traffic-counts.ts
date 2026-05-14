/**
 * Seed script: Traffic Counts (Vol4) → Supabase
 *
 * Source: countsvol4_*.zip from data.gov.il (Tiltan traffic counts database)
 * Tables: traffic_vehicle_types, traffic_counts, traffic_count_volumes
 *
 * Strategy:
 *   - vehicle_types: UPSERT (rarely changes)
 *   - counts:        UPSERT by count_id (only rows with count_date in VOLUME_SURVEY_YEAR)
 *   - volumes:       DELETE existing for affected count_ids, then bulk INSERT
 *                    (no natural unique key — full replacement per count is safest)
 *
 * Year filter: only survey dates in VOLUME_SURVEY_YEAR (default 2025) are loaded into
 * `traffic_counts` / `traffic_count_volumes`. Volume rows are capped at MAX_VOLUME_ROWS.
 *
 * Run:  tsx scripts/seed/seed-traffic-counts.ts
 *   or: node scripts/check-sql-parens.mjs --seed-traffic-counts   (from mahod-gis/)
 */

import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse';
import * as unzipper from 'unzipper';
import WebSocket from 'ws';
import 'dotenv/config';

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────

const INPUT_DIR        = 'input';
const ZIP_PATTERN      = /^countsvol4_.*\.zip$/i;
const VOLUMES_BATCH    = 5_000;   // rows per insert call
const COUNTS_BATCH     = 500;
const SOURCE_TAG       = 'vol4';

/** Only counts with count_date in this calendar year get upserted; volumes load for those ids only. */
const VOLUME_SURVEY_YEAR = 2025;
/** Hard cap on rows inserted into traffic_count_volumes (per run). */
const MAX_VOLUME_ROWS    = 40_000;

const SUPABASE_URL     = process.env.SUPABASE_URL!;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
});

// ────────────────────────────────────────────────────────────
// Types matching the CSV files
// ────────────────────────────────────────────────────────────

interface VehicleTypeRow {
  code: string;
  name: string;
  maintype: string;
  group: string;        // 'group' is a SQL keyword — mapped to group_type
  type: string;         // mapped to usage_type
  palestinian: string;  // 'כן' / 'לא'
}

interface CountRow {
  countid: string;
  type: string;         // צומת / קטע
  desc: string;
  date: string;         // DD/MM/YYYY
  start: string;        // HH:MM
  end: string;          // HH:MM
  period: string;       // minutes (e.g. "15")
  client: string;
  executor: string;
  x: string;            // ITM
  y: string;            // ITM
  arms: string;         // 1-6
  st1: string; az1: string;
  st2: string; az2: string;
  st3: string; az3: string;
  st4: string; az4: string;
  st5: string; az5: string;
  st6: string; az6: string;
  comments: string;
}

interface DataRow {
  countid: string;
  fr: string;
  to: string;
  vehtype: string;
  periodstrt: string;   // HH:MM
  volume: string;
}

// DB row shapes
interface CountDbRow {
  count_id: number;
  count_type: string;
  description: string;
  count_date: string;     // ISO YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  period_min: number | null;
  client: string | null;
  executor: string | null;
  arms_count: number | null;
  arms_data: Array<{ arm: number; name: string; azimuth: number }> | null;
  comments: string | null;
  x_itm: number;
  y_itm: number;
  geom: string;           // WKT — converted server-side via SQL function
  source: string;
}

interface VolumeDbRow {
  count_id: number;
  from_arm: number;
  to_arm: number;
  vehicle_type: string;
  period_start: string;
  volume: number;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** "23/06/2024" → "2024-06-23" */
function parseHebrewDate(s: string): string {
  const [d, m, y] = s.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function surveyYearFromIsoDate(iso: string): number {
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : NaN;
}

/** Build arms_data JSONB from st1/az1 ... st6/az6 */
function buildArmsData(row: CountRow): Array<{ arm: number; name: string; azimuth: number }> {
  const arms: Array<{ arm: number; name: string; azimuth: number }> = [];
  for (let i = 1; i <= 6; i++) {
    const name = row[`st${i}` as keyof CountRow];
    const az = row[`az${i}` as keyof CountRow];
    if (name && az && name.trim() !== '' && az.trim() !== '') {
      arms.push({ arm: i, name: name.trim(), azimuth: parseFloat(az) });
    }
  }
  return arms;
}

function nullIfEmpty(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

/** ITM (EPSG:2039) X,Y → WKT POINT in WGS84.
 *  We pass the ITM coordinates as a WKT and rely on the DB to transform.
 *  The geom column is GEOMETRY(Point, 4326), so we use ST_Transform via the
 *  itm_to_wgs84() helper function defined in the schema.
 *
 *  In practice, the Supabase REST API doesn't run arbitrary SQL on insert,
 *  so we wrap the insert in an RPC call OR pre-transform here. For simplicity
 *  and correctness we use proj4 client-side. */
import proj4 from 'proj4';

// EPSG:2039 — Israeli Transverse Mercator (ITM)
proj4.defs(
  'EPSG:2039',
  '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 ' +
  '+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 ' +
  '+towgs84=-24.0024,-17.1032,-17.8444,-0.33007,-1.85269,1.66969,5.4248 +units=m +no_defs',
);

function itmToWgs84Wkt(x: number, y: number): string {
  const [lon, lat] = proj4('EPSG:2039', 'EPSG:4326', [x, y]);
  // PostGIS expects "SRID=4326;POINT(lon lat)" or a plain WKT (we'll cast on insert)
  return `SRID=4326;POINT(${lon} ${lat})`;
}

// ────────────────────────────────────────────────────────────
// Find ZIP
// ────────────────────────────────────────────────────────────

async function findZipFile(): Promise<string> {
  const files = await readdir(INPUT_DIR);
  const match = files.find((f) => ZIP_PATTERN.test(f));
  if (!match) {
    throw new Error(`No file matching ${ZIP_PATTERN} found in ${INPUT_DIR}/`);
  }
  return join(INPUT_DIR, match);
}

// ────────────────────────────────────────────────────────────
// Read a CSV entry from the zip and yield rows
// ────────────────────────────────────────────────────────────

async function* streamCsvFromZip<T = Record<string, string>>(
  zipPath: string,
  fileName: string,
): AsyncGenerator<T> {
  const directory = await unzipper.Open.file(zipPath);
  const entry = directory.files.find((f) => f.path === fileName);
  if (!entry) throw new Error(`${fileName} not found in zip`);

  const stream = entry.stream();
  const parser = parse({
    columns: true,
    bom: true,
    relax_quotes: true,
    skip_empty_lines: true,
    // Some bytes in vol4counts.csv are corrupt — relax
    relax_column_count: true,
  });

  stream.pipe(parser);

  for await (const record of parser) {
    yield record as T;
  }
}

// ────────────────────────────────────────────────────────────
// 1. Seed vehicle types (small file, load all at once)
// ────────────────────────────────────────────────────────────

async function seedVehicleTypes(zipPath: string): Promise<void> {
  console.log('▸ Seeding traffic_vehicle_types…');
  const rows: Array<{
    code: number;
    name: string;
    maintype: string | null;
    group_type: string | null;
    usage_type: string | null;
    palestinian: boolean;
  }> = [];

  for await (const r of streamCsvFromZip<VehicleTypeRow>(zipPath, 'vehicletypes.csv')) {
    rows.push({
      code:        parseInt(r.code, 10),
      name:        r.name.trim(),
      maintype:    nullIfEmpty(r.maintype),
      group_type:  nullIfEmpty(r.group),
      usage_type:  nullIfEmpty(r.type),
      palestinian: r.palestinian.trim() === 'כן',
    });
  }

  const { error } = await supabase
    .from('traffic_vehicle_types')
    .upsert(rows, { onConflict: 'code' });

  if (error) throw new Error(`vehicle_types upsert failed: ${error.message}`);
  console.log(`  ✓ ${rows.length} vehicle types upserted`);
}

// ────────────────────────────────────────────────────────────
// 2. Seed counts (4.5K rows — buffer fully then upsert in batches)
// ────────────────────────────────────────────────────────────

async function seedCounts(zipPath: string): Promise<number[]> {
  console.log(`▸ Seeding traffic_counts (survey year ${VOLUME_SURVEY_YEAR} only)…`);
  const all: CountDbRow[] = [];
  let skipped = 0;
  let skippedYear = 0;

  for await (const r of streamCsvFromZip<CountRow>(zipPath, 'vol4counts.csv')) {
    const x = parseFloat(r.x);
    const y = parseFloat(r.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      skipped++;
      continue;
    }

    const countDate = parseHebrewDate(r.date);
    if (surveyYearFromIsoDate(countDate) !== VOLUME_SURVEY_YEAR) {
      skippedYear++;
      continue;
    }

    all.push({
      count_id:     parseInt(r.countid, 10),
      count_type:   r.type.trim(),
      description:  r.desc.trim(),
      count_date:   countDate,
      start_time:   nullIfEmpty(r.start),
      end_time:     nullIfEmpty(r.end),
      period_min:   r.period ? parseInt(r.period, 10) : null,
      client:       nullIfEmpty(r.client),
      executor:     nullIfEmpty(r.executor),
      arms_count:   r.arms ? parseInt(r.arms, 10) : null,
      arms_data:    buildArmsData(r),
      comments:     nullIfEmpty(r.comments),
      x_itm:        x,
      y_itm:        y,
      geom:         itmToWgs84Wkt(x, y),
      source:       SOURCE_TAG,
    });
  }

  // batched upsert
  let inserted = 0;
  for (let i = 0; i < all.length; i += COUNTS_BATCH) {
    const chunk = all.slice(i, i + COUNTS_BATCH);
    const { error } = await supabase
      .from('traffic_counts')
      .upsert(chunk, { onConflict: 'count_id' });
    if (error) throw new Error(`counts upsert failed at row ${i}: ${error.message}`);
    inserted += chunk.length;
    process.stdout.write(`  ${inserted}/${all.length}\r`);
  }
  const parts = [`${inserted} counts upserted`];
  if (skipped) parts.push(`${skipped} skipped (bad coords)`);
  if (skippedYear) parts.push(`${skippedYear} skipped (other years)`);
  console.log(`  ✓ ${parts.join(', ')}`);

  return all.map((c) => c.count_id);
}

// ────────────────────────────────────────────────────────────
// 3. Seed volumes (large CSV — streaming, batched inserts)
//    Only rows whose count_id is in `countIds` (survey year filter). Hard-capped
//    at MAX_VOLUME_ROWS. Delete existing volumes for those count_ids first.
// ────────────────────────────────────────────────────────────

async function seedVolumes(zipPath: string, countIds: number[]): Promise<void> {
  const allowed = new Set(countIds);
  console.log(
    `▸ Seeding traffic_count_volumes (count_ids in survey year ${VOLUME_SURVEY_YEAR}, ` +
      `max ${MAX_VOLUME_ROWS.toLocaleString()} rows)…`,
  );

  if (countIds.length === 0) {
    console.log('  • No count_ids for this year — skipping volume delete/insert.');
    return;
  }

  // Step A — clear existing rows for the count_ids we're loading.
  // Done in chunks because IN-lists have a size limit.
  console.log('  • Clearing existing volumes for upcoming count_ids…');
  const DEL_CHUNK = 500;
  for (let i = 0; i < countIds.length; i += DEL_CHUNK) {
    const ids = countIds.slice(i, i + DEL_CHUNK);
    const { error } = await supabase
      .from('traffic_count_volumes')
      .delete()
      .in('count_id', ids);
    if (error) throw new Error(`volume delete failed: ${error.message}`);
  }

  // Step B — stream-insert in batches (only rows whose count_id is in `allowed`, capped).
  console.log('  • Inserting fresh volume rows…');
  let buf: VolumeDbRow[] = [];
  let total = 0;

  /** Flush in chunks of up to VOLUMES_BATCH until buffer empty or row limit reached. */
  async function flushChunks(): Promise<'ok' | 'full'> {
    while (buf.length > 0) {
      const room = MAX_VOLUME_ROWS - total;
      if (room <= 0) {
        buf = [];
        return 'full';
      }
      const n = Math.min(buf.length, VOLUMES_BATCH, room);
      const chunk = buf.slice(0, n);
      buf = buf.slice(n);
      const { error } = await supabase.from('traffic_count_volumes').insert(chunk);
      if (error) throw new Error(`volume insert failed at ~${total}: ${error.message}`);
      total += chunk.length;
      if (total >= MAX_VOLUME_ROWS) {
        buf = [];
        return 'full';
      }
    }
    return 'ok';
  }

  for await (const r of streamCsvFromZip<DataRow>(zipPath, 'vol4data.csv')) {
    if (total >= MAX_VOLUME_ROWS) break;
    const countId = parseInt(r.countid, 10);
    if (!allowed.has(countId)) continue;

    buf.push({
      count_id:     countId,
      from_arm:     parseInt(r.fr, 10),
      to_arm:       parseInt(r.to, 10),
      vehicle_type: r.vehtype.trim(),
      period_start: r.periodstrt.trim(),
      volume:       parseInt(r.volume, 10),
    });

    if (buf.length >= VOLUMES_BATCH) {
      const st = await flushChunks();
      if (st === 'full') break;
      if (total > 0 && total % 10_000 === 0) {
        process.stdout.write(`  ${total.toLocaleString()} rows\r`);
      }
    }
  }
  if (total < MAX_VOLUME_ROWS) {
    await flushChunks();
  }
  const capMsg =
    total >= MAX_VOLUME_ROWS ? ` (stopped at ${MAX_VOLUME_ROWS.toLocaleString()} row limit)` : '';
  console.log(`  ✓ ${total.toLocaleString()} volume rows inserted${capMsg}`);
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  const zipPath = await findZipFile();
  console.log(`📦 Source: ${zipPath}\n`);

  await seedVehicleTypes(zipPath);
  const countIds = await seedCounts(zipPath);
  await seedVolumes(zipPath, countIds);

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${secs}s`);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
