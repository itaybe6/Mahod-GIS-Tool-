/**
 * index.ts — Supabase Edge Function: update-agent
 *
 * Entry point. Handles:
 *   - HTTP trigger (manual / pg_net webhook)
 *   - ?force=true   → skip change detection, always update
 *   - ?source=name  → run only one source (default: all active sources)
 *
 * Currently wired: accidents (accid_taz)
 * Add new adapters by extending the ADAPTER_MAP below.
 *
 * Deno runtime — no Node APIs, no filesystem.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasChanged, packageShow, pickResourceByName } from "./ckan.ts";
import { fetchAccidents } from "./adapters/accidents.ts";
import type { AccidentRow } from "./adapters/accidents.ts";

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

type AdapterFn = (pkg: Awaited<ReturnType<typeof packageShow>>) => Promise<{
  rows: AccidentRow[]; // union type — extend as more adapters are added
  resourceVersion: string;
  shpUrl?: string;
}>;

// ─── Adapter registry ─────────────────────────────────────────────────────────
// Add one line per new data source

const ADAPTER_MAP: Record<string, AdapterFn> = {
  accidents: fetchAccidents as AdapterFn,
  // roadauthority: fetchRoadAuthority,   ← next adapter goes here
  // gtfs:          fetchGtfs,
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
 *   https://data.gov.il/dataset/accid_taz          → "accid_taz"
 *   https://data.gov.il/he/datasets/.../accid_taz  → "accid_taz"
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

// ─── Upsert — accidents ───────────────────────────────────────────────────────

/**
 * Batch upserts accident rows.
 * UPSERT key: pk_teuna_fikt (unique per accident, stable across dataset versions)
 * geometry (geom) is computed in DB via the itm_to_wgs84() function.
 *
 * Sends rows in chunks of CHUNK_SIZE to avoid request size limits.
 */
const CHUNK_SIZE = 500;

async function upsertAccidents(
  db: SupabaseClient,
  rows: AccidentRow[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    // Add computed geom column using PostGIS function
    // Supabase doesn't support computed columns in upsert directly,
    // so we pass x_itm/y_itm and rely on a DB trigger to set geom.
    // (See: create trigger below — or call a stored procedure)
    const { error, count } = await db
      .from("accidents")
      .upsert(chunk, {
        onConflict: "pk_teuna_fikt",
        count: "exact",
      });

    if (error) {
      throw new Error(`Upsert failed at chunk ${i / CHUNK_SIZE}: ${error.message}`);
    }

    // Supabase returns total affected rows in count;
    // we approximate: new rows = inserted, rest = updated
    const affected = count ?? chunk.length;
    inserted += affected;
    // Note: Supabase JS v2 doesn't distinguish insert vs update in upsert count.
    // For accurate tracking we'd need a stored procedure. This is a known limitation.
  }

  return { inserted, updated };
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
    const csvResource = pickResourceByName(pkg, "ACCIDENTS_TAZ_CSV");
    if (!isForce && !hasChanged(pkg, csvResource, source.last_modified)) {
      console.log(`[${source.name}] No change detected. Skipping.`);
      await logFinish(db, logId, {
        status: "skipped",
        notes: `last_modified unchanged: ${csvResource.last_modified}`,
      });
      await db
        .from("data_sources")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", source.id);
      return;
    }

    // 4. Run adapter — download + parse (no DB writes yet)
    console.log(`[${source.name}] Change detected. Fetching data...`);
    const result = await adapter(pkg);

    // 5. Upsert to DB
    console.log(`[${source.name}] Upserting ${result.rows.length} rows...`);
    const { inserted, updated } = await upsertAccidents(
      db,
      result.rows as AccidentRow[]
    );

    // 6. Update data_sources metadata
    await markSourceChecked(db, source.id, result.resourceVersion);

    // 7. Mark log success
    const notes = result.shpUrl
      ? `SHP available at: ${result.shpUrl}`
      : undefined;

    await logFinish(db, logId, {
      status: "success",
      rows_inserted: inserted,
      rows_updated: updated,
      notes,
    });

    console.log(`[${source.name}] Done. inserted=${inserted} updated=${updated}`);
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
  const sourceFilter = url.searchParams.get("source"); // e.g. ?source=accidents

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