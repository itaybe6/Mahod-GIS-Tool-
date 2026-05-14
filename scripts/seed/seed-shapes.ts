import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import cliProgress from 'cli-progress';
import csv from 'csv-parser';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import 'dotenv/config';

interface ShapePoint {
  shapeId: number;
  lat: number;
  lon: number;
  sequence: number;
}

interface PendingShape {
  shapeId: number;
  points: ShapePoint[];
}

interface DataSourceRow {
  id: number;
  file_hash: string | null;
}

interface SeedLogRow {
  id: number;
}

export interface SeedShapesOptions {
  gtfsPath?: string;
  databaseUrl?: string;
  sourceVersion?: string;
  sourceName?: string;
  batchSize?: number;
  pool?: Pool;
  progress?: boolean;
  resume?: boolean;
  force?: boolean;
  ensureSchema?: boolean;
  trackUpdates?: boolean;
  trigger?: 'scheduled' | 'manual' | 'force';
}

export interface SeedShapesResult {
  fileHash: string;
  fileSizeBytes: number;
  sourceVersion: string;
  pointsRead: number;
  shapesFound: number;
  shapesInserted: number;
  skippedExisting: number;
  skippedInvalid: number;
  malformedRows: number;
  skippedByHash: boolean;
}

const DEFAULT_GTFS_PATH = './public/gtfs/shapes.txt';
const DEFAULT_BATCH_SIZE = 500;

