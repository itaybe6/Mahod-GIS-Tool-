/**
 * adapters/vehicleCounts.ts
 * Adapter for vehicle_counts — ספירות תנועה (Vol4 / Tiltan), data.gov.il.
 *
 * Source resource: a yearly ZIP named `Countsvol4_<YYYY>` (e.g. Countsvol4_2020)
 * inside the CKAN dataset `vehicle_counts`. Each ZIP bundles three CSVs:
 *   - vehicletypes.csv  → public.traffic_vehicle_types
 *   - vol4counts.csv    → public.traffic_counts        (one row per count point)
 *   - vol4data.csv      → public.traffic_count_volumes (per arm / vehicle / period)
 *
 * Pipeline (mirrors scripts/seed/seed-traffic-counts.ts so DB rows match):
 *   1. Download the ZIP and unpack in-memory with `fflate`.
 *   2. UPSERT vehicle types (small, idempotent).
 *   3. Filter `vol4counts.csv` to the survey year encoded in the resource
 *      name (e.g. 2020) and UPSERT into `traffic_counts`. ITM (EPSG:2039)
 *      coords are converted client-side via `proj4` to a `SRID=4326;POINT()`
 *      WKT — same approach the existing seed script uses.
 *   4. DELETE existing `traffic_count_volumes` rows for those count_ids
 *      (no natural unique key on volumes — full replacement is safest),
 *      then INSERT volumes filtered by the same count_id allow-list,
 *      capped at MAX_VOLUME_ROWS to stay within Edge memory limits.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate";
import proj4 from "https://esm.sh/proj4";
import { downloadResource, pickResourceByName } from "../ckan.ts";
import type { CkanPackage } from "../ckan.ts";
import type { Adapter, AdapterRunResult } from "../types.ts";

// ─── Tuning ───────────────────────────────────────────────────────────────────

const RESOURCE_NAME = "Countsvol4_2020";
const SOURCE_TAG = "vol4";

/** Max rows we insert into traffic_count_volumes per run (Edge memory cap). */
const MAX_VOLUME_ROWS = 40_000;

/** Batch sizes for Supabase upsert/insert calls. */
const VEHICLE_TYPES_BATCH = 500;
const COUNTS_BATCH = 500;
const VOLUMES_BATCH = 2_000;
const DELETE_IDS_BATCH = 500;

// EPSG:2039 — Israeli Transverse Mercator (ITM). Same definition seed-traffic-counts.ts uses.
proj4.defs(
  "EPSG:2039",
  "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 " +
    "+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 " +
    "+towgs84=-24.0024,-17.1032,-17.8444,-0.33007,-1.85269,1.66969,5.4248 +units=m +no_defs",
);

function itmToWgs84Wkt(x: number, y: number): string {
  const [lon, lat] = proj4("EPSG:2039", "EPSG:4326", [x, y]) as [number, number];
  return `SRID=4326;POINT(${lon} ${lat})`;
}

// ─── Raw / DB row types ───────────────────────────────────────────────────────

interface VehicleTypeCsv {
  code: string;
  name: string;
  maintype: string;
  group: string;
  type: string;
  palestinian: string;
}

interface CountCsv {
  countid: string;
  type: string;
  desc: string;
  date: string;       // DD/MM/YYYY
  start: string;      // HH:MM
  end: string;        // HH:MM
  period: string;     // minutes
  client: string;
  executor: string;
  x: string;          // ITM
  y: string;          // ITM
  arms: string;
  st1: string; az1: string;
  st2: string; az2: string;
  st3: string; az3: string;
  st4: string; az4: string;
  st5: string; az5: string;
  st6: string; az6: string;
}

interface VolumeCsv {
  countid: string;
  fr: string;
  to: string;
  vehtype: string;
  periodstrt: string;
  volume: string;
}

interface VehicleTypeDbRow {
  code: number;
  name: string;
  maintype: string | null;
  group_type: string | null;
  usage_type: string | null;
  palestinian: boolean;
}

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
  x_itm: number;
  y_itm: number;
  geom: string;           // WKT — accepted by PostGIS as a geometry literal
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nullIfEmpty(s: string | undefined | null): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

/** "23/06/2024" → "2024-06-23" (returns null for invalid input) */
function parseHebrewDate(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
}

