import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataType, newDb } from 'pg-mem';
import { afterEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { seedShapes } from '../seed-shapes.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('seedShapes', () => {
  it('inserts all shape_ids from a small shapes.txt', async () => {
    const pool = createTestPool();
    const gtfsPath = await writeShapesFile([
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
      '1,32.1,34.1,1',
      '1,32.2,34.2,2',
      '2,32.3,34.3,1',
      '2,32.4,34.4,2',
      '3,32.5,34.5,1',
      '3,32.6,34.6,2',
    ]);

    const result = await seedShapes(testOptions(pool, gtfsPath));
    const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM gtfs_shapes');

    expect(result.shapesFound).toBe(3);
    expect(result.shapesInserted).toBe(3);
    expect(Number(rows[0]?.count)).toBe(3);
  });

  it('skips a shape with fewer than two points', async () => {
    const pool = createTestPool();
    const gtfsPath = await writeShapesFile([
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
      '1,32.1,34.1,1',
      '1,32.2,34.2,2',
      '2,32.3,34.3,1',
    ]);

    const result = await seedShapes(testOptions(pool, gtfsPath));
    const { rows } = await pool.query<{ shape_id: number }>('SELECT shape_id FROM gtfs_shapes ORDER BY shape_id');

    expect(result.skippedInvalid).toBe(1);
    expect(rows).toEqual([{ shape_id: 1 }]);
  });

  it('orders shape_pt_sequence numerically before building WKT', async () => {
    const pool = createTestPool();
    const gtfsPath = await writeShapesFile([
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence',
      '10,32.2,34.2,10',
      '10,32.1,34.1,2',
      '10,32.0,34.0,1',
    ]);

    await seedShapes(testOptions(pool, gtfsPath));
    const { rows } = await pool.query<{ geom: string }>('SELECT geom FROM gtfs_shapes WHERE shape_id = 10');

    expect(rows[0]?.geom).toBe('LINESTRING(34 32,34.1 32.1,34.2 32.2)');
  });
});

function createTestPool(): Pool {
  const db = newDb();
  db.public.registerFunction({
    name: 'st_geomfromtext',
    args: [DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (wkt: string) => wkt,
  });
  db.public.none(`
    CREATE TABLE gtfs_shapes (
      shape_id INTEGER PRIMARY KEY,
      geom TEXT NOT NULL,
      point_count INTEGER,
      source_version TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const adapter = db.adapters.createPg();
  const PoolCtor = adapter.Pool as unknown as new () => Pool;
  return new PoolCtor();
}

async function writeShapesFile(lines: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'seed-shapes-'));
  tempDirs.push(dir);
  const gtfsPath = join(dir, 'shapes.txt');
  await writeFile(gtfsPath, `${lines.join('\n')}\n`, 'utf8');
  return gtfsPath;
}

function testOptions(pool: Pool, gtfsPath: string) {
  return {
    gtfsPath,
    pool,
    sourceVersion: 'test-version',
    batchSize: 2,
    progress: false,
    ensureSchema: false,
    trackUpdates: false,
  };
}
