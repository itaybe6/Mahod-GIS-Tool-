import type { GtfsShapeLine, GtfsShapePoint, GtfsStopTime } from '@/types/gtfs';

const DEFAULT_CHUNK_SIZE = 100_000;

export const LOCAL_GTFS_FILES = {
  shapes: '/gtfs/shapes.txt',
  stopTimes: '/gtfs/stop_times.txt',
} as const;

type CsvRow = Record<string, string>;

interface StreamRowsOptions {
  chunkSize?: number;
  signal?: AbortSignal;
}

interface LocalGtfsQueryOptions extends StreamRowsOptions {
  fileUrl?: string;
}

const SHAPE_COLUMNS = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'] as const;

const STOP_TIME_COLUMNS = [
  'trip_id',
  'arrival_time',
  'departure_time',
  'stop_id',
  'stop_sequence',
  'pickup_type',
  'drop_off_type',
  'shape_dist_traveled',
] as const;

export async function* streamShapePointsByShapeIds(
  shapeIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): AsyncGenerator<GtfsShapePoint[]> {
  const wantedShapeIds = toStringSet(shapeIds);

  if (wantedShapeIds.size === 0) {
    return;
  }

  for await (const chunk of streamSelectedCsvRows(
    options.fileUrl ?? LOCAL_GTFS_FILES.shapes,
    SHAPE_COLUMNS,
    options,
  )) {
    const points = chunk
      .filter((row) => wantedShapeIds.has(row.shape_id ?? ''))
      .map(mapShapePoint)
      .filter((point): point is GtfsShapePoint => point !== null);

    if (points.length > 0) {
      yield points;
    }
  }
}

export async function loadShapeLinesForShapeIds(
  shapeIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): Promise<Map<string, GtfsShapeLine>> {
  const pointsByShapeId = new Map<string, GtfsShapePoint[]>();

  for await (const points of streamShapePointsByShapeIds(shapeIds, options)) {
    for (const point of points) {
      const existing = pointsByShapeId.get(point.shapeId);

      if (existing) {
        existing.push(point);
      } else {
        pointsByShapeId.set(point.shapeId, [point]);
      }
    }
  }

  const lines = new Map<string, GtfsShapeLine>();

  for (const [shapeId, points] of pointsByShapeId) {
    const coords = points
      .sort((a, b) => a.sequence - b.sequence)
      .map(({ lat, lng }) => ({ lat, lng }));

    if (coords.length >= 2) {
      lines.set(shapeId, { shapeId, coords });
    }
  }

  return lines;
}

export async function* streamStopTimesByTripIds(
  tripIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): AsyncGenerator<GtfsStopTime[]> {
  const wantedTripIds = toStringSet(tripIds);

  if (wantedTripIds.size === 0) {
    return;
  }

  for await (const chunk of streamSelectedCsvRows(
    options.fileUrl ?? LOCAL_GTFS_FILES.stopTimes,
    STOP_TIME_COLUMNS,
    options,
  )) {
    const stopTimes = chunk
      .filter((row) => wantedTripIds.has(row.trip_id ?? ''))
      .map(mapStopTime)
      .filter((stopTime): stopTime is GtfsStopTime => stopTime !== null);

    if (stopTimes.length > 0) {
      yield stopTimes;
    }
  }
}

export async function loadStopTimesForTripIds(
  tripIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): Promise<Map<string, GtfsStopTime[]>> {
  const stopTimesByTripId = new Map<string, GtfsStopTime[]>();

  for await (const stopTimes of streamStopTimesByTripIds(tripIds, options)) {
    for (const stopTime of stopTimes) {
      const existing = stopTimesByTripId.get(stopTime.tripId);

      if (existing) {
        existing.push(stopTime);
      } else {
        stopTimesByTripId.set(stopTime.tripId, [stopTime]);
      }
    }
  }

  for (const stopTimes of stopTimesByTripId.values()) {
    stopTimes.sort((a, b) => a.stopSequence - b.stopSequence);
  }

  return stopTimesByTripId;
}

