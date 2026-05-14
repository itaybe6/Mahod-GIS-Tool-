/**
 * seed-railway-stations.ts
 * ----------------------------------------------------------------
 * טוען את שכבת תחנות רכבת כבדה (RAIL_STAT) מ-data.gov.il
 * לטבלת infra_railway_stations ב-Supabase.
 *
 * מקור:  https://data.gov.il/dataset/rail_stat
 * קלט:   input/rail_stat.zip  (מכיל RAIL_STAT.shp + RAIL_STAT.dbf + ...)
 * השלכה: WGS84 / EPSG:4326   (המרה אוטומטית מ-ITM / EPSG:2039)
 *
 * הסקריפט:
 *   1. מחלץ את ה-ZIP לתיקייה זמנית
 *   2. מאתר את קבצי SHP/DBF (case-insensitive — סובלני לשמות גדולים/קטנים)
 *   3. ממיר קואורדינטות ITM → WGS84
 *   4. ממפה סטטוסים מעברית ל-enum של ה-DB
 *   5. עושה UPSERT ל-infra_railway_stations
 *   6. רושם את הריצה ל-update_log
 *
 * הרצה:
 *   npx tsx scripts/seed/seed-railway-stations.ts
 *   npx tsx scripts/seed/seed-railway-stations.ts --force
 * ----------------------------------------------------------------
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import proj4 from "proj4";
import shp from "shpjs";
import ws from "ws";
import type { FeatureCollection, Point } from "geojson";

// ---------- ENV ----------
config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("חסר SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ב-.env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  // Node.js 20 has no native WebSocket that @supabase/realtime-js accepts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  realtime: { transport: ws as any },
});

// ---------- FILE PATHS ----------
const INPUT_ZIP_NAME = "rail_stat.zip";
const INPUT_ZIP = process.env.RAIL_STAT_ZIP_PATH
  ? resolve(process.env.RAIL_STAT_ZIP_PATH)
  : resolve(PROJECT_ROOT, "input", INPUT_ZIP_NAME);

// ---------- PROJ ----------
// EPSG:2039 (Israel TM Grid) — proj4 לא תמיד מכיר אותו by default
proj4.defs(
  "EPSG:2039",
  "+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 " +
    "+x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs"
);

// ---------- MAPPINGS ----------
const STATUS_MAP: Record<string, "operational" | "under_construction" | "planned"> = {
  קיימת: "operational",
  בבניה: "under_construction",
  בתכנון: "planned",
};

// ---------- TYPES ----------
interface RailStatFeature {
  ASSET_NO: number;
  NAME: string;
  MAAGAN_ID: number;
  MGN_TYPE: number;
  SOURCE: string;
  STATUS: string;
  KAV_CODE: number;
  MGN_UPD: Date | string | null;
  YEARMONTH: number;
  TYPE: string;
}

type RailStatCollection = FeatureCollection<Point, RailStatFeature>;

interface DbRow {
  station_id: number;
  station_name: string;
  is_active: boolean;
  status: "operational" | "under_construction" | "planned";
  geom: string;
  source_url: string;
  source_version: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

// ---------- HELPERS ----------
function log(stage: string, msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${stage}] ${msg}`);
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function assertZipFile(buf: Buffer): void {
  if (buf.subarray(0, 2).toString("utf8") === "PK") return;

  const preview = buf.subarray(0, 80).toString("utf8").replace(/\s+/g, " ");
  throw new Error(
    `${INPUT_ZIP} אינו ZIP תקין. תחילת הקובץ: ${JSON.stringify(preview)}. ` +
      "אם הורדת מ-data.gov.il וקיבלת HTML/Google sign-in, הורד את RAIL_STAT_SHP ידנית ושמור אותו כ-input/rail_stat.zip."
  );
}

async function readFeatures(): Promise<{ props: RailStatFeature; coords: [number, number] }[]> {
  const zipBuffer = readFileSync(INPUT_ZIP);
  assertZipFile(zipBuffer);
  log("read", `קורא ZIP ישירות עם shpjs (${(zipBuffer.length / 1024).toFixed(1)} KB)`);

  const parsed = await shp(zipBuffer);
  const collection = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!collection) {
    throw new Error(`לא נמצאה שכבת SHP בתוך ${INPUT_ZIP_NAME}`);
  }

  const geojson = collection as RailStatCollection;
  const features: { props: RailStatFeature; coords: [number, number] }[] = [];

  for (const feature of geojson.features) {
    const { geometry, properties } = feature;
    if (!geometry || geometry.type !== "Point") continue;
    features.push({
      props: properties,
      coords: geometry.coordinates as [number, number],
    });
  }
  log("read", `נקראו ${features.length} תחנות מהקובץ`);
  return features;
}

function toDbRow(
  props: RailStatFeature,
  itmCoords: [number, number],
  sourceVersion: string
): DbRow | null {
  // ASSET_NO=0 משמש כ-placeholder עבור תחנות מתוכננות בלי מזהה; נדלג עליהן כדי לא לדרוס שורות אמיתיות.
  if (props.ASSET_NO == null || props.ASSET_NO <= 0 || !props.NAME) return null;

  // shpjs reprojects when the ZIP includes .prj; fall back to ITM conversion when needed.
  const [lon, lat] =
    Math.abs(itmCoords[0]) > 180 || Math.abs(itmCoords[1]) > 90
      ? proj4("EPSG:2039", "EPSG:4326", itmCoords)
      : itmCoords;
  const statusEn = STATUS_MAP[props.STATUS?.trim()] ?? "planned";

  return {
    station_id: Math.round(props.ASSET_NO),
    station_name: props.NAME.trim(),
    is_active: statusEn === "operational",
    status: statusEn,
    geom: `SRID=4326;POINT(${lon} ${lat})`,
    source_url: "https://data.gov.il/dataset/rail_stat",
    source_version: sourceVersion,
    metadata: {
      asset_no: props.ASSET_NO,
      maagan_id: props.MAAGAN_ID,
      mgn_type: props.MGN_TYPE,
      kav_code: props.KAV_CODE,
      mgn_upd: props.MGN_UPD,
      yearmonth: props.YEARMONTH,
      type: props.TYPE,
      source: props.SOURCE?.trim() ?? null,
      status_he: props.STATUS?.trim() ?? null,
    },
    updated_at: new Date().toISOString(),
  };
}

async function logUpdateStart(
  sourceId: number,
  trigger: "scheduled" | "manual" | "force"
): Promise<number | null> {
  const { data, error } = await supabase
    .from("update_log")
    .insert({ source_id: sourceId, status: "running", trigger })
    .select("id")
    .single();
  if (error) {
    log("update_log", `שגיאה בכתיבת התחלת ריצה: ${error.message}`);
    return null;
  }
  return data.id;
}

async function logUpdateFinish(
  logId: number | null,
  result: {
    status: "success" | "failed";
    rowsInserted: number;
    rowsUpdated: number;
    error?: string;
    notes?: string;
  }
) {
  if (!logId) return;
  await supabase
    .from("update_log")
    .update({
      finished_at: new Date().toISOString(),
      status: result.status,
      rows_inserted: result.rowsInserted,
      rows_updated: result.rowsUpdated,
      error_message: result.error ?? null,
      notes: result.notes ?? null,
    })
    .eq("id", logId);
}

async function getSourceId(): Promise<number> {
  const { data, error } = await supabase
    .from("data_sources")
    .select("id")
    .eq("name", "railway")
    .single();
  if (error || !data) {
    throw new Error(`לא נמצא data_source בשם 'railway'. הרץ את ה-SQL migration קודם.`);
  }
  return data.id;
}

async function updateSourceMeta(
  sourceId: number,
  payload: { recordCount: number; fileHash: string; fileSize: number }
) {
  await supabase
    .from("data_sources")
    .update({
      last_checked_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      record_count: payload.recordCount,
      file_hash: payload.fileHash,
      file_size_bytes: payload.fileSize,
    })
    .eq("id", sourceId);
}

// ---------- MAIN ----------
async function main() {
  const forceMode = process.argv.includes("--force");
  const trigger = forceMode ? "force" : "manual";

  log("start", `seed-railway-stations | force=${forceMode}`);
  log("config", `קלט מצופה: ${INPUT_ZIP}`);

  if (!existsSync(INPUT_ZIP)) {
    throw new Error(`לא נמצא קובץ קלט: ${INPUT_ZIP}`);
  }
  const zipBuffer = readFileSync(INPUT_ZIP);
  const fileHash = sha256(zipBuffer);
  const fileSize = zipBuffer.length;

  const sourceId = await getSourceId();
  const logId = await logUpdateStart(sourceId, trigger);

  try {
    const features = await readFeatures();
    if (features.length === 0) throw new Error("לא נקראו תחנות מהקובץ");

    const sourceVersion = String(features[0].props.YEARMONTH ?? "unknown");

    const rows: DbRow[] = [];
    for (const { props, coords } of features) {
      const row = toDbRow(props, coords, sourceVersion);
      if (row) rows.push(row);
    }
    log("transform", `הומרו ${rows.length} רשומות (מתוך ${features.length})`);

    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("infra_railway_stations")
        .upsert(chunk, { onConflict: "station_id", ignoreDuplicates: false });

      if (error) {
        throw new Error(`UPSERT נכשל ב-batch ${i}: ${error.message}`);
      }
      inserted += chunk.length;
      log("upsert", `הועלו ${inserted}/${rows.length}`);
    }

    await updateSourceMeta(sourceId, {
      recordCount: rows.length,
      fileHash,
      fileSize,
    });

    await logUpdateFinish(logId, {
      status: "success",
      rowsInserted: 0,
      rowsUpdated: rows.length,
      notes: `Loaded ${rows.length} stations from ${INPUT_ZIP_NAME} (version ${sourceVersion})`,
    });

    log("done", `הסתיים בהצלחה — ${rows.length} תחנות`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log("error", errMsg);
    await logUpdateFinish(logId, {
      status: "failed",
      rowsInserted: 0,
      rowsUpdated: 0,
      error: errMsg,
    });
    process.exitCode = 1;
  }
}

main();