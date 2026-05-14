/**
 * Loads GTFS `shapes.txt` into `gtfs_shapes` via Supabase REST (no DATABASE_URL).
 *
 * Why this exists: the original `scripts/seed/seed-shapes.ts` uses `pg.Pool` and
 * therefore requires a direct Postgres URI in `DATABASE_URL`. When only the
 * Supabase HTTP credentials are available (`SUPABASE_URL` +
 * `SUPABASE_SERVICE_ROLE_KEY`), this script does the equivalent work by:
 *
 *   1. Streaming `shapes.txt` line-by-line (218MB is too big to slurp).
 *   2. Grouping consecutive rows by `shape_id`, sorting by `shape_pt_sequence`.
 *   3. Calling the `upsert_gtfs_shapes_bulk(shapes_json jsonb, default_version)`
 *      RPC in batches, which builds the LineString geometry server-side.
 *
 * Configuration (env or .env / .env.local):
 *   SUPABASE_URL                 (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SHAPES_PATH                  default: dist/gtfs/shapes.txt → public/gtfs/shapes.txt
 *   MAX_SHAPES                   default: 30000 (project quota cap)
 *   BATCH_SIZE                   default: 250 shapes per RPC call
 *   GTFS_VERSION                 stored in `gtfs_shapes.source_version`
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface ShapePoint {
  lng: number;
  lat: number;
  sequence: number;
}

interface PendingShape {
  shape_id: number;
  points: Array<[number, number]>;
}

interface RestResult {
  shapesRead: number;
  shapesSent: number;
  shapesSkipped: number;
  shapesAlreadyLoaded: number;
  malformedRows: number;
  pointsRead: number;
}

async function fetchExistingShapeIds(client: SupabaseClient): Promise<Set<number>> {
  const existing = new Set<number>();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from('gtfs_shapes')
      .select('shape_id')
      .order('shape_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Failed to list existing shape ids: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ shape_id: number }>) existing.add(row.shape_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return existing;
}

const DEFAULT_CANDIDATES = [
  'dist/gtfs/shapes.txt',
  'public/gtfs/shapes.txt',
  'data/gtfs/shapes.txt',
];

function resolveShapesPath(): string {
  const explicit = process.env.SHAPES_PATH;
  if (explicit && explicit.trim().length > 0) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`SHAPES_PATH does not exist: ${explicit}`);
    }
    return explicit;
  }
  for (const cand of DEFAULT_CANDIDATES) {
    if (fs.existsSync(cand)) return cand;
  }
  throw new Error(
    `shapes.txt not found. Set SHAPES_PATH or place the file at one of: ${DEFAULT_CANDIDATES.join(', ')}`
  );
}

function resolveEnv(name: string, ...fallbacks: string[]): string {
  for (const key of [name, ...fallbacks]) {
    const v = process.env[key];
    if (v && v.trim().length > 0) return v;
  }
  throw new Error(`Missing env var: ${name}${fallbacks.length ? ` (or fallbacks ${fallbacks.join(', ')})` : ''}`);
}

function parseColumnIndices(headerLine: string): {
  shapeIdIdx: number;
  latIdx: number;
  lonIdx: number;
  sequenceIdx: number;
} {
  const cols = headerLine.split(',').map((c) => c.trim().replace(/^\uFEFF/, ''));
  const map = new Map(cols.map((c, i) => [c, i] as const));
  const get = (n: string): number => {
    const idx = map.get(n);
    if (idx === undefined) throw new Error(`Missing column "${n}" in shapes.txt header: ${headerLine}`);
    return idx;
  };
  return {
    shapeIdIdx: get('shape_id'),
    latIdx: get('shape_pt_lat'),
    lonIdx: get('shape_pt_lon'),
    sequenceIdx: get('shape_pt_sequence'),
  };
}

async function sendBatch(
  client: SupabaseClient,
  shapes: PendingShape[],
  sourceVersion: string,
  attempt = 1
): Promise<number> {
  if (shapes.length === 0) return 0;
  const { data, error } = await client.rpc('upsert_gtfs_shapes_bulk', {
    shapes_json: shapes as unknown as object,
    default_version: sourceVersion,
  });
  if (error) {
    if (attempt < 3) {
      const wait = 1000 * attempt;
      console.warn(
        `Batch RPC failed (attempt ${attempt}/3): ${error.message ?? error}. Retrying in ${wait}ms…`
      );
      await new Promise((res) => setTimeout(res, wait));
      return sendBatch(client, shapes, sourceVersion, attempt + 1);
    }
    throw new Error(`upsert_gtfs_shapes_bulk failed: ${error.message ?? error}`);
  }
  return typeof data === 'number' ? data : shapes.length;
}

async function main(): Promise<void> {
  const shapesPath = resolveShapesPath();
  const supabaseUrl = resolveEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceRoleKey = resolveEnv('SUPABASE_SERVICE_ROLE_KEY');
  const maxShapes = Number(process.env.MAX_SHAPES ?? 30000);
  const batchSize = Number(process.env.BATCH_SIZE ?? 100);
  const sourceVersion =
    process.env.GTFS_VERSION ?? new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(maxShapes) || maxShapes <= 0) {
    throw new Error(`Invalid MAX_SHAPES: ${process.env.MAX_SHAPES}`);
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid BATCH_SIZE: ${process.env.BATCH_SIZE}`);
  }

  console.log(`shapes.txt:       ${path.resolve(shapesPath)}`);
  console.log(`Supabase URL:     ${supabaseUrl.replace(/\/+$/, '')}`);
  console.log(`Max shapes:       ${maxShapes.toLocaleString()}`);
  console.log(`Batch size:       ${batchSize}`);
  console.log(`source_version:   ${sourceVersion}`);
  console.log('');

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log('Loading list of already-inserted shape ids…');
  const existingIds = await fetchExistingShapeIds(client);
  console.log(`  found ${existingIds.size.toLocaleString()} existing shapes (will be skipped)`);
  console.log('');

  const fileSize = fs.statSync(shapesPath).size;
  const stream = fs.createReadStream(shapesPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const result: RestResult = {
    shapesRead: 0,
    shapesSent: 0,
    shapesSkipped: 0,
    shapesAlreadyLoaded: 0,
    malformedRows: 0,
    pointsRead: 0,
  };

  let bytesRead = 0;
  let lastLogAt = Date.now();
  let header: ReturnType<typeof parseColumnIndices> | null = null;

  let currentShapeId: number | null = null;
  let currentPoints: ShapePoint[] = [];
  let pendingBatch: PendingShape[] = [];
  let skipCurrent = false;

  const flush = async (): Promise<void> => {
    if (pendingBatch.length === 0) return;
    const slice = pendingBatch;
    pendingBatch = [];
    const sent = await sendBatch(client, slice, sourceVersion);
    result.shapesSent += sent;
  };

  const finalizeCurrent = (): void => {
    if (currentShapeId === null) return;
    if (skipCurrent) {
      result.shapesAlreadyLoaded += 1;
    } else if (currentPoints.length >= 2) {
      currentPoints.sort((a, b) => a.sequence - b.sequence);
      pendingBatch.push({
        shape_id: currentShapeId,
        points: currentPoints.map((p) => [p.lng, p.lat]),
      });
      result.shapesRead += 1;
    } else {
      result.shapesSkipped += 1;
    }
    currentShapeId = null;
    currentPoints = [];
    skipCurrent = false;
  };

  try {
    for await (const rawLine of rl) {
      bytesRead += Buffer.byteLength(rawLine, 'utf8') + 1;

      const line = rawLine.trim();
      if (line.length === 0) continue;

      if (header === null) {
        header = parseColumnIndices(line);
        continue;
      }

      const cells = line.split(',');
      try {
        const shapeId = Number(cells[header.shapeIdIdx]);
        const lat = Number(cells[header.latIdx]);
        const lng = Number(cells[header.lonIdx]);
        const sequence = Number(cells[header.sequenceIdx]);
        if (
          !Number.isInteger(shapeId) ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          !Number.isInteger(sequence)
        ) {
          result.malformedRows += 1;
          continue;
        }

        if (currentShapeId !== null && shapeId !== currentShapeId) {
          finalizeCurrent();
          if (result.shapesRead >= maxShapes) {
            console.log(`\nReached MAX_SHAPES=${maxShapes}. Stopping stream.`);
            break;
          }
        }

        if (currentShapeId === null) {
          currentShapeId = shapeId;
          skipCurrent = existingIds.has(shapeId);
        }
        if (!skipCurrent) {
          currentPoints.push({ lng, lat, sequence });
          result.pointsRead += 1;
        }
      } catch (err) {
        result.malformedRows += 1;
        if (result.malformedRows <= 5) {
          console.warn(`Malformed row: ${(err as Error).message}`);
        }
      }

      if (pendingBatch.length >= batchSize) {
        await flush();
      }

      const now = Date.now();
      if (now - lastLogAt > 3000) {
        lastLogAt = now;
        const pct = ((bytesRead / fileSize) * 100).toFixed(1);
        console.log(
          `  …new ${result.shapesRead.toLocaleString()} / sent ${result.shapesSent.toLocaleString()} / skipped-existing ${result.shapesAlreadyLoaded.toLocaleString()} / points ${result.pointsRead.toLocaleString()} (${pct}% of file)`
        );
      }
    }

    if (result.shapesRead < maxShapes) {
      finalizeCurrent();
    }
    await flush();
  } finally {
    rl.close();
    stream.close();
  }

  console.log('');
  console.log('Done.');
  console.log(`  shapes processed:    ${result.shapesRead.toLocaleString()}`);
  console.log(`  shapes inserted:     ${result.shapesSent.toLocaleString()}`);
  console.log(`  shapes already in DB:${result.shapesAlreadyLoaded.toLocaleString()}`);
  console.log(`  shapes too short:    ${result.shapesSkipped.toLocaleString()}`);
  console.log(`  points read:         ${result.pointsRead.toLocaleString()}`);
  console.log(`  malformed rows:      ${result.malformedRows.toLocaleString()}`);
}

const invokedAsScript = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
