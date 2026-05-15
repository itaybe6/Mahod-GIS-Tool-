/**
 * types.ts — shared types for the update-agent edge function.
 *
 * Each data source provides an `Adapter` that the dispatcher in `index.ts`
 * consumes uniformly:
 *   1. `primaryResourceName` — the CKAN resource the dispatcher uses for
 *      change detection (`hasChanged()` against `data_sources.last_modified`).
 *   2. `run()` — owns the full pipeline (download → parse → upsert) for the
 *      adapter's specific tables and returns row counts + optional notes.
 *
 * Splitting upsert ownership into the adapter (instead of a single
 * `upsertX` in index.ts) is what lets us add data sources whose target
 * schemas differ — e.g. accidents writes one table while vehicle_counts
 * writes three.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CkanPackage } from "./ckan.ts";

export interface AdapterRunResult {
  inserted: number;
  updated: number;
  deleted?: number;
  notes?: string;
}

export interface Adapter {
  /** CKAN resource name used to detect changes against data_sources.last_modified. */
  primaryResourceName: string;

  /**
   * Runs the adapter pipeline end-to-end:
   * download from CKAN → parse → upsert into the adapter's target tables.
   *
   * @param pkg            CkanPackage as returned by `packageShow`
   * @param db             Supabase client (service role)
   * @param sourceVersion  ISO timestamp of the primary resource at run start.
   *                       Adapters propagate this as `source_version` so we
   *                       can correlate rows with a specific dataset version.
   */
  run(
    pkg: CkanPackage,
    db: SupabaseClient,
    sourceVersion: string,
  ): Promise<AdapterRunResult>;
}
