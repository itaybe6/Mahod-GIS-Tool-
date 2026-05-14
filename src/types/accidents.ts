import type { Coordinates, Severity } from './common';

/**
 * Client-side accident feature (map / analysis). The Supabase `accidents`
 * table holds CBS TAZ aggregates (`accid_taz`); polygon RPC returns
 * per-municipality features with properties such as `accidents`, `fatal`, etc.
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
