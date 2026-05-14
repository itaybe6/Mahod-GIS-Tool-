/**
 * Minimal type declarations for `shpjs` (https://github.com/calvinmetcalf/shapefile-js).
 * The package ships without `.d.ts` so we expose only the surface we actually use:
 * a single `getShapefile` default export plus the lower-level `parseZip` helper.
 */
declare module 'shpjs' {
  import type { Feature, FeatureCollection, Geometry } from 'geojson';

  /** Each parsed layer is a GeoJSON `FeatureCollection` annotated with the source file name. */
  export interface ShpjsFeatureCollection<G extends Geometry = Geometry, P = Record<string, unknown>>
    extends FeatureCollection<G, P> {
    fileName?: string;
  }

  export type ShpjsResult<G extends Geometry = Geometry, P = Record<string, unknown>> =
    | ShpjsFeatureCollection<G, P>
    | Array<ShpjsFeatureCollection<G, P>>;

  /**
   * Parse a zipped shapefile bundle (`.shp` + `.dbf` [+ `.prj`/`.cpg`]) supplied as a
   * binary buffer. Returns a single `FeatureCollection`, or an array of them when the
   * archive contains multiple layers.
   */
  export function parseZip<G extends Geometry = Geometry, P = Record<string, unknown>>(
    buffer: ArrayBuffer | ArrayBufferView,
    whiteList?: string[]
  ): Promise<ShpjsResult<G, P>>;

  /**
   * Convenience entrypoint: accepts a URL string, a binary buffer, or an object
   * `{ shp, dbf, cpg, prj }` of raw component buffers.
   */
  export default function getShapefile<
    G extends Geometry = Geometry,
    P = Record<string, unknown>,
  >(
    base:
      | string
      | ArrayBuffer
      | ArrayBufferView
      | {
          shp: ArrayBuffer | ArrayBufferView;
          dbf?: ArrayBuffer | ArrayBufferView;
          cpg?: ArrayBuffer | ArrayBufferView | string;
          prj?: ArrayBuffer | ArrayBufferView | string;
        },
    whiteList?: string[]
  ): Promise<ShpjsResult<G, P>>;

  // Re-export utility helpers in case we ever need lower-level access.
  export function parseShp<G extends Geometry = Geometry>(
    shp: ArrayBuffer | ArrayBufferView,
    prj?: unknown
  ): G[];

  export function parseDbf<P = Record<string, unknown>>(
    dbf: ArrayBuffer | ArrayBufferView,
    cpg?: ArrayBuffer | ArrayBufferView | string
  ): P[];

  export function combine<G extends Geometry = Geometry, P = Record<string, unknown>>(
    parts: [G[], P[] | undefined]
  ): FeatureCollection<G, P>;
}
