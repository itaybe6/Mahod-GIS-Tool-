import { supabase } from '@/lib/supabase/client';

export type GtfsShapesSchemaMode = 'line' | 'point';

/**
 * Detects which `gtfs_shapes` layout the hosted DB uses:
 * - **line**: one row per `shape_id` with `point_count` (+ geom, audit columns).
 * - **point**: standard `shapes.txt` — one row per point (`shape_pt_sequence`).
 *
 * Defaults to `line` when the table is missing or both probes fail.
 */
export async function probeGtfsShapesSchema(): Promise<GtfsShapesSchemaMode> {
  const lineProbe = await supabase.from('gtfs_shapes').select('shape_id,point_count').limit(1);
  if (!lineProbe.error) return 'line';

  const pointProbe = await supabase
    .from('gtfs_shapes')
    .select('shape_id,shape_pt_sequence')
    .limit(1);
  if (!pointProbe.error) return 'point';

  return 'line';
}
