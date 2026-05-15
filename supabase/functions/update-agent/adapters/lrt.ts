/**
 * adapters/lrt.ts
 * Adapter for lrt_stat — תחנות / כניסות הרכבת הקלה.
 *
 * Source dataset: data_sources.name = "lrt"
 * CKAN resources used:
 *   - LRT_STAT_CSV — attributes, used for change detection and metadata merge
 *   - LRT_STAT_SHP — point geometry + attributes, parsed from ZIP with shpjs
 *
 * Target table: public.infra_metro_stations
 * UPSERT key: station_id  (TEXT — prefixed with "lrt_" so it never collides
 *             with future metro IDs in the same table)
 *
 * הסכמה של data.gov.il משתנה מגרסה לגרסה. אנחנו תומכים בשתי הצורות שראינו:
 *   1. "rail_asset"   — שדות ASSET_NO + NAME (כמו ב-rail_stat).
 *   2. "lrt_entrance" — שדות STAT_NAME + ENTRC_LBL (כניסות לתחנה).
 * ב-entrances אין מזהה יציב, אז אנחנו גוזרים מזהה דטרמיניסטי מ-SHA-256 של
 * (LINE | STAT_NAME | ENTRC_LBL | lon | lat) כדי שאותה כניסה תקבל את אותו
 * station_id בכל ריצה — וכך ה-UPSERT לא ייצור כפילויות.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import shp from "https://esm.sh/shpjs";
import proj4 from "https://esm.sh/proj4";
import { downloadResource, downloadResourceAsText, pickResourceByName } from "../ckan.ts";
import type { CkanPackage } from "../ckan.ts";
import type { Adapter, AdapterRunResult } from "../types.ts";

const CSV_RESOURCE_NAME = "LRT_STAT_CSV";
const SHP_RESOURCE_NAME = "LRT_STAT_SHP";
const DATASET_URL = "https://data.gov.il/he/datasets/ministry_of_transport/lrt_stat";
const BATCH_SIZE = 100;
const STATION_ID_PREFIX = "lrt_";

type StationStatus = "operational" | "under_construction" | "planned";
type SchemaMode = "rail_asset" | "lrt_entrance";

const STATUS_MAP: Record<string, StationStatus> = {
  קיימת: "operational",
  בבניה: "under_construction",
  בתכנון: "planned",
};

interface RawCsvRow {
  [key: string]: string;
}

interface ShpFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
  properties?: Record<string, unknown> | null;
}

interface ShpFeatureCollection {
  type?: string;
  features?: ShpFeature[];
}

/** Matches `infra_metro_stations` schema (no metadata / is_active columns). */
interface MetroStationDbRow {
  station_id: string;
  station_name: string;
  line_id: string | null;
  status: StationStatus;
  geom: string;
  source_url: string;
  source_version: string;
  updated_at: string;
}

// EPSG:2039 — Israeli Transverse Mercator. Used as a fallback if shpjs returns
// raw ITM coordinates instead of reprojected WGS84.
proj4.defs(
  "EPSG:2039",
  "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 " +
    "+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs",
);

// ─── CSV parsing (same Deno-safe parser as railway.ts) ────────────────────────

function parseCsv(text: string): RawCsvRow[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!).map((h) => h.trim());
  const rows: RawCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]!);
    const row: RawCsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
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

function assertCsvText(text: string, url: string): void {
  const preview = text.slice(0, 120).replace(/\s+/g, " ");
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    throw new Error(
      `LRT_STAT_CSV download returned HTML instead of CSV (${url}). ` +
        `Preview: ${JSON.stringify(preview)}`,
    );
  }
  // ה-CSV של lrt_stat יכול לכלול ASSET_NO (סכמת תחנות) או STAT_NAME (כניסות).
  // אם אין אף אחד מהם — סימן שהורדנו את הקובץ הלא נכון.
  const header = text.slice(0, 1000);
  if (!/ASSET_NO/i.test(header) && !/STAT_NAME/i.test(header)) {
    throw new Error(
      `LRT_STAT_CSV does not look like the expected lrt_stat.csv (${url}). ` +
        `Preview: ${JSON.stringify(preview)}`,
    );
  }
}

function assertZip(buffer: ArrayBuffer, url: string): void {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return;

  const preview = new TextDecoder("utf-8")
    .decode(bytes.slice(0, 120))
    .replace(/\s+/g, " ");
  throw new Error(
    `LRT_STAT_SHP download did not return a ZIP (${url}). ` +
      `Preview: ${JSON.stringify(preview)}`,
  );
}

// ─── Generic property accessors (case-insensitive) ────────────────────────────

