import type { Coordinates } from './common';

/**
 * Road segment (Netivei Israel network).
 */
export interface RoadSegment {
  id: string;
  name: string;
  /** Polyline geometry as a list of coordinates. */
  coords: Coordinates[];
  /** Optional kilometer length of the segment. */
  lengthKm?: number;
}
