/**
 * טעינת שכבת ROADAUTHORITY (Shapefile או ZIP) לטבלת public.road_authority_network.
 *
 * הפרסור עם shpjs (כמו seed-municipalities) מחזיר קואורדינטות ב-WGS84 כשקיים .prj;
 * לפני INSERT מבצעים ST_Transform(…, 2039) כדי להתאים לסכמת הטבלה.
 *
 * הרצה מתיקיית mahod-gis:
 *   npm run upload:road-authority
 *
 * משתני סביבה (אחד מהבאים):
 *   מחרוזת Postgres מלאה: DATABASE_URL, SUPABASE_DATABASE_URL, DIRECT_URL, או POSTGRES_URL
 *   (מומלץ: Supabase → Project Settings → Database → URI, כולל sslmode=require)
 *   או סיסמת DB + מארח: SUPABASE_DB_HOST + SUPABASE_DB_PASS (או SUPABASE_DB_PASSWORD / POSTGRES_PASSWORD / DB_PASSWORD)
 *   או רק סיסמה: אם קיים VITE_SUPABASE_URL או SUPABASE_URL, ייבנה מארח db.<ref>.supabase.co
 *   ROADAUTHORITY_SHP — נתיב ל-.shp או ל-.zip (ברירת מחדל: input/roadauthority_shp/ROADAUTHORITY.shp)
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { constants as fsConstants } from 'node:fs';
import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';
import shp from 'shpjs';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
} from 'geojson';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const TABLE = 'public.road_authority_network';
const DEFAULT_INPUT = path.resolve(
  process.cwd(),
  'input/roadauthority_shp/ROADAUTHORITY.shp',
);
const BATCH_ROWS = 120;

type PreparedRow = {
  trafcode: number | null;
  trafauth: string | null;
  roadname: string | null;
  roadnumber: number | null;
  yearmonth: number | null;
  shape_leng: number | null;
  geom4326: LineString;
};

function firstEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

/** מזהה פרויקט מתוך https://<ref>.supabase.co → db.<ref>.supabase.co */
function inferSupabaseDbHost(): string | null {
  const apiUrl = firstEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
  if (!apiUrl) return null;
  try {
    const { hostname } = new URL(apiUrl);
    const m = /^([a-z0-9-]+)\.supabase\.co$/i.exec(hostname);
    if (!m?.[1]) return null;
    return `db.${m[1]}.supabase.co`;
  } catch {
    return null;
  }
}

function buildPostgresUri(host: string, password: string): string {
  const user = (process.env.SUPABASE_DB_USER ?? 'postgres').trim();
  const port = (process.env.SUPABASE_DB_PORT ?? '5432').trim();
  const name = (process.env.SUPABASE_DB_NAME ?? 'postgres').trim();
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  const base = `postgresql://${u}:${p}@${host}:${port}/${name}`;
  return base.includes('sslmode=') ? base : `${base}?sslmode=require`;
}

function resolveDatabaseUrl(): string {
  const direct = firstEnv(
    'DATABASE_URL',
    'SUPABASE_DATABASE_URL',
    'DIRECT_URL',
    'POSTGRES_URL',
  );
  if (direct) return direct;

  const pass = firstEnv(
    'SUPABASE_DB_PASS',
    'SUPABASE_DB_PASSWORD',
    'POSTGRES_PASSWORD',
    'DB_PASSWORD',
  );
  const hostExplicit = process.env.SUPABASE_DB_HOST?.trim();
  if (pass && hostExplicit) {
    return buildPostgresUri(hostExplicit, pass);
  }
  if (pass) {
    const inferred = inferSupabaseDbHost();
    if (inferred) return buildPostgresUri(inferred, pass);
  }

  throw new Error(
    [
      'חסר חיבור Postgres.',
      'הוסף ל-.env אחת מהאפשרויות:',
      '  • DATABASE_URL (מחרוזת URI ממסך Database ב-Supabase), או',
      '  • SUPABASE_DATABASE_URL / DIRECT_URL / POSTGRES_URL, או',
      '  • SUPABASE_DB_HOST + SUPABASE_DB_PASS, או',
      '  • SUPABASE_DB_PASS (או SUPABASE_DB_PASSWORD) יחד עם VITE_SUPABASE_URL — ייבנה db.<ref>.supabase.co',
    ].join('\n'),
  );
}

function flattenShpjsResult(result: unknown): FeatureCollection {
  const layers = Array.isArray(result) ? result : [result];
  const features: Feature[] = [];
  for (const layer of layers) {
    if (
      layer &&
      typeof layer === 'object' &&
      'features' in layer &&
      Array.isArray((layer as FeatureCollection).features)
    ) {
      features.push(...(layer as FeatureCollection).features);
    }
  }
  return { type: 'FeatureCollection', features };
}