function prop(
  obj: Record<string, unknown> | RawCsvRow | null | undefined,
  key: string,
): unknown {
  if (!obj) return undefined;
  const found = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
  return found ? obj[found] : undefined;
}

function stringProp(
  obj: Record<string, unknown> | RawCsvRow | null | undefined,
  key: string,
): string {
  const value = prop(obj, key);
  return value == null ? "" : String(value).trim();
}

function numberProp(
  obj: Record<string, unknown> | RawCsvRow | null | undefined,
  key: string,
): number | null {
  const value = stringProp(obj, key);
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ─── Schema detection + helpers ───────────────────────────────────────────────

function detectSchema(features: ShpFeature[]): SchemaMode {
  const sample = features.find((f) => f.properties && Object.keys(f.properties).length > 0);
  const keys = sample?.properties ? Object.keys(sample.properties).map((k) => k.toUpperCase()) : [];
  const has = (k: string) => keys.includes(k);

  if (has("ASSET_NO") && has("NAME")) return "rail_asset";
  if (has("STAT_NAME")) return "lrt_entrance";

  throw new Error(
    `Unrecognized LRT_STAT shapefile columns. Expected (ASSET_NO + NAME) or STAT_NAME. ` +
      `Got: ${keys.join(", ") || "<empty>"}`,
  );
}

function buildCsvByAssetNo(rows: RawCsvRow[]): Map<number, RawCsvRow> {
  const map = new Map<number, RawCsvRow>();
  for (const row of rows) {
    const assetNo = numberProp(row, "ASSET_NO");
    if (assetNo !== null && assetNo > 0) {
      map.set(Math.round(assetNo), row);
    }
  }
  return map;
}

function toWgs84(coords: [number, number]): [number, number] {
  const [x, y] = coords;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y];
  return proj4("EPSG:2039", "EPSG:4326", coords) as [number, number];
}

function sourceVersionFrom(
  props: Record<string, unknown>,
  csvRow: RawCsvRow | undefined,
  fallback: string,
): string {
  const yearMonth = stringProp(csvRow, "YEARMONTH") || stringProp(props, "YEARMONTH");
  return yearMonth || fallback;
}

// ─── Deterministic ID for "entrance" schema rows ──────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function entranceStationId(
  props: Record<string, unknown>,
  lon: number,
  lat: number,
): Promise<string> {
  const raw = [
    stringProp(props, "LINE"),
    stringProp(props, "STAT_NAME"),
    stringProp(props, "ENTRC_LBL"),
    lon.toFixed(6),
    lat.toFixed(6),
  ].join("|");
  const h = (await sha256Hex(raw)).slice(0, 20);
  return `${STATION_ID_PREFIX}e_${h}`;
}

function entranceDisplayName(props: Record<string, unknown>): string {
  const stat = stringProp(props, "STAT_NAME");
  const lbl = stringProp(props, "ENTRC_LBL");
  if (stat && lbl) return `${stat} · ${lbl}`;
  return stat || lbl || "";
}

// ─── Row mapping ──────────────────────────────────────────────────────────────

interface MapContext {
  schema: SchemaMode;
  csvByAssetNo: Map<number, RawCsvRow>;
  sourceVersionFallback: string;
}

async function toDbRow(
  feature: ShpFeature,
  ctx: MapContext,
): Promise<MetroStationDbRow | null> {
  const props = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates)) return null;

  const rawX = Number(coordinates[0]);
  const rawY = Number(coordinates[1]);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const [lon, lat] = toWgs84([rawX, rawY]);
  const now = new Date().toISOString();

  if (ctx.schema === "lrt_entrance") {
    const stationName = entranceDisplayName(props);
    if (!stationName) return null;

    const statusHe = stringProp(props, "STATUS");
    const status = STATUS_MAP[statusHe] ?? "planned";
    const sourceVersion = sourceVersionFrom(props, undefined, ctx.sourceVersionFallback);
    const lineId = stringProp(props, "LINE") || null;

    return {
      station_id: await entranceStationId(props, lon, lat),
      station_name: stationName,
      line_id: lineId,
      status,
      geom: `SRID=4326;POINT(${lon} ${lat})`,
      source_url: DATASET_URL,
      source_version: sourceVersion,
      updated_at: now,
    };
  }

  // schema === "rail_asset"
  const assetNo = numberProp(props, "ASSET_NO");
  if (assetNo === null || assetNo <= 0) return null;

  const csvRow = ctx.csvByAssetNo.get(Math.round(assetNo));
  const stationName = stringProp(csvRow, "NAME") || stringProp(props, "NAME");
  if (!stationName) return null;

  const statusHe = stringProp(csvRow, "STATUS") || stringProp(props, "STATUS");
  const status = STATUS_MAP[statusHe] ?? "planned";
  const sourceVersion = sourceVersionFrom(props, csvRow, ctx.sourceVersionFallback);
  const lineId =
    stringProp(csvRow, "KAV_CODE") ||
    stringProp(props, "KAV_CODE") ||
    null;

  return {
    station_id: `${STATION_ID_PREFIX}${Math.round(assetNo)}`,
    station_name: stationName,
    line_id: lineId,
    status,
    geom: `SRID=4326;POINT(${lon} ${lat})`,
    source_url: DATASET_URL,
    source_version: sourceVersion,
    updated_at: now,
  };
}

