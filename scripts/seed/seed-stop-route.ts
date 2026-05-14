import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cliProgress from 'cli-progress';
import csv from 'csv-parser';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

interface TripInfo {
  routeId: number;
  directionId: number;
}

interface StopRouteLink {
  stopId: number;
  routeId: number;
  directionId: number;
}

interface TripRow {
  trip_id: string;
  route_id: number;
  direction_id: number;
}

interface StopTimesRow {
  trip_id?: string;
  stop_id?: string;
}

export interface SeedStopRouteOptions {
  stopTimesPath: string;
  sourceVersion: string;
  client: PoolClient;
}

export interface SeedStopRouteResult {
  rowsRead: number;
  uniqueLinks: number;
  skipped: number;
}

const DEFAULT_STOP_TIMES_CANDIDATES = [
  './public/gtfs/stop_times.txt',
  './data/gtfs/stop_times.txt',
] as const;
const BATCH_SIZE = 1_000;
const MAX_MISSING_TRIP_WARNINGS = 10;

function resolveStopTimesPath(explicit?: string): string {
  const fromEnv = explicit?.trim();

  if (fromEnv !== undefined && fromEnv.length > 0) {
    const absolute = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);

    if (!fs.existsSync(absolute)) {
      throw new Error(`STOP_TIMES_PATH does not exist: ${absolute}`);
    }

    return absolute;
  }

  for (const candidate of DEFAULT_STOP_TIMES_CANDIDATES) {
    const absolute = path.resolve(process.cwd(), candidate);

    if (fs.existsSync(absolute)) {
      return absolute;
    }
  }

  const tried = DEFAULT_STOP_TIMES_CANDIDATES.join(', ');

  throw new Error(
    `stop_times.txt not found. Set STOP_TIMES_PATH or place the file at one of: ${tried} (cwd=${process.cwd()})`,
  );
}

function createStopTimesCsvParser(): ReturnType<typeof csv> {
  return csv({
    mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim(),
  });
}

export async function seedStopRoute(options: SeedStopRouteOptions): Promise<SeedStopRouteResult> {
  const tripsMap = await loadTripsMap(options.client);
  const { linksToInsert, result } = await collectStopRouteLinks(options.stopTimesPath, tripsMap);

  if (result.rowsRead === 0) {
    throw new Error(`No data rows read from ${options.stopTimesPath} (empty file or unreadable CSV).`);
  }

  if (result.uniqueLinks === 0) {
    throw new Error(
      `No (stop_id, route_id, direction_id) links were produced after reading ${result.rowsRead.toLocaleString()} ` +
        `stop_times rows (${result.skipped.toLocaleString()} skipped). Check CSV headers (trip_id, stop_id), ` +
        'UTF-8 BOM on the header row, and that trip_id values exist in public.gtfs_trips.',
    );
  }

  let transactionStarted = false;
  try {
    await options.client.query('BEGIN');
    transactionStarted = true;
    await options.client.query('TRUNCATE TABLE public.gtfs_stop_route');
    await insertStopRouteLinks(options.client, linksToInsert, options.sourceVersion);
    await options.client.query('COMMIT');

    return result;
  } catch (error) {
    if (transactionStarted) {
      await options.client.query('ROLLBACK');
    }
    throw error;
  }
}

async function loadTripsMap(client: PoolClient): Promise<Map<string, TripInfo>> {
  console.log('Loading trips map into memory...');
  const result = await client.query<TripRow>(`
    SELECT trip_id, route_id, direction_id
    FROM public.gtfs_trips
    WHERE route_id IS NOT NULL
      AND direction_id IS NOT NULL
  `);

  const map = new Map<string, TripInfo>();
  for (const row of result.rows) {
    map.set(row.trip_id, {
      routeId: row.route_id,
      directionId: row.direction_id,
    });
  }

  console.log(`Loaded ${map.size.toLocaleString()} trips`);
  return map;
}

