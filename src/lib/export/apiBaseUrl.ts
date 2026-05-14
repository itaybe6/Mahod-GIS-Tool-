import { normalizeSupabaseUrl } from './supabaseFunctionsUrl';

/**
 * Supabase project origin (no `/rest/v1`). Used to know whether export env is configured.
 * Aligns with how `fetchExportBlob` builds the `export-reports` function URL.
 */
export function getExportApiBaseUrl(): string {
  return normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? '');
}
