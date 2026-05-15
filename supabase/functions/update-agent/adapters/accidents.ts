/**
 * adapters/accidents.ts
 * Adapter for accid_taz — תאונות דרכים (LMS)
 *
 * Two resources are fetched:
 *   1. CSV  — all attribute columns (45 fields), includes x_itm / y_itm
 *   2. SHP  — geometry (Point) in ITM (EPSG:2039), served as a ZIP
 *
 * Strategy:
 *   - CSV is the source of truth for all attribute columns.
 *   - ITM coordinates (x_itm, y_itm) come from the CSV.
 *   - We let PostGIS convert ITM → WGS84 via the itm_to_wgs84() function
 *     that is already defined in the schema.
 *   - The SHP is downloaded for reference / future geometry validation,
 *     but we don't parse the binary Shapefile in Deno — PostGIS handles
 *     geometry via the CSV coordinates.
 *
 * UPSERT key: pk_teuna_fikt (unique accident identifier from LMS)
 */

import { downloadResourceAsText, pickResourceByName } from "../ckan.ts";
import type { CkanPackage } from "../ckan.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw row as parsed from the CSV — all values are strings initially */
interface RawAccidentRow {
  [key: string]: string;
}

/** Typed row ready for DB insert — matches accidents table exactly */
export interface AccidentRow {
  pk_teuna_fikt: number;
  sug_tik: number | null;
  thum_geografi: number | null;
  sug_dereh: number | null;
  semel_yishuv: number | null;
  rehov1: number | null;
  rehov2: number | null;
  bayit: number | null;
  zomet_ironi: number | null;
  kvish1: number | null;
  kvish2: number | null;
  km: number | null;
  zomet_lo_ironi: number | null;
  yehida: number | null;
  shnat_teuna: number;
  hodesh_teuna: number | null;
  shaa: number | null;
  sug_yom: number | null;
  yom_layla: number | null;
  yom_bashavua: number | null;
  humrat_teuna: number;
  sug_teuna: number | null;
  had_maslul: number | null;
  rav_maslul: number | null;
  mehirut_muteret: number | null;
  tkinut: number | null;
  rohav: number | null;
  simun_timrur: number | null;
  teura: number | null;
  mezeg_avir: number | null;
  pne_kvish: number | null;
  sug_ezem: number | null;
  merhak_ezem: number | null;
  lo_haza: number | null;
  ofen_haziya: number | null;
  mekom_haziya: number | null;
  kivun_haziya: number | null;
  mahoz: number | null;
  nafa: number | null;
  ezor_tivi: number | null;
  maamad_minizipali: number | null;
  zurat_ishuv: number | null;
  status_igun: number | null;
  x_itm: number | null;
  y_itm: number | null;
  // geom is computed in DB via itm_to_wgs84(x_itm, y_itm)
  source_version: string;
}

export interface AdapterResult {
  rows: AccidentRow[];
  resourceVersion: string; // ISO timestamp of the CSV resource
  shpUrl: string;          // URL of the SHP resource (logged, not parsed here)
}

// ─── CSV parser (no external deps — Deno-safe) ───────────────────────────────

/**
 * Minimal CSV parser that handles quoted fields and Hebrew content.
 * We avoid any npm dependency here to keep the Edge function lean.
 */
function parseCsv(text: string): RawAccidentRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]!);
  const rows: RawAccidentRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]!);
    if (values.length !== headers.length) continue; // skip malformed rows
    const row: RawAccidentRow = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

/** Splits a single CSV line respecting double-quoted fields */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // escaped quote
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

// ─── Type coercion helpers ────────────────────────────────────────────────────

