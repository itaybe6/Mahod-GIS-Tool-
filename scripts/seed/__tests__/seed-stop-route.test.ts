/**
 * Unit tests for `seedStopRoute` — they use **pg-mem** (in-memory Postgres), not your Supabase project.
 * Passing these tests does **not** fill `public.gtfs_stop_route` in the cloud DB.
 *
 * To load real data: from repo root run `npm run seed:stop-route` with `DATABASE_URL` + `stop_times.txt`
 * (see README “GTFS seed order”).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newDb } from 'pg-mem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { seedStopRoute } from '../seed-stop-route.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('seedStopRoute', () => {
  it('creates unique gtfs_stop_route entries and ignores duplicates', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const pool = createTestPool();
    const client = await pool.connect();
    const stopTimesPath = await writeStopTimesFile([
      'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
      'trip-a,05:00:00,05:00:00,100,1',
      'trip-a,05:01:00,05:01:00,100,2',
      'trip-b,06:00:00,06:00:00,100,1',
      'trip-b,06:01:00,06:01:00,100,2',
      'missing-trip,07:00:00,07:00:00,200,1',
    ]);

    try {
      const result = await seedStopRoute({
        stopTimesPath,
        sourceVersion: 'test-version',
        client,
      });

      const { rows } = await pool.query<{
        stop_id: number;
        route_id: number;
        direction_id: number;
        source_version: string;
      }>('SELECT stop_id, route_id, direction_id, source_version FROM gtfs_stop_route ORDER BY route_id');

      expect(result).toEqual({
        rowsRead: 5,
        uniqueLinks: 2,
        skipped: 1,
      });
      expect(rows).toEqual([
        { stop_id: 100, route_id: 10, direction_id: 0, source_version: 'test-version' },
        { stop_id: 100, route_id: 20, direction_id: 1, source_version: 'test-version' },
      ]);
    } finally {
      client.release();
      await pool.end();
    }
  });
});

function createTestPool(): Pool {
  const db = newDb();
  db.public.none(`
    CREATE TABLE gtfs_trips (
      trip_id TEXT PRIMARY KEY,
      route_id INTEGER,
      direction_id SMALLINT
    );

    CREATE TABLE gtfs_stop_route (
      stop_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      direction_id SMALLINT NOT NULL,
      source_version TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (stop_id, route_id, direction_id)
    );

    INSERT INTO gtfs_trips (trip_id, route_id, direction_id) VALUES
      ('trip-a', 10, 0),
      ('trip-b', 20, 1);
  `);

  const adapter = db.adapters.createPg();
  const PoolCtor = adapter.Pool as unknown as new () => Pool;
  return new PoolCtor();
}

async function writeStopTimesFile(lines: string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'seed-stop-route-'));
  tempDirs.push(dir);
  const stopTimesPath = join(dir, 'stop_times.txt');
  await writeFile(stopTimesPath, `${lines.join('\n')}\n`, 'utf8');
  return stopTimesPath;
}