async function parseShapefileInput(inputPath: string): Promise<FeatureCollection<Geometry, Record<string, unknown>>> {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.zip') {
    const buf = await readFile(inputPath);
    const raw = await shp(buf);
    return flattenShpjsResult(raw) as FeatureCollection<Geometry, Record<string, unknown>>;
  }

  const dir = path.dirname(inputPath);
  const stem = path.basename(inputPath, '.shp');
  const shpPath = path.join(dir, `${stem}.shp`);
  const dbfPath = path.join(dir, `${stem}.dbf`);
  await access(shpPath, fsConstants.R_OK);
  await access(dbfPath, fsConstants.R_OK);

  const shpBuf = await readFile(shpPath);
  const dbfBuf = await readFile(dbfPath);

  let prj: string | undefined;
  try {
    prj = (await readFile(path.join(dir, `${stem}.prj`))).toString('utf8');
  } catch {
    /* optional */
  }
  let cpg: string | undefined;
  try {
    cpg = (await readFile(path.join(dir, `${stem}.cpg`))).toString('utf8');
  } catch {
    /* optional */
  }

  const bundle: {
    shp: Buffer;
    dbf: Buffer;
    prj?: string;
    cpg?: string;
  } = { shp: shpBuf, dbf: dbfBuf };
  if (prj !== undefined) bundle.prj = prj;
  if (cpg !== undefined) bundle.cpg = cpg;

  const raw = await shp(bundle);
  return flattenShpjsResult(raw) as FeatureCollection<Geometry, Record<string, unknown>>;
}

function lowerProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function floatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function expandLines(geom: Geometry): LineString[] {
  if (geom.type === 'LineString') {
    if (geom.coordinates.length < 2) return [];
    return [geom];
  }
  if (geom.type === 'MultiLineString') {
    const out: LineString[] = [];
    for (const coords of geom.coordinates) {
      if (coords.length >= 2) out.push({ type: 'LineString', coordinates: coords });
    }
    return out;
  }
  throw new Error(`גיאומטריה לא נתמכת לטבלה (נדרש LineString): ${geom.type}`);
}

function featureToRows(f: Feature<Geometry, Record<string, unknown>>): PreparedRow[] {
  const p = lowerProps((f.properties ?? {}) as Record<string, unknown>);
  const trafcode = intOrNull(p.trafcode);
  const trafauth = strOrNull(p.trafauth);
  const roadname = strOrNull(p.roadname);
  const roadnumber = intOrNull(p.roadnumber);
  const yearmonth = intOrNull(p.yearmonth ?? p.year_month);
  const shape_leng = floatOrNull(p.shape_leng) ?? floatOrNull(p.shape_length);

  const lines = expandLines(f.geometry);
  return lines.map((geom4326) => ({
    trafcode,
    trafauth,
    roadname,
    roadnumber,
    yearmonth,
    shape_leng,
    geom4326,
  }));
}

async function main(): Promise<void> {
  const inputPath = path.resolve(process.cwd(), process.env.ROADAUTHORITY_SHP?.trim() || DEFAULT_INPUT);
  console.log(`קורא ${inputPath}…`);
  const fc = await parseShapefileInput(inputPath);

  const rows: PreparedRow[] = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    try {
      rows.push(...featureToRows(f as Feature<Geometry, Record<string, unknown>>));
    } catch (e) {
      console.warn('דילוג על פיצ׳ר:', (e as Error).message);
    }
  }
  if (rows.length === 0) {
    throw new Error('לא נמצאו שורות לטעינה (בדוק גיאומטריה LineString / MultiLineString).');
  }
  console.log(`מוכנות ${rows.length} שורות ל-INSERT.`);

  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE ${TABLE} RESTART IDENTITY CASCADE`);

      for (let i = 0; i < rows.length; i += BATCH_ROWS) {
        const batch = rows.slice(i, i + BATCH_ROWS);
        const placeholders: string[] = [];
        const values: unknown[] = [];
        let n = 1;
        for (const r of batch) {
          placeholders.push(
            `($${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, ST_Force2D(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($${n++}::text), 4326), 2039)))`,
          );
          values.push(
            r.trafcode,
            r.trafauth,
            r.roadname,
            r.roadnumber,
            r.yearmonth,
            r.shape_leng,
            JSON.stringify(r.geom4326),
          );
        }
        const sql = `INSERT INTO ${TABLE} (trafcode, trafauth, roadname, roadnumber, yearmonth, shape_leng, geom) VALUES ${placeholders.join(',')}`;
        await client.query(sql, values);
        process.stdout.write(`   ${Math.min(i + BATCH_ROWS, rows.length)}/${rows.length}\r`);
      }
      await client.query('COMMIT');
      console.log('\nסיום.');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
