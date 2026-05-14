/**
 * Load accid_taz.csv into public.accidents via PostgREST (service role).
 * Run from mahod-gis root: npm run seed:accidents-taz
 *
 * Env: SUPABASE_URL or VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env).
 * Optional: ACCID_TAZ_CSV — absolute or cwd-relative path to the CSV.
 */

import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import csv from 'csv-parser';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const BATCH = 80;

type CsvRow = Record<string, string>;

function fnum(s: string | undefined): number {
  const t = (s ?? '').trim();
  if (t === '') return 0;
  const x = Number(t);
  if (Number.isNaN(x)) return 0;
  if (Number.isInteger(x)) return x;
  return x;
}

function intField(row: CsvRow, key: string): number {
  const t = (row[key] ?? '').trim();
  if (t === '') return 0;
  const x = Number(t);
  return Number.isNaN(x) ? 0 : Math.trunc(x);
}

function rowToPayload(row: CsvRow): Record<string, string | number> {
  return {
    gov_oid: intField(row, 'OID'),
    object_id: intField(row, 'OBJECTID'),
    pop_2018: intField(row, 'POP_2018'),
    usetype: row.USETYPE ?? '',
    usetypecod: intField(row, 'USETYPECOD'),
    city: row.city ?? '',
    mainuse: row.MAINUSE ?? '',
    tazarea: fnum(row.TAZAREA),
    sumacciden: intField(row, 'SUMACCIDEN'),
    dead: intField(row, 'DEAD'),
    sever_inj: intField(row, 'SEVER_INJ'),
    sligh_inj: intField(row, 'SLIGH_INJ'),
    pedestrinj: intField(row, 'PEDESTRINJ'),
    inj0_19: intField(row, 'INJ0_19'),
    inj20_64: intField(row, 'INJ20_64'),
    inj65_: intField(row, 'INJ65_'),
    injtotal: intField(row, 'INJTOTAL'),
    totdrivers: intField(row, 'TOTDRIVERS'),
    motorcycle: intField(row, 'MOTORCYCLE'),
    truck: intField(row, 'TRUCK'),
    bicycle: intField(row, 'BICYCLE'),
    private_vehicle: intField(row, 'PRIVATE'),
    vehicles: intField(row, 'VEHICLE'),
    acc_index: fnum(row.ACC_INDEX),
    yearmonth: intField(row, 'YEARMONTH'),
    citycode: intField(row, 'CITYCODE'),
    shape_length: fnum(row['Shape_Length']),
    shape_area: fnum(row['Shape_Area']),
    source_version: 'accid_taz',
  };
}

function resolveCsvPath(): string {
  const fromEnv = process.env.ACCID_TAZ_CSV?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    if (!fs.existsSync(abs)) {
      throw new Error(`ACCID_TAZ_CSV does not exist: ${abs}`);
    }
    return abs;
  }
  const downloads = path.join(homedir(), 'Downloads', 'accid_taz.csv');
  if (fs.existsSync(downloads)) {
    return downloads;
  }
  throw new Error(
    `accid_taz.csv not found. Set ACCID_TAZ_CSV or place the file at ${downloads} (cwd=${process.cwd()})`,
  );
}

async function postBatch(
  url: string,
  apiKey: string,
  rows: Record<string, string | number>[],
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
}

async function main(): Promise<void> {
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY in environment');
  }

  const csvPath = resolveCsvPath();
  const url = `${base.replace(/\/$/, '')}/rest/v1/accidents`;

  const parser = csv({
    mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
  });

  const rawRows: CsvRow[] = [];
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath, { encoding: 'utf8' })
      .pipe(parser)
      .on('data', (row: CsvRow) => {
        rawRows.push(row);
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

  let total = 0;
  for (let i = 0; i < rawRows.length; i += BATCH) {
    const chunk = rawRows.slice(i, i + BATCH).map(rowToPayload);
    await postBatch(url, key, chunk);
    total += chunk.length;
  }

  console.log('Inserted rows:', total);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
