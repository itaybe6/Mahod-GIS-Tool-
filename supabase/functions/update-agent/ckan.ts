/**
 * ckan.ts
 * Generic CKAN client for data.gov.il
 * Deno-compatible — no Node APIs, no filesystem.
 */

const CKAN_BASE = "https://data.gov.il/api/3/action";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CkanResource {
  id: string;
  name: string;
  format: string; // "CSV" | "SHP" | "KMZ" | ...
  url: string;
  last_modified: string | null; // ISO string or null
  size: number | null;
  mimetype: string | null;
}

export interface CkanPackage {
  id: string;
  name: string;
  metadata_modified: string; // ISO string — changes whenever any resource changes
  resources: CkanResource[];
}

export interface CkanApiResponse<T> {
  success: boolean;
  result: T;
  error?: { message: string; __type: string };
}

// ─── package_show ─────────────────────────────────────────────────────────────

/**
 * Fetches dataset metadata from CKAN without downloading the actual data.
 * Use this to check whether an update is available (compare last_modified).
 */
export async function packageShow(datasetId: string): Promise<CkanPackage> {
  const url = `${CKAN_BASE}/package_show?id=${encodeURIComponent(datasetId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `CKAN package_show failed for "${datasetId}": HTTP ${res.status}`
    );
  }

  const json: CkanApiResponse<CkanPackage> = await res.json();

  if (!json.success) {
    throw new Error(
      `CKAN error for "${datasetId}": ${json.error?.message ?? "unknown"}`
    );
  }

  return json.result;
}

// ─── Resource picker ──────────────────────────────────────────────────────────

/**
 * Finds the first resource matching a given format (case-insensitive).
 * Throws if not found — caller decides how to handle missing formats.
 */
export function pickResource(
  pkg: CkanPackage,
  format: string
): CkanResource {
  const target = format.toUpperCase();
  const found = pkg.resources.find((r) => r.format.toUpperCase() === target);
  if (!found) {
    const available = pkg.resources.map((r) => r.format).join(", ");
    throw new Error(
      `No "${format}" resource in dataset "${pkg.name}". Available: ${available}`
    );
  }
  return found;
}

/**
 * Finds a resource by its CKAN resource name (case-insensitive).
 * data.gov.il sometimes publishes Shapefiles as ZIP resources, so the
 * resource name is more stable than the format for those files.
 */
export function pickResourceByName(
  pkg: CkanPackage,
  name: string
): CkanResource {
  const target = name.toUpperCase();
  const found = pkg.resources.find((r) => r.name.toUpperCase() === target);
  if (!found) {
    const available = pkg.resources.map((r) => r.name).join(", ");
    throw new Error(
      `No resource named "${name}" in dataset "${pkg.name}". Available: ${available}`
    );
  }
  return found;
}

// ─── Change detection ─────────────────────────────────────────────────────────

/**
 * Returns true if the resource has changed since lastKnown.
 * Uses resource.last_modified; falls back to package.metadata_modified.
 */
export function hasChanged(
  pkg: CkanPackage,
  resource: CkanResource,
  lastKnown: string | null // value stored in data_sources.last_modified
): boolean {
  if (!lastKnown) return true; // never fetched → always update

  // Prefer resource-level timestamp; fall back to package-level
  const sourceTs = resource.last_modified ?? pkg.metadata_modified;
  return new Date(sourceTs) > new Date(lastKnown);
}

// ─── Download helpers ─────────────────────────────────────────────────────────

/**
 * Downloads a resource as raw bytes (ArrayBuffer).
 * Works for CSV, ZIP (SHP), KMZ — anything.
 * No streaming to disk — everything stays in memory (Edge constraint).
 */
export async function downloadResource(resource: CkanResource): Promise<ArrayBuffer> {
  const res = await fetch(resource.url);
  if (!res.ok) {
    throw new Error(
      `Download failed for resource "${resource.name}" (${resource.url}): HTTP ${res.status}`
    );
  }
  return res.arrayBuffer();
}

/**
 * Downloads a resource and decodes it as a UTF-8 string.
 * Convenience wrapper for CSV resources.
 */
export async function downloadResourceAsText(resource: CkanResource): Promise<string> {
  const buf = await downloadResource(resource);
  return new TextDecoder("utf-8").decode(buf);
}