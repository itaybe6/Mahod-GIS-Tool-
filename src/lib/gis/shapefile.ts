import getShapefile, { parseZip, type ShpjsResult } from 'shpjs';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import {
  detectIsraeliGrid,
  reprojectFeatureCollection,
  type IsraeliGrid,
} from './projections';

/**
 * Anything we can ingest from the user: a single `.zip`, a standalone `.shp`,
 * or the loose set of shapefile siblings (`.shp` + optional `.dbf` / `.prj` /
 * `.cpg` / `.shx`).
 *
 * Using only client-side parsing (shpjs) is a deliberate choice — see
 * `docs/DECISIONS.md` (`Client-Side Shapefile Parsing`).
 */
export interface ParsedShapefile {
  /** Single `FeatureCollection` ready to render on a Leaflet / Mapbox map. */
  geojson: FeatureCollection;
  /** Bounding box in WGS84 lng/lat order — `[minLng, minLat, maxLng, maxLat]`. */
  bbox: [number, number, number, number];
  /** Source file name shown to the user (e.g. `test.zip` or `test.shp`). */
  sourceName: string;
  /** Number of features in the resulting collection (may be > 1 for multi-feature zips). */
  featureCount: number;
  /**
   * `null` when the shapefile already arrived in WGS84 (either via a `.prj`
   * shpjs honoured, or because the coordinates were degrees to begin with).
   * Otherwise the EPSG code we auto-detected and reprojected from.
   */
  reprojectedFrom: IsraeliGrid | null;
}

export class ShapefileParseError extends Error {
  readonly code:
    | 'EMPTY_INPUT'
    | 'MISSING_SIBLINGS'
    | 'UNSUPPORTED_TYPE'
    | 'NO_GEOMETRY'
    | 'PARSE_FAILED';

  constructor(code: ShapefileParseError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ShapefileParseError';
    this.code = code;
  }
}

const SHP_SIBLING_EXTS = new Set(['shp', 'dbf', 'shx', 'prj', 'cpg']);
const GEOJSON_EXTS = new Set(['geojson', 'json']);

interface ClassifiedFiles {
  zips: File[];
  geojson: File[];
  /** Sibling files keyed by extension (lowercased, no dot). */
  siblings: Partial<Record<'shp' | 'dbf' | 'shx' | 'prj' | 'cpg', File>>;
  unknown: File[];
}