function yearFromIsoDate(iso: string): number | null {
  const y = parseInt(iso.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** Extracts the survey year from the CKAN resource name `Countsvol4_2020`. */
function yearFromResourceName(name: string): number | null {
  const m = /(\d{4})/.exec(name);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  return Number.isFinite(y) ? y : null;
}

function buildArmsData(row: CountCsv): Array<{ arm: number; name: string; azimuth: number }> | null {
  const arms: Array<{ arm: number; name: string; azimuth: number }> = [];
  for (let i = 1; i <= 6; i++) {
    const name = (row[`st${i}` as keyof CountCsv] ?? "").trim();
    const az = (row[`az${i}` as keyof CountCsv] ?? "").trim();
    if (name && az) {
      const azNum = parseFloat(az);
      if (Number.isFinite(azNum)) {
        arms.push({ arm: i, name, azimuth: azNum });
      }
    }
  }
  return arms.length > 0 ? arms : null;
}

// ─── CSV parsing (Deno-safe, no deps) ─────────────────────────────────────────

function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv<T extends Record<string, string>>(text: string): T[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim().length === 0) continue;
    const values = splitCsvLine(line);
    // Vol4 CSVs occasionally contain malformed rows. Pad missing trailing
    // columns and ignore extras instead of dropping the line.
    const row = {} as Record<string, string>;
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row as T);
  }

  return rows;
}

// ─── ZIP entry lookup (case-insensitive, basename match) ─────────────────────

function findZipEntry(
  zip: Record<string, Uint8Array>,
  filename: string,
): Uint8Array {
  const target = filename.toLowerCase();
  for (const path of Object.keys(zip)) {
    const base = path.split("/").pop() ?? path;
    if (base.toLowerCase() === target) return zip[path]!;
  }
  const available = Object.keys(zip).join(", ");
  throw new Error(`File "${filename}" not found in ZIP. Available: ${available}`);
}

// ─── DB writers ───────────────────────────────────────────────────────────────

async function upsertVehicleTypes(
  db: SupabaseClient,
  rows: VehicleTypeDbRow[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += VEHICLE_TYPES_BATCH) {
    const chunk = rows.slice(i, i + VEHICLE_TYPES_BATCH);
    const { error, count } = await db
      .from("traffic_vehicle_types")
      .upsert(chunk, { onConflict: "code", count: "exact" });
    if (error) throw new Error(`vehicle_types upsert failed: ${error.message}`);
    total += count ?? chunk.length;
  }
  return total;
}

async function upsertCounts(
  db: SupabaseClient,
  rows: CountDbRow[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += COUNTS_BATCH) {
    const chunk = rows.slice(i, i + COUNTS_BATCH);
    const { error, count } = await db
      .from("traffic_counts")
      .upsert(chunk, { onConflict: "count_id", count: "exact" });
    if (error) throw new Error(`traffic_counts upsert failed at row ${i}: ${error.message}`);
    total += count ?? chunk.length;
  }
  return total;
}