export async function* streamStopTimesByStopIds(
  stopIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): AsyncGenerator<GtfsStopTime[]> {
  const wantedStopIds = toStringSet(stopIds);

  if (wantedStopIds.size === 0) {
    return;
  }

  for await (const chunk of streamSelectedCsvRows(
    options.fileUrl ?? LOCAL_GTFS_FILES.stopTimes,
    STOP_TIME_COLUMNS,
    options,
  )) {
    const stopTimes = chunk
      .filter((row) => wantedStopIds.has(row.stop_id ?? ''))
      .map(mapStopTime)
      .filter((stopTime): stopTime is GtfsStopTime => stopTime !== null);

    if (stopTimes.length > 0) {
      yield stopTimes;
    }
  }
}

export async function loadStopTimesForStopIds(
  stopIds: Iterable<string | number>,
  options: LocalGtfsQueryOptions = {},
): Promise<Map<string, GtfsStopTime[]>> {
  const stopTimesByStopId = new Map<string, GtfsStopTime[]>();

  for await (const stopTimes of streamStopTimesByStopIds(stopIds, options)) {
    for (const stopTime of stopTimes) {
      if (stopTime.stopId === null) {
        continue;
      }

      const existing = stopTimesByStopId.get(stopTime.stopId);

      if (existing) {
        existing.push(stopTime);
      } else {
        stopTimesByStopId.set(stopTime.stopId, [stopTime]);
      }
    }
  }

  for (const stopTimes of stopTimesByStopId.values()) {
    stopTimes.sort((a, b) => {
      const tripOrder = a.tripId.localeCompare(b.tripId);

      return tripOrder === 0 ? a.stopSequence - b.stopSequence : tripOrder;
    });
  }

  return stopTimesByStopId;
}

async function* streamSelectedCsvRows(
  fileUrl: string,
  columns: readonly string[],
  options: StreamRowsOptions,
): AsyncGenerator<CsvRow[]> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  let selectedColumns: Array<{ name: string; index: number }> | null = null;
  let chunk: CsvRow[] = [];

  for await (const line of streamTextLines(fileUrl, options.signal)) {
    if (line.length === 0) {
      continue;
    }

    if (selectedColumns === null) {
      const headers = parseCsvLine(stripBom(line));
      selectedColumns = columns.map((name) => {
        const index = headers.indexOf(name);

        if (index === -1) {
          throw new Error(`Missing GTFS column "${name}" in ${fileUrl}`);
        }

        return { name, index };
      });
      continue;
    }

    const values = parseCsvLine(line);
    const row: CsvRow = {};

    for (const column of selectedColumns) {
      row[column.name] = values[column.index] ?? '';
    }

    chunk.push(row);

    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}

async function* streamTextLines(fileUrl: string, signal?: AbortSignal): AsyncGenerator<string> {
  const response = await fetch(fileUrl, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`Failed to load ${fileUrl}: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`Streaming is not supported for ${fileUrl}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        yield stripTrailingCarriageReturn(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.length > 0) {
      yield stripTrailingCarriageReturn(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let index = 0;

  while (index < line.length) {
    const char = line[index] ?? '';

    if (char === '"') {
      const nextChar = line[index + 1];

      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  values.push(current);

  return values;
}

function mapShapePoint(row: CsvRow): GtfsShapePoint | null {
  const lat = toNumber(row.shape_pt_lat);
  const lng = toNumber(row.shape_pt_lon);
  const sequence = toNumber(row.shape_pt_sequence);
  const shapeId = row.shape_id;

  if (!shapeId || lat === null || lng === null || sequence === null) {
    return null;
  }

  return {
    shapeId,
    lat,
    lng,
    sequence,
  };
}

function mapStopTime(row: CsvRow): GtfsStopTime | null {
  const stopSequence = toNumber(row.stop_sequence);
  const tripId = row.trip_id;

  if (!tripId || stopSequence === null) {
    return null;
  }

  return {
    tripId,
    stopSequence,
    stopId: row.stop_id || null,
    arrivalTime: row.arrival_time || null,
    departureTime: row.departure_time || null,
    pickupType: toNumber(row.pickup_type),
    dropOffType: toNumber(row.drop_off_type),
    shapeDistTraveled: toNumber(row.shape_dist_traveled),
  };
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function toStringSet(values: Iterable<string | number>): Set<string> {
  return new Set(Array.from(values, String));
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function stripTrailingCarriageReturn(value: string): string {
  return value.endsWith('\r') ? value.slice(0, -1) : value;
}
