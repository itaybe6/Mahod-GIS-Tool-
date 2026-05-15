/**
 * adapters/railway.ts
 * Adapter for rail_stat — תחנות רכבת כבדה / Israel Railways stations.
 *
 * Source dataset: data_sources.name = "railway"
 * CKAN resources used:
 *   - RAIL_STAT_CSV — attributes, used for change detection and metadata merge
 *   - RAIL_STAT_SHP — point geometry + attributes, parsed from ZIP with shpjs
 *
 * Target table: public.infra_railway_stations
 * UPSERT key: station_id (mapped from ASSET_NO)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import shp from "https://esm.sh/shpjs";
import proj4 from "https://esm.sh/proj4";
import { downloadResource, downloadResourceAsText, pickResourceByName } from "../ckan.ts";
import type { CkanPackage } from "../ckan.ts";
import type { Adapter, AdapterRunResult } from "../types.ts";

const CSV_RESOURCE_NAME = "RAIL_STAT_CSV";
const SHP_RESOURCE_NAME = "RAIL_STAT_SHP";
const DATASET_URL = "https://data.gov.il/he/datasets/ministry_of_transport/rail_stat";
const BATCH_SIZE = 100;

type StationStatus = "operational" | "under_construction" | "planned";

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

interface RailwayDbRow {
  station_id: number;
  station_name: string;
  is_active: boolean;
  status: StationStatus;
  geom: string;
  source_url: string;
  source_version: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

// EPSG:2039 — Israeli Transverse Mercator (ITM). Used only if shpjs returns
// raw ITM coordinates instead of reprojected WGS84.
proj4.defs(
  "EPSG:2039",
  "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 " +
    "+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs",
);

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

function assertCsvText(text: string, url: string): void {
  const preview = text.slice(0, 120).replace(/\s+/g, " ");
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    throw new Error(
      `RAIL_STAT_CSV download returned HTML instead of CSV (${url}). ` +
        `Preview: ${JSON.stringify(preview)}`,
    );
  }
  if (!/ASSET_NO/i.test(text.slice(0, 500))) {
    throw new Error(
      `RAIL_STAT_CSV does not look like the expected rail_stat.csv (${url}). ` +
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
    `RAIL_STAT_SHP download did not return a ZIP (${url}). ` +
      `Preview: ${JSON.stringify(preview)}`,
  );
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

function toDbRow(
  feature: ShpFeature,
  csvRow: RawCsvRow | undefined,
  sourceVersionFallback: string,
): RailwayDbRow | null {
  const props = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates)) return null;

  const assetNo = numberProp(csvRow, "ASSET_NO") ?? numberProp(props, "ASSET_NO");
  const stationName = stringProp(csvRow, "NAME") || stringProp(props, "NAME");

  // ASSET_NO=0 is used as a placeholder for planned stations with no stable ID.
  // Skip it so one placeholder row does not overwrite another.
  if (assetNo === null || assetNo <= 0 || !stationName) return null;

  const rawX = Number(coordinates[0]);
  const rawY = Number(coordinates[1]);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const [lon, lat] = toWgs84([rawX, rawY]);
  const statusHe = stringProp(csvRow, "STATUS") || stringProp(props, "STATUS");
  const status = STATUS_MAP[statusHe] ?? "planned";
  const sourceVersion = sourceVersionFrom(props, csvRow, sourceVersionFallback);
  const now = new Date().toISOString();

  return {
    station_id: Math.round(assetNo),
    station_name: stationName,
    is_active: status === "operational",
    status,
    geom: `SRID=4326;POINT(${lon} ${lat})`,
    source_url: DATASET_URL,
    source_version: sourceVersion,
    metadata: {
      asset_no: assetNo,
      maagan_id: numberProp(csvRow, "MAAGAN_ID") ?? numberProp(props, "MAAGAN_ID"),
      mgn_type: numberProp(csvRow, "MGN_TYPE") ?? numberProp(props, "MGN_TYPE"),
      kav_code: numberProp(csvRow, "KAV_CODE") ?? numberProp(props, "KAV_CODE"),
      mgn_upd: stringProp(csvRow, "MGN_UPD") || stringProp(props, "MGN_UPD") || null,
      yearmonth: numberProp(csvRow, "YEARMONTH") ?? numberProp(props, "YEARMONTH"),
      type: stringProp(csvRow, "TYPE") || stringProp(props, "TYPE") || null,
      source: stringProp(csvRow, "SOURCE") || stringProp(props, "SOURCE") || null,
      status_he: statusHe || null,
      rail_stat_csv: Boolean(csvRow),
    },
    updated_at: now,
  };
}

async function parseShapefile(buffer: ArrayBuffer): Promise<ShpFeature[]> {
  const parsed = await shp(buffer);
  const collection = Array.isArray(parsed) ? parsed[0] : parsed;
  const features = (collection as ShpFeatureCollection | undefined)?.features;
  return Array.isArray(features) ? features : [];
}

async function upsertRailwayStations(
  db: SupabaseClient,
  rows: RailwayDbRow[],
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await db
      .from("infra_railway_stations")
      .upsert(chunk, {
        onConflict: "station_id",
        count: "exact",
      });

    if (error) {
      throw new Error(`railway stations upsert failed at row ${i}: ${error.message}`);
    }
    total += count ?? chunk.length;
  }
  return total;
}

const railwayAdapter: Adapter = {
  primaryResourceName: CSV_RESOURCE_NAME,

  async run(pkg: CkanPackage, db: SupabaseClient, sourceVersion: string): Promise<AdapterRunResult> {
    const csvResource = pickResourceByName(pkg, CSV_RESOURCE_NAME);
    const shpResource = pickResourceByName(pkg, SHP_RESOURCE_NAME);

    console.log(`[railway] Downloading CSV: ${csvResource.url}`);
    const csvText = await downloadResourceAsText(csvResource);
    assertCsvText(csvText, csvResource.url);
    const csvRows = parseCsv(csvText);
    const csvByAssetNo = buildCsvByAssetNo(csvRows);
    console.log(`[railway] Parsed ${csvRows.length} CSV rows`);

    console.log(`[railway] Downloading SHP ZIP: ${shpResource.url}`);
    const shpBuffer = await downloadResource(shpResource);
    assertZip(shpBuffer, shpResource.url);
    const features = await parseShapefile(shpBuffer);
    console.log(`[railway] Parsed ${features.length} SHP features`);

    const rows: RailwayDbRow[] = [];
    let skipped = 0;

    for (const feature of features) {
      const assetNo = numberProp(feature.properties ?? {}, "ASSET_NO");
      const csvRow = assetNo === null ? undefined : csvByAssetNo.get(Math.round(assetNo));
      const row = toDbRow(feature, csvRow, sourceVersion);
      if (row) {
        rows.push(row);
      } else {
        skipped++;
      }
    }

    if (rows.length === 0) {
      throw new Error("RAIL_STAT_SHP parsed successfully but no valid railway station rows were produced");
    }

    console.log(`[railway] Upserting ${rows.length} stations (${skipped} skipped)`);
    const upserted = await upsertRailwayStations(db, rows);

    return {
      inserted: upserted,
      updated: 0,
      notes:
        `${rows.length} railway stations, ${csvRows.length} CSV rows, ` +
        `${features.length} SHP features, ${skipped} skipped; SHP=${shpResource.url}`,
    };
  },
};

export default railwayAdapter;
