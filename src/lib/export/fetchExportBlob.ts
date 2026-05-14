import type { ExportFormat, ExportAnalysisPayload } from './exportPayloadTypes';
import { getExportReportsFunctionUrl } from './supabaseFunctionsUrl';

export interface FetchExportParams {
  format: ExportFormat;
  polygon: unknown;
  layers: {
    publicTransport: boolean;
    accidents: boolean;
    roads: boolean;
  };
  analysis?: ExportAnalysisPayload;
}

export async function fetchExportBlob(params: FetchExportParams): Promise<Blob> {
  const url = getExportReportsFunctionUrl();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) {
    throw new Error('חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: params.format,
      polygon: params.polygon,
      layers: params.layers,
      ...(params.analysis != null ? { analysis: params.analysis } : {}),
    }),
  });

  if (!res.ok) {
    let msg = `ייצוא נכשל (${res.status})`;
    try {
      const j = (await res.json()) as { error?: unknown };
      if (j.error != null) {
        msg = typeof j.error === 'string' ? j.error : JSON.stringify(j.error);
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return res.blob();
}
