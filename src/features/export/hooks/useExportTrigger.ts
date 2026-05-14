import { useCallback } from 'react';
import type { ExportFormat } from '../ExportPanel';

/**
 * Placeholder export entry point.
 *
 * Real implementation (after Supabase wiring) will:
 *  - PDF: render a server-side report from a Supabase view
 *  - Excel: stream a workbook from a `/rest/v1/rpc/export_excel` function
 *  - GeoJSON / SHP: bundle the current map viewport's layers
 *
 * For now, just expose a stable trigger so feature code can call
 * `triggerExport('pdf')` without leaking the export plumbing.
 */
export function useExportTrigger(): (format: ExportFormat) => void {
  return useCallback((format: ExportFormat) => {
    console.warn('[mahod-gis] export pipeline not yet wired:', format);
  }, []);
}