async function deleteExistingVolumes(
  db: SupabaseClient,
  countIds: number[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < countIds.length; i += DELETE_IDS_BATCH) {
    const ids = countIds.slice(i, i + DELETE_IDS_BATCH);
    const { error, count } = await db
      .from("traffic_count_volumes")
      .delete({ count: "exact" })
      .in("count_id", ids);
    if (error) throw new Error(`volume delete failed: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function insertVolumes(
  db: SupabaseClient,
  rows: VolumeDbRow[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += VOLUMES_BATCH) {
    const chunk = rows.slice(i, i + VOLUMES_BATCH);
    const { error } = await db.from("traffic_count_volumes").insert(chunk);
    if (error) throw new Error(`volume insert failed at ~${total}: ${error.message}`);
    total += chunk.length;
  }
  return total;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

const vehicleCountsAdapter: Adapter = {
  primaryResourceName: RESOURCE_NAME,

  async run(pkg: CkanPackage, db: SupabaseClient, sourceVersion: string): Promise<AdapterRunResult> {
    const resource = pickResourceByName(pkg, RESOURCE_NAME);
    const surveyYear = yearFromResourceName(resource.name);
    const sourceTag = `${SOURCE_TAG}@${sourceVersion}`;

    console.log(
      `[traffic_counts] Downloading ZIP ${resource.name} (year=${surveyYear ?? "?"}): ${resource.url}`,
    );
    const zipBuffer = await downloadResource(resource);
    const zip = unzipSync(new Uint8Array(zipBuffer));

    // ── 1. Vehicle types ────────────────────────────────────────────────
    const vehicleTypesText = decodeUtf8(findZipEntry(zip, "vehicletypes.csv"));
    const vehicleTypeRows: VehicleTypeDbRow[] = [];
    for (const r of parseCsv<VehicleTypeCsv>(vehicleTypesText)) {
      const code = parseInt(r.code, 10);
      if (!Number.isFinite(code)) continue;
      vehicleTypeRows.push({
        code,
        name: (r.name ?? "").trim(),
        maintype: nullIfEmpty(r.maintype),
        group_type: nullIfEmpty(r.group),
        usage_type: nullIfEmpty(r.type),
        palestinian: (r.palestinian ?? "").trim() === "כן",
      });
    }
    const vtUpserted = await upsertVehicleTypes(db, vehicleTypeRows);
    console.log(`[traffic_counts] vehicle types upserted: ${vtUpserted}`);

    // ── 2. Counts (filtered to surveyYear if known) ─────────────────────
    const countsText = decodeUtf8(findZipEntry(zip, "vol4counts.csv"));
    const countRows: CountDbRow[] = [];
    let skippedCoords = 0;
    let skippedYear = 0;

    for (const r of parseCsv<CountCsv>(countsText)) {
      const x = parseFloat(r.x);
      const y = parseFloat(r.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        skippedCoords++;
        continue;
      }

      const countDate = parseHebrewDate(r.date);
      if (!countDate) {
        skippedCoords++;
        continue;
      }
      if (surveyYear !== null && yearFromIsoDate(countDate) !== surveyYear) {
        skippedYear++;
        continue;
      }

      const countId = parseInt(r.countid, 10);
      if (!Number.isFinite(countId)) continue;

      countRows.push({
        count_id:    countId,
        count_type:  (r.type ?? "").trim(),
        description: (r.desc ?? "").trim(),
        count_date:  countDate,
        start_time:  nullIfEmpty(r.start),
        end_time:    nullIfEmpty(r.end),
        period_min:  r.period ? (parseInt(r.period, 10) || null) : null,
        client:      nullIfEmpty(r.client),
        executor:    nullIfEmpty(r.executor),
        arms_count:  r.arms ? (parseInt(r.arms, 10) || null) : null,
        arms_data:   buildArmsData(r),
        x_itm:       x,
        y_itm:       y,
        geom:        itmToWgs84Wkt(x, y),
        source:      sourceTag,
      });
    }

    const countIds = countRows.map((r) => r.count_id);
    const countsUpserted = await upsertCounts(db, countRows);
    console.log(
      `[traffic_counts] counts upserted: ${countsUpserted}` +
        ` (skipped ${skippedCoords} bad coords, ${skippedYear} other years)`,
    );

    // ── 3. Volumes (filtered to count_ids, capped at MAX_VOLUME_ROWS) ───
    const volumesDeleted = await deleteExistingVolumes(db, countIds);
    console.log(`[traffic_counts] existing volume rows cleared: ${volumesDeleted}`);

    const allowed = new Set(countIds);
    const volumesText = decodeUtf8(findZipEntry(zip, "vol4data.csv"));
    const volumeRows: VolumeDbRow[] = [];
    let capReached = false;

    for (const r of parseCsv<VolumeCsv>(volumesText)) {
      if (volumeRows.length >= MAX_VOLUME_ROWS) {
        capReached = true;
        break;
      }
      const countId = parseInt(r.countid, 10);
      if (!allowed.has(countId)) continue;

      const fromArm = parseInt(r.fr, 10);
      const toArm = parseInt(r.to, 10);
      const volume = parseInt(r.volume, 10);
      const periodStart = (r.periodstrt ?? "").trim();

      if (
        !Number.isFinite(fromArm) ||
        !Number.isFinite(toArm) ||
        !Number.isFinite(volume) ||
        !periodStart
      ) {
        continue;
      }

      volumeRows.push({
        count_id:     countId,
        from_arm:     fromArm,
        to_arm:       toArm,
        vehicle_type: (r.vehtype ?? "").trim(),
        period_start: periodStart,
        volume,
      });
    }

    const volumesInserted = await insertVolumes(db, volumeRows);
    console.log(
      `[traffic_counts] volume rows inserted: ${volumesInserted}` +
        (capReached ? ` (stopped at ${MAX_VOLUME_ROWS} cap)` : ""),
    );

    // Aggregate report. Supabase JS upsert can't distinguish insert vs
    // update, so we bucket vehicle_types + counts as inserted and report
    // the previously-cleared volume rows as deleted.
    const notesParts: string[] = [
      `${vtUpserted} vehicle_types`,
      `${countsUpserted} counts`,
      `${volumesInserted} volumes`,
    ];
    if (capReached) notesParts.push(`volume cap=${MAX_VOLUME_ROWS}`);
    if (surveyYear !== null) notesParts.push(`year=${surveyYear}`);

    return {
      inserted: vtUpserted + countsUpserted + volumesInserted,
      updated: 0,
      deleted: volumesDeleted,
      notes: notesParts.join(", "),
    };
  },
};

export default vehicleCountsAdapter;
