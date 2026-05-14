/**
 * Cross-cutting types used by multiple features.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export type LatLngTuple = [lat: number, lng: number];

export interface DateRange {
  from: Date;
  to: Date;
}

export type Severity = 'low' | 'mid' | 'high';

export interface MetaChip {
  label: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  severity: Severity;
  meta: MetaChip[];
  /** Domain this result belongs to — used to filter by active layer. */
  domain: 'accidents' | 'transit' | 'roads' | 'infrastructure';
}

export type LayerKey = 'transit' | 'accidents' | 'roads' | 'infrastructure';

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}