function toInt(val: string): number | null {
  if (!val || val.trim() === "" || val === "NULL") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toFloat(val: string): number | null {
  if (!val || val.trim() === "" || val === "NULL") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

/**
 * Maps a raw CSV row to a typed AccidentRow.
 * Column names in the CSV may vary slightly from dataset version to version —
 * we use case-insensitive lookup to be resilient.
 */
function mapRow(raw: RawAccidentRow, sourceVersion: string): AccidentRow | null {
  // Case-insensitive column getter
  const get = (key: string): string => {
    const k = Object.keys(raw).find(
      (k) => k.toLowerCase() === key.toLowerCase()
    );
    return k ? (raw[k] ?? "") : "";
  };

  const pk = toInt(get("pk_teuna_fikt"));
  const year = toInt(get("shnat_teuna"));
  const severity = toInt(get("humrat_teuna"));

  // These three are NOT NULL in schema — skip the row if missing
  if (pk === null || year === null || severity === null) {
    return null;
  }

  return {
    pk_teuna_fikt: pk,
    sug_tik: toInt(get("sug_tik")),
    thum_geografi: toInt(get("thum_geografi")),
    sug_dereh: toInt(get("sug_dereh")),
    semel_yishuv: toInt(get("semel_yishuv")),
    rehov1: toInt(get("rehov1")),
    rehov2: toInt(get("rehov2")),
    bayit: toInt(get("bayit")),
    zomet_ironi: toInt(get("zomet_ironi")),
    kvish1: toInt(get("kvish1")),
    kvish2: toInt(get("kvish2")),
    km: toFloat(get("km")),
    zomet_lo_ironi: toInt(get("zomet_lo_ironi")),
    yehida: toInt(get("yehida")),
    shnat_teuna: year,
    hodesh_teuna: toInt(get("hodesh_teuna")),
    shaa: toInt(get("shaa")),
    sug_yom: toInt(get("sug_yom")),
    yom_layla: toInt(get("yom_layla")),
    yom_bashavua: toInt(get("yom_bashavua")),
    humrat_teuna: severity,
    sug_teuna: toInt(get("sug_teuna")),
    had_maslul: toInt(get("had_maslul")),
    rav_maslul: toInt(get("rav_maslul")),
    mehirut_muteret: toInt(get("mehirut_muteret")),
    tkinut: toInt(get("tkinut")),
    rohav: toInt(get("rohav")),
    simun_timrur: toInt(get("simun_timrur")),
    teura: toInt(get("teura")),
    mezeg_avir: toInt(get("mezeg_avir")),
    pne_kvish: toInt(get("pne_kvish")),
    sug_ezem: toInt(get("sug_ezem")),
    merhak_ezem: toInt(get("merhak_ezem")),
    lo_haza: toInt(get("lo_haza")),
    ofen_haziya: toInt(get("ofen_haziya")),
    mekom_haziya: toInt(get("mekom_haziya")),
    kivun_haziya: toInt(get("kivun_haziya")),
    mahoz: toInt(get("mahoz")),
    nafa: toInt(get("nafa")),
    ezor_tivi: toInt(get("ezor_tivi")),
    maamad_minizipali: toInt(get("maamad_minizipali")),
    zurat_ishuv: toInt(get("zurat_ishuv")),
    status_igun: toInt(get("status_igun")),
    x_itm: toInt(get("x")),   // column may be "X" or "x_itm" depending on version
    y_itm: toInt(get("y")),   // column may be "Y" or "y_itm"
    source_version: sourceVersion,
  };
}

// ─── Main adapter function ────────────────────────────────────────────────────

/**
 * Fetches CSV resource of accid_taz, parses it, and returns typed rows.
 * Also returns the SHP URL so the caller can log it.
 *
 * Does NOT touch the DB — pure data transformation.
 * The caller (index.ts) handles upsert + update_log.
 */
export async function fetchAccidents(pkg: CkanPackage): Promise<AdapterResult> {
  // 1. Find CSV and SHP resources by stable CKAN names.
  // The SHP payload is published as a ZIP resource, so format matching is not enough.
  const csvResource = pickResourceByName(pkg, "ACCIDENTS_TAZ_CSV");
  const shpResource = pickResourceByName(pkg, "ACCIDENTS_TAZ_SHP");

  // 2. Download CSV text
  console.log(`[accidents] Downloading CSV: ${csvResource.url}`);
  const csvText = await downloadResourceAsText(csvResource);

  // 3. Parse
  const rawRows = parseCsv(csvText);
  console.log(`[accidents] Parsed ${rawRows.length} raw rows from CSV`);

  // 4. Map + filter invalid rows
  const sourceVersion = csvResource.last_modified ?? new Date().toISOString();
  const rows: AccidentRow[] = [];
  let skipped = 0;

  for (const raw of rawRows) {
    const mapped = mapRow(raw, sourceVersion);
    if (mapped === null) {
      skipped++;
    } else {
      rows.push(mapped);
    }
  }

  console.log(
    `[accidents] ${rows.length} valid rows, ${skipped} skipped (missing required fields)`
  );

  return {
    rows,
    resourceVersion: sourceVersion,
    shpUrl: shpResource.url,
  };
}