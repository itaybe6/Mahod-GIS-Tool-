/**
 * index.ts — Supabase Edge Function: update-agent
 *
 * Entry point. Handles:
 *   - HTTP trigger (manual / pg_net webhook)
 *   - ?force=true   → skip change detection, always update
 *   - ?source=name  → run only one source (default: all active sources)
 *
 * Currently wired:
 *   - accidents      (accid_taz)
 *   - traffic_counts (vehicle_counts → Countsvol4_YYYY)
 *   - railway        (rail_stat → RAIL_STAT_CSV + RAIL_STAT_SHP)
 *   - lrt            (lrt_stat  → LRT_STAT_CSV  + LRT_STAT_SHP)
 *
 * Add new adapters by creating a module that exports a default `Adapter`
 * (see `./types.ts`) and registering it in ADAPTER_MAP below.
 *
 * Deno runtime — no Node APIs, no filesystem.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasChanged, packageShow, pickResourceByName } from "./ckan.ts";
import type { Adapter } from "./types.ts";
import accidentsAdapter from "./adapters/accidents.ts";
import vehicleCountsAdapter from "./adapters/vehicleCounts.ts";
import railwayAdapter from "./adapters/railway.ts";
import lrtAdapter from "./adapters/lrt.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataSource {
  id: number;
  name: string;
  display_name: string;
  source_url: string;         // CKAN dataset landing URL — we extract the id from it
  last_modified: string | null;
  last_checked_at: string | null;
  status: "active" | "error" | "disabled";
  metadata: Record<string, unknown>;
}

interface UpdateLogEntry {
  source_id: number;
  started_at: string;
  status: "running" | "success" | "failed" | "skipped" | "rolled_back";
  trigger: "scheduled" | "manual" | "force";
  rows_inserted: number;
  rows_updated: number;
  rows_deleted: number;
  finished_at?: string;
  error_message?: string;
  notes?: string;
}

// ─── Adapter registry ─────────────────────────────────────────────────────────
// Add one line per new data source. The key MUST match data_sources.name.

const ADAPTER_MAP: Record<string, Adapter> = {
  accidents:      accidentsAdapter,
  traffic_counts: vehicleCountsAdapter,
  railway:        railwayAdapter,
  lrt:            lrtAdapter,
  // roadauthority: roadAuthorityAdapter,   ← next adapter goes here
  // gtfs:          gtfsAdapter,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── CKAN dataset ID extraction ───────────────────────────────────────────────

/**
 * Extracts the CKAN dataset ID from the source_url stored in data_sources.
 * Handles both forms:
 *   https://data.gov.il/dataset/accid_taz                     → "accid_taz"
 *   https://data.gov.il/he/datasets/.../vehicle_counts        → "vehicle_counts"
 */