function getExt(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

function classifyFiles(files: File[]): ClassifiedFiles {
  const out: ClassifiedFiles = { zips: [], geojson: [], siblings: {}, unknown: [] };
  for (const file of files) {
    const ext = getExt(file.name);
    if (ext === 'zip') {
      out.zips.push(file);
    } else if (GEOJSON_EXTS.has(ext)) {
      out.geojson.push(file);
    } else if (SHP_SIBLING_EXTS.has(ext)) {
      out.siblings[ext as keyof ClassifiedFiles['siblings']] = file;
    } else {
      out.unknown.push(file);
    }
  }
  return out;
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/**
 * Flatten the shpjs return type — `parseZip` may return either a single
 * `FeatureCollection` (single layer) or an array of them (multi-layer zip).
 *
 * We merge multi-layer results into one `FeatureCollection` so the rest of
 * the app only has to deal with one geometry source per upload.
 */
function flattenShpjsResult(result: ShpjsResult): FeatureCollection {
  const layers = Array.isArray(result) ? result : [result];
  const features: Feature[] = [];
  for (const layer of layers) {
    if (layer && Array.isArray(layer.features)) {
      features.push(...(layer.features as Feature[]));
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Compute the bounding box of any `FeatureCollection` geometry in WGS84
 * lng/lat order. Returned as `[minLng, minLat, maxLng, maxLat]` so it can
 * feed both Leaflet (`[lat, lng]` after a swap) and Mapbox (`[lng, lat]`).
 */
export function bboxOfFeatureCollection(
  fc: FeatureCollection
): [number, number, number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (coords: Position): void => {
    const [lng, lat] = coords;
    if (typeof lng !== 'number' || typeof lat !== 'number') return;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  };

  const walk = (geometry: Geometry | null): void => {
    if (!geometry) return;
    switch (geometry.type) {
      case 'Point':
        visit(geometry.coordinates);
        break;
      case 'MultiPoint':
      case 'LineString':
        geometry.coordinates.forEach(visit);
        break;
      case 'MultiLineString':
      case 'Polygon':
        geometry.coordinates.forEach((ring) => ring.forEach(visit));
        break;
      case 'MultiPolygon':
        geometry.coordinates.forEach((poly) =>
          poly.forEach((ring) => ring.forEach(visit))
        );
        break;
      case 'GeometryCollection':
        geometry.geometries.forEach(walk);
        break;
    }
  };

  fc.features.forEach((f) => walk(f.geometry));

  if (!isFinite(minLng) || !isFinite(minLat)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Take whatever shpjs returned and make sure it ends up in WGS84.
 *
 * shpjs already reprojects when a `.prj` is present in the archive — but many
 * Israeli shapefiles ship without one, so the coordinates land in ITM/ICS
 * metres. We detect that by bbox range and reproject locally with proj4.
 *
 * Returns the (possibly reprojected) collection plus the EPSG code we used,
 * or `null` if the data was already in WGS84.
 */
function ensureWgs84(
  fc: FeatureCollection,
  bbox: [number, number, number, number]
): { geojson: FeatureCollection; bbox: [number, number, number, number]; from: IsraeliGrid | null } {
  const detected = detectIsraeliGrid(bbox);

  if (detected === 'wgs84') {
    return { geojson: fc, bbox, from: null };
  }

  if (detected === 'unknown') {
    const [minX, minY, maxX, maxY] = bbox;
    throw new ShapefileParseError(
      'NO_GEOMETRY',
      `הקואורדינטות לא ב-WGS84 וגם לא בגריד ישראלי מוכר ` +
        `(${minX.toFixed(0)}, ${minY.toFixed(0)} → ${maxX.toFixed(0)}, ${maxY.toFixed(0)}). ` +
        `הוסף .prj לארכיון או המר ל-WGS84 לפני ההעלאה.`
    );
  }

  const reprojected = reprojectFeatureCollection(detected, fc);
  const newBbox = bboxOfFeatureCollection(reprojected);
  if (!newBbox) {
    throw new ShapefileParseError(
      'NO_GEOMETRY',
      `נכשלה המרה מ-${detected} ל-WGS84.`
    );
  }
  const [lngMin, latMin, lngMax, latMax] = newBbox;
  if (lngMin < -180 || lngMax > 180 || latMin < -90 || latMax > 90) {
    throw new ShapefileParseError(
      'NO_GEOMETRY',
      `המרה מ-${detected} הניבה קואורדינטות מחוץ לטווח (${lngMin.toFixed(2)}, ${latMin.toFixed(
        2
      )} → ${lngMax.toFixed(2)}, ${latMax.toFixed(2)}).`
    );
  }
  return { geojson: reprojected, bbox: newBbox, from: detected };
}

/**
 * Lift any `Geometry | Feature | FeatureCollection` into a single normalized
 * `FeatureCollection`. Helps the rest of the pipeline stay shape-agnostic.
 */
function normalizeGeoJsonRoot(root: unknown): FeatureCollection {
  if (!root || typeof root !== 'object') {
    throw new ShapefileParseError('PARSE_FAILED', 'GeoJSON ריק או לא תקין.');
  }
  const candidate = root as { type?: string };
  switch (candidate.type) {
    case 'FeatureCollection':
      return root as FeatureCollection;
    case 'Feature':
      return { type: 'FeatureCollection', features: [root as Feature] };
    case 'Point':
    case 'MultiPoint':
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
    case 'GeometryCollection':
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: root as Geometry, properties: {} }],
      };
    default:
      throw new ShapefileParseError(
        'PARSE_FAILED',
        `ה-JSON אינו GeoJSON תקני (type='${String(candidate.type)}').`
      );
  }
}

async function parseGeoJsonFile(file: File): Promise<FeatureCollection> {
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    throw new ShapefileParseError(
      'PARSE_FAILED',
      `נכשלה קריאת ה-GeoJSON: ${(err as Error).message}`,
      { cause: err }
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ShapefileParseError(
      'PARSE_FAILED',
      `הקובץ אינו JSON תקין: ${(err as Error).message}`,
      { cause: err }
    );
  }
  return normalizeGeoJsonRoot(parsed);
}

/**
 * Magic-byte / content sniff for files with no (or wrong) extension. Returns
 * the actual content kind we should treat the file as. Order matters: ZIP
 * starts with `PK\x03\x04`, shapefiles start with the big-endian file code
 * `0x0000_270A`, GeoJSON starts with `{` once whitespace is skipped.
 */
async function sniffFileKind(
  file: File
): Promise<'zip' | 'shp' | 'geojson' | 'unknown'> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head.length >= 4) {
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) {
      return 'zip';
    }
    if (head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x27 && head[3] === 0x0a) {
      return 'shp';
    }
  }
  // First non-whitespace byte for JSON/GeoJSON detection.
  for (const byte of head) {
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    if (byte === 0x7b /* '{' */ || byte === 0x5b /* '[' */) return 'geojson';
    break;
  }
  return 'unknown';
}

/**
 * Main entry point — parse a `FileList`/`File[]` (drag-drop or `<input type=file>`)
 * into a single normalized `FeatureCollection` in WGS84 plus its bbox.
 *
 * Accepts (in priority order):
 *   1. A single `.zip` containing the shapefile bundle (preferred for SHP).
 *   2. A single `.geojson` / `.json` file.
 *   3. The loose siblings (`.shp` + optional `.dbf` / `.prj` / `.cpg`).
 *
 * Files with no extension are sniffed by magic bytes so the user can drop a
 * raw export straight from a CLI without renaming first.
 */
export async function parseShapefileFromFiles(
  fileList: FileList | File[]
): Promise<ParsedShapefile> {
  const files = Array.from(fileList);
  if (files.length === 0) {
    throw new ShapefileParseError('EMPTY_INPUT', 'לא נבחרו קבצים.');
  }

  const { zips, geojson, siblings, unknown } = classifyFiles(files);

  // If only "unknown" files arrived, content-sniff them and re-route.
  if (zips.length === 0 && geojson.length === 0 && !siblings.shp && unknown.length > 0) {
    for (const file of unknown) {
      const kind = await sniffFileKind(file);
      if (kind === 'zip') zips.push(file);
      else if (kind === 'shp') siblings.shp = file;
      else if (kind === 'geojson') geojson.push(file);
    }
  }

  // Path A — a single zip (most common, matches today's UX).
  if (zips.length > 0) {
    const zip = zips[0]!;
    let result: ShpjsResult;
    try {
      const buf = await fileToArrayBuffer(zip);
      result = await parseZip(buf);
    } catch (err) {
      throw new ShapefileParseError(
        'PARSE_FAILED',
        `נכשל פרסור ה-ZIP: ${(err as Error).message}`,
        { cause: err }
      );
    }
    return finalize(flattenShpjsResult(result), zip.name);
  }

  // Path B — GeoJSON file.
  if (geojson.length > 0) {
    const gjFile = geojson[0]!;
    const fc = await parseGeoJsonFile(gjFile);
    return finalize(fc, gjFile.name);
  }

  // Path C — sibling files. `.shp` carries geometry by itself; `.dbf` only
  // enriches features with attributes when the user provides it.
  if (siblings.shp) {
    let result: ShpjsResult;
    try {
      const [shp, dbf, prj, cpg] = await Promise.all([
        fileToArrayBuffer(siblings.shp),
        siblings.dbf ? fileToArrayBuffer(siblings.dbf) : Promise.resolve(undefined),
        siblings.prj ? siblings.prj.text() : Promise.resolve(undefined),
        siblings.cpg ? siblings.cpg.text() : Promise.resolve(undefined),
      ]);
      const bundle: Parameters<typeof getShapefile>[0] = { shp };
      if (dbf) (bundle as { dbf?: ArrayBuffer }).dbf = dbf;
      if (typeof prj === 'string') (bundle as { prj?: string }).prj = prj;
      if (typeof cpg === 'string') (bundle as { cpg?: string }).cpg = cpg;
      result = await getShapefile(bundle);
    } catch (err) {
      throw new ShapefileParseError(
        'PARSE_FAILED',
        `נכשל פרסור הקבצים: ${(err as Error).message}`,
        { cause: err }
      );
    }
    return finalize(flattenShpjsResult(result), siblings.shp.name);
  }

  if (unknown.length > 0) {
    throw new ShapefileParseError(
      'UNSUPPORTED_TYPE',
      `סוג קובץ לא נתמך (${unknown.map((f) => f.name).join(', ')}). יש להעלות .zip / .geojson / .shp.`
    );
  }

  throw new ShapefileParseError(
    'EMPTY_INPUT',
    'לא נמצא קובץ נתמך (.zip / .geojson / .shp).'
  );
}

function finalize(geojson: FeatureCollection, sourceName: string): ParsedShapefile {
  if (!geojson.features.length) {
    throw new ShapefileParseError('NO_GEOMETRY', 'הקובץ פורסר אך לא מכיל פיצ\'רים גיאוגרפיים.');
  }
  const rawBbox = bboxOfFeatureCollection(geojson);
  if (!rawBbox) {
    throw new ShapefileParseError(
      'NO_GEOMETRY',
      'לא ניתן לחשב bbox — אין קואורדינטות מספריות תקינות.'
    );
  }
  const ensured = ensureWgs84(geojson, rawBbox);
  return {
    geojson: ensured.geojson,
    bbox: ensured.bbox,
    sourceName,
    featureCount: ensured.geojson.features.length,
    reprojectedFrom: ensured.from,
  };
}