export async function seedShapes(options: SeedShapesOptions = {}): Promise<SeedShapesResult> {
  const gtfsPath = options.gtfsPath ?? process.env.GTFS_PATH ?? DEFAULT_GTFS_PATH;
  const sourceName = options.sourceName ?? 'gtfs';
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const progress = options.progress ?? false;
  const resume = options.resume ?? true;
  const force = options.force ?? false;
  const ensureSchema = options.ensureSchema ?? true;
  const trackUpdates = options.trackUpdates ?? true;
  const trigger = options.trigger ?? (force ? 'force' : 'manual');

  const { hash: fileHash, size: fileSizeBytes } = await hashFile(gtfsPath, progress);
  const sourceVersion = options.sourceVersion ?? process.env.GTFS_VERSION ?? fileHash.slice(0, 16);

  const ownsPool = options.pool === undefined;
  const pool =
    options.pool ??
    new Pool({
      connectionString: options.databaseUrl ?? process.env.DATABASE_URL,
    });

  let logId: number | null = null;
  let sourceId: number | null = null;

  const result: SeedShapesResult = {
    fileHash,
    fileSizeBytes,
    sourceVersion,
    pointsRead: 0,
    shapesFound: 0,
    shapesInserted: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    malformedRows: 0,
    skippedByHash: false,
  };

  if (ownsPool && (options.databaseUrl ?? process.env.DATABASE_URL) === undefined) {
    throw new Error('DATABASE_URL is required to seed gtfs_shapes');
  }

  try {
    const source = trackUpdates ? await getDataSource(pool, sourceName) : null;
    sourceId = source?.id ?? null;
    logId = trackUpdates ? await startUpdateLog(pool, sourceId, trigger, fileHash) : null;

    if (ensureSchema) {
      await ensureGtfsShapesTable(pool);
    }

    const existingShapeCount = await countShapesForVersion(pool, sourceVersion);
    if (!force && source?.file_hash === fileHash && existingShapeCount > 0) {
      result.skippedByHash = true;
      await finishUpdateLog(pool, logId, 'skipped', result, 'shapes.txt hash is unchanged');
      return result;
    }

    await streamShapes({
      gtfsPath,
      pool,
      batchSize,
      progress,
      resume,
      sourceVersion,
      result,
    });

    if (trackUpdates) {
      await updateDataSource(pool, sourceId, result);
      await finishUpdateLog(pool, logId, 'success', result, 'gtfs_shapes seed completed');
    }
    return result;
  } catch (error) {
    await safeFailUpdateLog(pool, logId, error);
    throw error;
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

export async function ensureGtfsShapesTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
      shape_id INTEGER PRIMARY KEY,
      geom GEOMETRY(LineString, 4326) NOT NULL,
      point_count INTEGER,
      source_version TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_geom ON public.gtfs_shapes USING GIST (geom)');
}

async function streamShapes(args: {
  gtfsPath: string;
  pool: Pool;
  batchSize: number;
  progress: boolean;
  resume: boolean;
  sourceVersion: string;
  result: SeedShapesResult;
}): Promise<void> {
  const fileSize = fs.statSync(args.gtfsPath).size;
  const bar = createProgressBar('Compressing shapes', args.progress);
  const readStream = fs.createReadStream(args.gtfsPath);
  const parser = csv();
  let bytesRead = 0;
  let currentShapeId: number | null = null;
  let currentPoints: ShapePoint[] = [];
  let pendingBatch: PendingShape[] = [];
  let flushInProgress = false;
  const completedShapeIds = new Set<number>();

  bar?.start(fileSize, 0);

  await new Promise<void>((resolve, reject) => {
    readStream.on('data', (chunk: string | Buffer) => {
      bytesRead += Buffer.byteLength(chunk);
      bar?.update(bytesRead);
    });

    readStream
      .pipe(parser)
      .on('data', (row: Record<string, string>) => {
        try {
          const point = parseShapePoint(row);
          args.result.pointsRead += 1;

          if (currentShapeId === null) {
            currentShapeId = point.shapeId;
          }

          if (point.shapeId !== currentShapeId) {
            if (completedShapeIds.has(point.shapeId)) {
              reject(new Error(`shapes.txt is not grouped by shape_id; shape ${point.shapeId} appears again`));
              return;
            }

            pendingBatch.push({ shapeId: currentShapeId, points: currentPoints });
            completedShapeIds.add(currentShapeId);
            args.result.shapesFound += 1;
            currentShapeId = point.shapeId;
            currentPoints = [];
          }

          currentPoints.push(point);

          if (pendingBatch.length >= args.batchSize && !flushInProgress) {
            flushInProgress = true;
            parser.pause();
            void flushBatch(args.pool, pendingBatch, args.sourceVersion, args.resume, args.result)
              .then(() => {
                pendingBatch = [];
                flushInProgress = false;
                parser.resume();
              })
              .catch(reject);
          }
        } catch (error) {
          args.result.malformedRows += 1;
          console.warn(error instanceof Error ? error.message : String(error));
        }
      })
      .on('end', () => {
        if (currentShapeId !== null) {
          pendingBatch.push({ shapeId: currentShapeId, points: currentPoints });
          args.result.shapesFound += 1;
        }

        flushBatch(args.pool, pendingBatch, args.sourceVersion, args.resume, args.result)
          .then(resolve)
          .catch(reject);
      })
      .on('error', reject);
  });

  bar?.update(fileSize);
  bar?.stop();
}

async function flushBatch(
  pool: Pool,
  shapes: PendingShape[],
  sourceVersion: string,
  resume: boolean,
  result: SeedShapesResult,
): Promise<void> {
  if (shapes.length === 0) {
    return;
  }

  const validShapes = shapes.filter((shape) => {
    if (shape.points.length < 2) {
      result.skippedInvalid += 1;
      console.warn(`Skipping shape ${shape.shapeId}: LineString requires at least 2 points`);
      return false;
    }

    return true;
  });

  if (validShapes.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingIds = resume ? await getExistingShapeIds(client, validShapes, sourceVersion) : new Set<number>();
    const shapesToInsert = validShapes.filter((shape) => !existingIds.has(shape.shapeId));
    result.skippedExisting += validShapes.length - shapesToInsert.length;

    if (shapesToInsert.length > 0) {
      await insertShapeBatch(client, shapesToInsert, sourceVersion);
      result.shapesInserted += shapesToInsert.length;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertShapeBatch(client: PoolClient, shapes: PendingShape[], sourceVersion: string): Promise<void> {
  const values: string[] = [];
  const params: Array<number | string> = [];
  let paramIndex = 1;

  for (const shape of shapes) {
    shape.points.sort((a, b) => a.sequence - b.sequence);
    const coords = shape.points.map((point) => `${point.lon} ${point.lat}`).join(',');
    const wkt = `LINESTRING(${coords})`;

    values.push(
      `($${paramIndex}, ST_GeomFromText($${paramIndex + 1}, 4326), $${paramIndex + 2}, $${paramIndex + 3})`,
    );
    params.push(shape.shapeId, wkt, shape.points.length, sourceVersion);
    paramIndex += 4;
  }

  await client.query(
    `
      INSERT INTO public.gtfs_shapes (shape_id, geom, point_count, source_version)
      VALUES ${values.join(',')}
      ON CONFLICT (shape_id) DO UPDATE SET
        geom = EXCLUDED.geom,
        point_count = EXCLUDED.point_count,
        source_version = EXCLUDED.source_version,
        updated_at = NOW()
    `,
    params,
  );
}

async function getExistingShapeIds(
  client: PoolClient,
  shapes: PendingShape[],
  sourceVersion: string,
): Promise<Set<number>> {
  const shapeIds = shapes.map((shape) => shape.shapeId);
  const { rows } = await client.query<{ shape_id: number }>(
    'SELECT shape_id FROM public.gtfs_shapes WHERE source_version = $1 AND shape_id = ANY($2::int[])',
    [sourceVersion, shapeIds],
  );

  return new Set(rows.map((row) => row.shape_id));
}

function parseShapePoint(row: Record<string, string>): ShapePoint {
  const shapeId = parseInteger(row.shape_id, 'shape_id');
  const lat = parseNumber(row.shape_pt_lat, 'shape_pt_lat');
  const lon = parseNumber(row.shape_pt_lon, 'shape_pt_lon');
  const sequence = parseInteger(row.shape_pt_sequence, 'shape_pt_sequence');

  return { shapeId, lat, lon, sequence };
}

function parseInteger(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Skipping malformed row: ${fieldName} is not an integer`);
  }

  return parsed;
}

function parseNumber(value: string | undefined, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Skipping malformed row: ${fieldName} is not a number`);
  }

  return parsed;
}

async function hashFile(filePath: string, progress: boolean): Promise<{ hash: string; size: number }> {
  const size = fs.statSync(filePath).size;
  const hash = createHash('sha256');
  const bar = createProgressBar('Hashing shapes.txt', progress);
  let bytesRead = 0;

  bar?.start(size, 0);

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .on('data', (chunk: string | Buffer) => {
        hash.update(chunk);
        bytesRead += Buffer.byteLength(chunk);
        bar?.update(bytesRead);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  bar?.update(size);
  bar?.stop();

  return { hash: hash.digest('hex'), size };
}

function createProgressBar(label: string, enabled: boolean): cliProgress.SingleBar | null {
  if (!enabled) {
    return null;
  }

  return new cliProgress.SingleBar(
    {
      format: `${label} |{bar}| {percentage}% | {value}/{total} bytes`,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
}

async function getDataSource(pool: Pool, sourceName: string): Promise<DataSourceRow | null> {
  const { rows } = await pool.query<DataSourceRow>(
    'SELECT id, file_hash FROM public.data_sources WHERE name = $1',
    [sourceName],
  );
  return rows[0] ?? null;
}

async function countShapesForVersion(pool: Pool, sourceVersion: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM public.gtfs_shapes WHERE source_version = $1',
    [sourceVersion],
  );
  return Number(rows[0]?.count ?? 0);
}

async function startUpdateLog(
  pool: Pool,
  sourceId: number | null,
  trigger: NonNullable<SeedShapesOptions['trigger']>,
  fileHash: string,
): Promise<number | null> {
  const { rows } = await pool.query<SeedLogRow>(
    `
      INSERT INTO public.update_log (source_id, trigger, metadata)
      VALUES ($1, $2, jsonb_build_object('file_hash', $3, 'task', 'seed_shapes'))
      RETURNING id
    `,
    [sourceId, trigger, fileHash],
  );
  return rows[0]?.id ?? null;
}

async function finishUpdateLog(
  pool: Pool,
  logId: number | null,
  status: 'success' | 'skipped',
  result: SeedShapesResult,
  notes: string,
): Promise<void> {
  if (logId === null) {
    return;
  }

  await pool.query(
    `
      UPDATE public.update_log
      SET finished_at = NOW(),
          status = $2,
          rows_inserted = $3,
          rows_updated = $4,
          notes = $5,
          metadata = metadata || $6::jsonb
      WHERE id = $1
    `,
    [
      logId,
      status,
      result.shapesInserted,
      result.skippedExisting,
      notes,
      JSON.stringify({
        pointsRead: result.pointsRead,
        shapesFound: result.shapesFound,
        skippedInvalid: result.skippedInvalid,
        malformedRows: result.malformedRows,
        sourceVersion: result.sourceVersion,
      }),
    ],
  );
}

async function safeFailUpdateLog(pool: Pool, logId: number | null, error: unknown): Promise<void> {
  if (logId === null) {
    return;
  }

  try {
    await pool.query(
      `
        UPDATE public.update_log
        SET finished_at = NOW(), status = 'failed', error_message = $2
        WHERE id = $1
      `,
      [logId, error instanceof Error ? error.message : String(error)],
    );
  } catch (logError) {
    console.error(logError);
  }
}

async function updateDataSource(pool: Pool, sourceId: number | null, result: SeedShapesResult): Promise<void> {
  if (sourceId === null) {
    return;
  }

  await pool.query(
    `
      UPDATE public.data_sources
      SET last_checked_at = NOW(),
          last_updated_at = NOW(),
          file_hash = $2,
          file_size_bytes = $3,
          record_count = $4,
          metadata = metadata || $5::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      sourceId,
      result.fileHash,
      result.fileSizeBytes,
      result.shapesFound,
      JSON.stringify({
        gtfs_shapes_source_version: result.sourceVersion,
        gtfs_shapes_points_read: result.pointsRead,
      }),
    ],
  );
}

function isDirectRun(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href;
}

if (isDirectRun()) {
  seedShapes({ progress: true })
    .then((result) => {
      if (result.skippedByHash) {
        console.log(`Skipped gtfs_shapes: hash ${result.fileHash} already loaded.`);
        return;
      }

      console.log(
        `Done. Found ${result.shapesFound.toLocaleString()} shape_ids, inserted ${result.shapesInserted.toLocaleString()}, read ${result.pointsRead.toLocaleString()} points.`,
      );
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