// ─── Shapefile parsing + DB write ─────────────────────────────────────────────

async function parseShapefile(buffer: ArrayBuffer): Promise<ShpFeature[]> {
  const parsed = await shp(buffer);
  const collection = Array.isArray(parsed) ? parsed[0] : parsed;
  const features = (collection as ShpFeatureCollection | undefined)?.features;
  return Array.isArray(features) ? features : [];
}

async function upsertLrtStations(
  db: SupabaseClient,
  rows: MetroStationDbRow[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await db
      .from("infra_metro_stations")
      .upsert(chunk, {
        onConflict: "station_id",
        count: "exact",
      });

    if (error) {
      throw new Error(`lrt stations upsert failed at row ${i}: ${error.message}`);
    }
    total += count ?? chunk.length;
  }
  return total;
}

/**
 * אם הסכמה היא "lrt_entrance" יש בדרך כלל הרבה שורות עם אותו station_id
 * חזרה (כשהקובץ מ-CKAN רץ עם נקודות שונות אך מטא־דאטה זהה) — אנחנו מבטלים
 * כפילויות בתוך אותו batch כדי שה-UPSERT לא ייכשל עם:
 *   "ON CONFLICT DO UPDATE command cannot affect row a second time"
 */
function dedupeByStationId(rows: MetroStationDbRow[]): MetroStationDbRow[] {
  const map = new Map<string, MetroStationDbRow>();
  for (const row of rows) {
    map.set(row.station_id, row);
  }
  return Array.from(map.values());
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

const lrtAdapter: Adapter = {
  primaryResourceName: CSV_RESOURCE_NAME,

  async run(pkg: CkanPackage, db: SupabaseClient, sourceVersion: string): Promise<AdapterRunResult> {
    const csvResource = pickResourceByName(pkg, CSV_RESOURCE_NAME);
    const shpResource = pickResourceByName(pkg, SHP_RESOURCE_NAME);

    console.log(`[lrt] Downloading CSV: ${csvResource.url}`);
    const csvText = await downloadResourceAsText(csvResource);
    assertCsvText(csvText, csvResource.url);
    const csvRows = parseCsv(csvText);
    const csvByAssetNo = buildCsvByAssetNo(csvRows);
    console.log(`[lrt] Parsed ${csvRows.length} CSV rows`);

    console.log(`[lrt] Downloading SHP ZIP: ${shpResource.url}`);
    const shpBuffer = await downloadResource(shpResource);
    assertZip(shpBuffer, shpResource.url);
    const features = await parseShapefile(shpBuffer);
    if (features.length === 0) {
      throw new Error("LRT_STAT_SHP parsed but contained zero features");
    }

    const schema = detectSchema(features);
    console.log(`[lrt] Schema detected: ${schema} (${features.length} features)`);

    const ctx: MapContext = {
      schema,
      csvByAssetNo,
      sourceVersionFallback: sourceVersion,
    };

    const rows: MetroStationDbRow[] = [];
    let skipped = 0;
    for (const feature of features) {
      const row = await toDbRow(feature, ctx);
      if (row) {
        rows.push(row);
      } else {
        skipped++;
      }
    }

    const deduped = dedupeByStationId(rows);
    const dupes = rows.length - deduped.length;

    if (deduped.length === 0) {
      throw new Error("LRT_STAT_SHP parsed but no valid LRT station rows were produced");
    }

    console.log(
      `[lrt] Upserting ${deduped.length} stations ` +
        `(${skipped} skipped, ${dupes} duplicate station_ids merged)`,
    );
    const upserted = await upsertLrtStations(db, deduped);

    return {
      inserted: upserted,
      updated: 0,
      notes:
        `schema=${schema}; ${deduped.length} stations from ${features.length} SHP features, ` +
        `${csvRows.length} CSV rows; ${skipped} skipped, ${dupes} duplicate IDs merged; ` +
        `SHP=${shpResource.url}`,
    };
  },
};

export default lrtAdapter;
