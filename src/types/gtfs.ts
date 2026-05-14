import type { Coordinates } from './common';

/**
 * GTFS-related types used by Supabase-backed tables and local heavy-file readers.
 * `shapes.txt` and `stop_times.txt` stay outside Supabase and are streamed on demand.
 */

export type TransitMode = 'bus' | 'lightrail' | 'train' | 'tram' | 'other';

export interface TransitStop extends Coordinates {
  id: string;
  name: string;
  mode: TransitMode;
}

export interface TransitRoute {
  id: string;
  shortName: string;
  longName?: string;
  color: string;
  mode: TransitMode;
  coords: Coordinates[];
}

export interface GtfsShapePoint extends Coordinates {
  shapeId: string;
  sequence: number;
}

export interface GtfsShapeLine {
  shapeId: string;
  coords: Coordinates[];
}

export interface GtfsStopTime {
  tripId: string;
  stopSequence: number;
  stopId: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  pickupType: number | null;
  dropOffType: number | null;
  shapeDistTraveled: number | null;
}
