import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import type { IsraeliGrid } from '@/lib/gis/projections';

export type UploadStatus = 'idle' | 'parsing' | 'ready' | 'error';

/** One municipality returned by `find_municipalities_for_polygon`. */
export interface MunicipalityHit {
  semel_yishuv: number | null;
  name_he: string;
  name_en: string | null;
  nafa: string | null;
  mahoz: string | null;
  overlap_area_m2: number;
  overlap_pct: number | null;
  /** True when the polygon doesn't overlap any municipality and this is the nearest one. */
  is_nearest: boolean;
  /** Distance (m) between the polygon and the municipality. `0` for direct overlaps. */
  distance_m: number;
}

export type MunicipalityLookupStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UploadState {
  status: UploadStatus;
  /** WGS84 GeoJSON ready to render on the map. */
  polygon: FeatureCollection | null;
  /** `[minLng, minLat, maxLng, maxLat]` matching `polygon`. */
  bbox: [number, number, number, number] | null;
  /** Original file name shown in the UI (e.g. `test.zip`). */
  sourceName: string | null;
  featureCount: number;
  /** Set when the file arrived in an Israeli grid and we reprojected on the fly. */
  reprojectedFrom: IsraeliGrid | null;
  /** Last user-facing error message (Hebrew). Cleared by `setParsing` / `setPolygon`. */
  error: string | null;

  /** Status of the municipalities-RPC call (independent from the upload status). */
  municipalitiesStatus: MunicipalityLookupStatus;
  municipalities: MunicipalityHit[] | null;
  municipalitiesError: string | null;

  setParsing: (sourceName: string) => void;
  setPolygon: (payload: {
    polygon: FeatureCollection;
    bbox: [number, number, number, number];
    sourceName: string;
    featureCount: number;
    reprojectedFrom: IsraeliGrid | null;
  }) => void;
  setError: (message: string) => void;
  setMunicipalitiesLoading: () => void;
  setMunicipalities: (hits: MunicipalityHit[]) => void;
  setMunicipalitiesError: (message: string) => void;
  clear: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  status: 'idle',
  polygon: null,
  bbox: null,
  sourceName: null,
  featureCount: 0,
  reprojectedFrom: null,
  error: null,
  municipalitiesStatus: 'idle',
  municipalities: null,
  municipalitiesError: null,

  setParsing: (sourceName) =>
    set({
      status: 'parsing',
      sourceName,
      error: null,
      municipalitiesStatus: 'idle',
      municipalities: null,
      municipalitiesError: null,
    }),
  setPolygon: ({ polygon, bbox, sourceName, featureCount, reprojectedFrom }) =>
    set({
      status: 'ready',
      polygon,
      bbox,
      sourceName,
      featureCount,
      reprojectedFrom,
      error: null,
    }),
  setError: (message) =>
    set({
      status: 'error',
      error: message,
    }),
  setMunicipalitiesLoading: () =>
    set({
      municipalitiesStatus: 'loading',
      municipalities: null,
      municipalitiesError: null,
    }),
  setMunicipalities: (hits) =>
    set({
      municipalitiesStatus: 'ready',
      municipalities: hits,
      municipalitiesError: null,
    }),
  setMunicipalitiesError: (message) =>
    set({
      municipalitiesStatus: 'error',
      municipalities: null,
      municipalitiesError: message,
    }),
  clear: () =>
    set({
      status: 'idle',
      polygon: null,
      bbox: null,
      sourceName: null,
      featureCount: 0,
      reprojectedFrom: null,
      error: null,
      municipalitiesStatus: 'idle',
      municipalities: null,
      municipalitiesError: null,
    }),
}));
