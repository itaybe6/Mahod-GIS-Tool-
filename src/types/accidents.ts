import type { Coordinates, Severity } from './common';

/**
 * Road-accident record (LMS — data.gov.il).
 * Full schema will be derived from the official CSV once ingested.
 */
export interface AccidentRecord extends Coordinates {
  id: string;
  /** Location label (intersection / street). */
  location: string;
  occurredAt: Date;
  severity: Severity;
  /** Count of casualties / events at this location (used for heatmap weighting). */
  count: number;
}
