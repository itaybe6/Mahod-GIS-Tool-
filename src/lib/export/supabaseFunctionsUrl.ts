/** `createClient` expects the project origin only (no `/rest/v1`). */
export function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function getExportReportsFunctionUrl(): string {
  const base = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? '');
  return `${base}/functions/v1/export-reports`;
}