function extractDatasetId(sourceUrl: string): string {
  const parts = sourceUrl.replace(/\/$/, "").split("/");
  const id = parts[parts.length - 1];
  if (!id) throw new Error(`Cannot extract dataset ID from URL: ${sourceUrl}`);
  return id;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function logStart(
  db: SupabaseClient,
  sourceId: number,
  trigger: UpdateLogEntry["trigger"]
): Promise<number> {
  const { data, error } = await db
    .from("update_log")
    .insert({
      source_id: sourceId,
      started_at: new Date().toISOString(),
      status: "running",
      trigger,
      rows_inserted: 0,
      rows_updated: 0,
      rows_deleted: 0,
    } satisfies Omit<UpdateLogEntry, "finished_at">)
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create update_log: ${error?.message}`);
  return data.id as number;
}

async function logFinish(
  db: SupabaseClient,
  logId: number,
  patch: Partial<UpdateLogEntry>
): Promise<void> {
  await db
    .from("update_log")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", logId);
}

async function markSourceChecked(
  db: SupabaseClient,
  sourceId: number,
  lastModified: string
): Promise<void> {
  await db
    .from("data_sources")
    .update({
      last_checked_at: new Date().toISOString(),
      last_modified: lastModified,
      last_updated_at: new Date().toISOString(),
      status: "active",
    })
    .eq("id", sourceId);
}

async function markSourceError(
  db: SupabaseClient,
  sourceId: number
): Promise<void> {
  await db
    .from("data_sources")
    .update({
      last_checked_at: new Date().toISOString(),
      status: "error",
    })
    .eq("id", sourceId);
}

// ─── Single source runner ─────────────────────────────────────────────────────

async function runSource(
  db: SupabaseClient,
  source: DataSource,
  triggerType: UpdateLogEntry["trigger"]
): Promise<void> {
  const logId = await logStart(db, source.id, triggerType);
  const isForce = triggerType === "force";

  try {
    // 1. Find the adapter
    const adapter = ADAPTER_MAP[source.name];
    if (!adapter) {
      await logFinish(db, logId, {
        status: "skipped",
        notes: `No adapter registered for source "${source.name}"`,
      });
      return;
    }

    // 2. Fetch CKAN metadata (cheap — just JSON)
    const datasetId = extractDatasetId(source.source_url);
    console.log(`[${source.name}] Checking CKAN dataset: ${datasetId}`);
    const pkg = await packageShow(datasetId);

    // 3. Change detection (skip if up to date, unless --force)
    const primaryResource = pickResourceByName(pkg, adapter.primaryResourceName);
    if (!isForce && !hasChanged(pkg, primaryResource, source.last_modified)) {
      console.log(`[${source.name}] No change detected. Skipping.`);
      await logFinish(db, logId, {
        status: "skipped",
        notes: `last_modified unchanged: ${primaryResource.last_modified}`,
      });
      await db
        .from("data_sources")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", source.id);
      return;
    }

    // 4. Run adapter — full pipeline (download + parse + DB writes)
    const sourceVersion =
      primaryResource.last_modified ?? new Date().toISOString();

    console.log(`[${source.name}] Change detected. Running adapter...`);
    const result = await adapter.run(pkg, db, sourceVersion);

    // 5. Update data_sources metadata
    await markSourceChecked(db, source.id, sourceVersion);

    // 6. Mark log success
    await logFinish(db, logId, {
      status: "success",
      rows_inserted: result.inserted,
      rows_updated: result.updated,
      rows_deleted: result.deleted ?? 0,
      notes: result.notes,
    });

    console.log(
      `[${source.name}] Done. inserted=${result.inserted} updated=${result.updated}` +
        (result.deleted ? ` deleted=${result.deleted}` : "")
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${source.name}] ERROR: ${message}`);

    await markSourceError(db, source.id);
    await logFinish(db, logId, {
      status: "failed",
      error_message: message,
    });

    // Re-throw so the HTTP response reflects failure
    throw err;
  }
}

// ─── Edge Function handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS — Supabase dashboard calls this from the browser
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Parse query params
  const url = new URL(req.url);
  const forceUpdate = url.searchParams.get("force") === "true";
  const sourceFilter = url.searchParams.get("source"); // e.g. ?source=traffic_counts

  // Determine trigger type
  const triggerType: UpdateLogEntry["trigger"] = forceUpdate
    ? "force"
    : req.headers.get("x-trigger") === "cron"
    ? "scheduled"
    : "manual";

  // Build Supabase client (service role — needed for upsert)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Fetch active sources from DB (data-driven)
  let query = db
    .from("data_sources")
    .select("*")
    .eq("status", "active");

  if (sourceFilter) {
    query = query.eq("name", sourceFilter);
  }

  const { data: sources, error: sourcesError } = await query;

  if (sourcesError) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch data_sources: ${sourcesError.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!sources || sources.length === 0) {
    return new Response(
      JSON.stringify({ message: "No active sources found", sourceFilter }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Run all matching sources (sequentially to avoid memory spikes)
  const results: Record<string, string> = {};

  for (const source of sources as DataSource[]) {
    try {
      await runSource(db, source, triggerType);
      results[source.name] = "success";
    } catch {
      results[source.name] = "failed";
      // Continue with next source even if one fails
    }
  }

  return new Response(JSON.stringify({ trigger: triggerType, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
