import proj4 from 'proj4';
import type { FeatureCollection, Geometry, Position } from 'geojson';

/**
 * Israeli grid CRS definitions.
 *
 * shpjs invokes proj4 only when the archive includes a `.prj` file. Many
 * shapefiles produced by Israeli agencies (and the mission's `test.zip`)
 * ship without a `.prj`, so the coordinates land in metres rather than
 * degrees. We reproject locally based on the bbox range — see
 * `detectIsraeliGrid` below.
 *
 * Definitions copied verbatim from epsg.io.
 */
export const PROJ_DEFS = {
  'EPSG:2039':
    '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 ' +
    '+k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 ' +
    '+towgs84=-24.0024,-17.1032,-17.8444,-0.33077,-1.85269,1.66969,5.4248 ' +
    '+units=m +no_defs',
  'EPSG:28191':
    '+proj=cass +lat_0=31.73439361111111 +lon_0=35.21208055555556 ' +
    '+x_0=170251.555 +y_0=126867.909 +a=6378300.789 +b=6356566.435 ' +
    '+towgs84=-275.7224,94.7824,340.8944,-8.001,-4.42,-11.821,1.0 ' +
    '+units=m +no_defs',
} as const;

export type IsraeliGrid = keyof typeof PROJ_DEFS;

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  for (const [code, def] of Object.entries(PROJ_DEFS)) {
    proj4.defs(code, def);
  }
  registered = true;
}

/**
 * Heuristic CRS detection. Looks at a bbox in `[minLng, minLat, maxLng, maxLat]`
 * order (the same order shpjs leaves us in) and decides whether it's already
 * WGS84, ITM 2039, ICS 28191, or "unknown / not over Israel".
 *
 * The ranges are intentionally generous — exact Israeli grid extents differ by
 * a few km at the borders, but the WGS84/ITM/ICS clusters are far enough apart
 * (tens of thousands of metres vs. < 360 degrees) that there's no overlap.
 */
export function detectIsraeliGrid(
  bbox: [number, number, number, number]
): IsraeliGrid | 'wgs84' | 'unknown' {
  const [minX, minY, maxX, maxY] = bbox;

  const lonOk = minX >= -180 && maxX <= 180;
  const latOk = minY >= -90 && maxY <= 90;
  if (lonOk && latOk) return 'wgs84';

  const inItm =
    minX >= 100000 &&
    maxX <= 320000 &&
    minY >= 350000 &&
    maxY <= 1100000;
  if (inItm) return 'EPSG:2039';

  const inIcs =
    minX >= 100000 &&
    maxX <= 280000 &&
    minY >= 550000 &&
    maxY <= 1400000;
  if (inIcs) return 'EPSG:28191';

  return 'unknown';
}

/**
 * Project a single `(x, y)` from the given source CRS to WGS84
 * `(lng, lat)`, leaving any extra coordinate (e.g. Z) untouched.
 */
function projectPosition(source: IsraeliGrid, position: Position): Position {
  const [x, y, ...rest] = position;
  if (typeof x !== 'number' || typeof y !== 'number') return position;
  const [lng, lat] = proj4(source, 'EPSG:4326', [x, y]) as [number, number];
  return rest.length > 0 ? [lng, lat, ...rest] : [lng, lat];
}

function projectGeometry(source: IsraeliGrid, geometry: Geometry | null): Geometry | null {
  if (!geometry) return geometry;
  switch (geometry.type) {
    case 'Point':
      return { type: 'Point', coordinates: projectPosition(source, geometry.coordinates) };
    case 'MultiPoint':
      return {
        type: 'MultiPoint',
        coordinates: geometry.coordinates.map((c) => projectPosition(source, c)),
      };
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: geometry.coordinates.map((c) => projectPosition(source, c)),
      };
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geometry.coordinates.map((line) =>
          line.map((c) => projectPosition(source, c))
        ),
      };
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map((ring) =>
          ring.map((c) => projectPosition(source, c))
        ),
      };
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map((poly) =>
          poly.map((ring) => ring.map((c) => projectPosition(source, c)))
        ),
      };
    case 'GeometryCollection':
      return {
        type: 'GeometryCollection',
        geometries: geometry.geometries
          .map((g) => projectGeometry(source, g))
          .filter((g): g is Geometry => g !== null),
      };
    default:
      return geometry;
  }
}

/**
 * Return a new `FeatureCollection` whose every coordinate has been projected
 * from `source` to WGS84. Properties are preserved by reference.
 */
export function reprojectFeatureCollection(
  source: IsraeliGrid,
  fc: FeatureCollection
): FeatureCollection {
  ensureRegistered();
  return {
    ...fc,
    features: fc.features.map((feature) => ({
      ...feature,
      geometry: projectGeometry(source, feature.geometry) as typeof feature.geometry,
    })),
  };
}