async function collectStopRouteLinks(
  stopTimesPath: string,
  tripsMap: Map<string, TripInfo>,
): Promise<{ linksToInsert: StopRouteLink[]; result: SeedStopRouteResult }> {
  const fileSize = fs.statSync(stopTimesPath).size;
  const readStream = fs.createReadStream(stopTimesPath);
  const parser = createStopTimesCsvParser();
  const bar = createProgressBar('Reading stop_times.txt');
  const uniqueLinks = new Set<string>();
  const linksToInsert: StopRouteLink[] = [];
  const result: SeedStopRouteResult = {
    rowsRead: 0,
    uniqueLinks: 0,
    skipped: 0,
  };
  let bytesRead = 0;
  let missingTripWarnings = 0;

  bar.start(fileSize, 0);

  await new Promise<void>((resolve, reject) => {
    readStream.on('data', (chunk: string | Buffer) => {
      bytesRead += Buffer.byteLength(chunk);
      bar.update(bytesRead);
    });

    readStream
      .pipe(parser)
      .on('data', (row: StopTimesRow) => {
        result.rowsRead += 1;

        const tripId = row.trip_id;
        const trip = tripId === undefined ? undefined : tripsMap.get(tripId);
        if (trip === undefined) {
          result.skipped += 1;
          if (missingTripWarnings < MAX_MISSING_TRIP_WARNINGS) {
            console.warn(`Skipping stop_times row ${result.rowsRead.toLocaleString()}: missing trip_id ${tripId ?? '<empty>'}`);
            missingTripWarnings += 1;
          }
          return;
        }

        const stopId = parseStopId(row.stop_id);
        if (stopId === null) {
          result.skipped += 1;
          console.warn(`Skipping stop_times row ${result.rowsRead.toLocaleString()}: invalid stop_id ${row.stop_id ?? '<empty>'}`);
          return;
        }

        const key = `${stopId}-${trip.routeId}-${trip.directionId}`;
        if (!uniqueLinks.has(key)) {
          uniqueLinks.add(key);
          linksToInsert.push({
            stopId,
            routeId: trip.routeId,
            directionId: trip.directionId,
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  bar.update(fileSize);
  bar.stop();

  result.uniqueLinks = uniqueLinks.size;
  if (result.skipped > missingTripWarnings && missingTripWarnings === MAX_MISSING_TRIP_WARNINGS) {
    console.warn(`Suppressed additional missing-trip warnings. Total skipped rows: ${result.skipped.toLocaleString()}`);
  }

  return { linksToInsert, result };
}

function parseStopId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

async function insertStopRouteLinks(
  client: PoolClient,
  links: StopRouteLink[],
  sourceVersion: string,
): Promise<void> {
  for (let index = 0; index < links.length; index += BATCH_SIZE) {
    const batch = links.slice(index, index + BATCH_SIZE);
    await insertStopRouteBatch(client, batch, sourceVersion);
  }
}

async function insertStopRouteBatch(
  client: PoolClient,
  links: StopRouteLink[],
  sourceVersion: string,
): Promise<void> {
  if (links.length === 0) {
    return;
  }

  const values: string[] = [];
  const params: Array<number | string> = [];
  let paramIndex = 1;

  for (const link of links) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
    params.push(link.stopId, link.routeId, link.directionId, sourceVersion);
    paramIndex += 4;
  }

  await client.query(
    `
      INSERT INTO public.gtfs_stop_route (stop_id, route_id, direction_id, source_version)
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING
    `,
    params,
  );
}

function createProgressBar(label: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar(
    {
      format: `${label} |{bar}| {percentage}% | {value}/{total} bytes`,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
}

function logSummary(result: SeedStopRouteResult): void {
  console.log(`Total rows read: ${result.rowsRead.toLocaleString()}`);
  console.log(`Unique stop-route links: ${result.uniqueLinks.toLocaleString()}`);
  console.log(`Skipped rows: ${result.skipped.toLocaleString()}`);
  if (result.uniqueLinks > 0) {
    console.log(`Compression: ${(result.rowsRead / result.uniqueLinks).toFixed(1)}x`);
  }
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (url === undefined || url.length === 0) {
    throw new Error(
      'DATABASE_URL is missing or empty. Set it in `mahod-gis/.env` or `mahod-gis/.env.local` ' +
        '(this script loads both). Use the Postgres URI from Supabase: Dashboard → Project Settings → Database → URI ' +
        '(direct or pooler; include `?sslmode=require` if the host requires SSL).',
    );
  }

  return url;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
  } catch (error: unknown) {
    await pool.end().catch(() => undefined);
    if (isConnectionRefused(error)) {
      throw new Error(
        'Could not connect to Postgres (connection refused). Your DATABASE_URL likely points to localhost:5432 ' +
          'but no server is listening there. For Supabase, paste the full connection URI from the dashboard ' +
          '(host should look like `db.<project-ref>.supabase.co` or a pooler hostname), not `127.0.0.1`.',
        { cause: error },
      );
    }
    throw error;
  }

  try {
    const stopTimesPath = resolveStopTimesPath(process.env.STOP_TIMES_PATH);
    console.log(`Using stop_times file: ${stopTimesPath}`);

    const result = await seedStopRoute({
      stopTimesPath,
      sourceVersion: process.env.GTFS_VERSION ?? new Date().toISOString().slice(0, 10),
      client,
    });

    logSummary(result);
    console.log(`Done. ${result.uniqueLinks.toLocaleString()} links inserted.`);
  } finally {
    if (client !== undefined) {
      client.release();
    }
    await pool.end();
  }
}

function isConnectionRefused(error: unknown): boolean {
  if (error !== null && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'ECONNREFUSED') {
    return true;
  }

  if (error !== null && typeof error === 'object' && 'errors' in error && Array.isArray((error as { errors: unknown }).errors)) {
    return (error as { errors: unknown[] }).errors.some(
      (inner) => inner !== null && typeof inner === 'object' && 'code' in inner && (inner as { code: unknown }).code === 'ECONNREFUSED',
    );
  }

  return false;
}

function isDirectRun(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href;
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
