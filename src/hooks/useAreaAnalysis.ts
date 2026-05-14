import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAnalysisStore, type AnalysisResults, type LayerResult } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';
import type { LayerKey } from '@/types/common';

interface EdgeResponse {
  results?: Partial<Record<keyof AnalysisResults, LayerResult>>;
  errors?: Partial<Record<string, string>>;
  durationMs?: number;
  error?: string;
}

/**
 * Orchestrates the call to the `analyze-area` Edge Function:
 *   1. Pulls the uploaded polygon out of `useUploadStore`.
 *   2. Pulls the layer selection out of `useAnalysisStore`.
 *   3. Invokes the Edge Function via `supabase.functions.invoke`.
 *   4. Stores results / partial errors in the store, and surfaces a toast.
 *
 * The hook is intentionally stateless; all state lives in the store so the
 * bottom KPI strip, map layer, and other UI can read independently.
 */
export function useAreaAnalysis(): {
  analyze: () => Promise<void>;
  canAnalyze: boolean;
  isRunning: boolean;
} {
  const polygon = useUploadStore((s) => s.polygon);
  const selection = useAnalysisStore((s) => s.selection);
  const beginRun = useAnalysisStore((s) => s.beginRun);
  const setResults = useAnalysisStore((s) => s.setResults);
  const setError = useAnalysisStore((s) => s.setError);
  const status = useAnalysisStore((s) => s.status);
  const showToast = useUIStore((s) => s.showToast);

  const hasLayer = Object.values(selection).some(Boolean);
  const canAnalyze = !!polygon && hasLayer && status !== 'running';

  const analyze = useCallback(async (): Promise<void> => {
    if (!polygon) {
      showToast('יש להעלות פוליגון לפני הניתוח', 3500);
      return;
    }
    if (!hasLayer) {
      showToast('בחר לפחות שכבה אחת לניתוח', 3500);
      return;
    }
    if (!isSupabaseConfigured) {
      const msg = 'Supabase לא מוגדר (חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
      setError(msg);
      showToast(msg, 5000);
      return;
    }

    beginRun();
    showToast('מנתח אזור...');
    const startedAt = performance.now();

    try {
      const { data, error } = await supabase.functions.invoke<EdgeResponse>('analyze-area', {
        body: { polygon, layers: selection },
      });

      if (error) {
        // `FunctionsHttpError` carries a `context.response` — try to surface it.
        const message = await extractErrorMessage(error);
        setError(message);
        showToast(message, 5000);
        return;
      }

      if (!data) {
        const msg = 'ה-Edge Function לא החזירה תוצאות';
        setError(msg);
        showToast(msg, 5000);
        return;
      }

      if (data.error) {
        setError(data.error);
        showToast(data.error, 5000);
        return;
      }

      const results = (data.results ?? {}) as Parameters<typeof setResults>[0];
      const durationMs = data.durationMs ?? Math.round(performance.now() - startedAt);
      setResults(results, durationMs);

      for (const k of Object.keys(results) as (keyof AnalysisResults)[]) {
        if (results[k]) {
          useMapStore.getState().setLayer(k as LayerKey, true);
        }
      }

      if (selection.accidents && !data.errors?.accidents) {
        const acc = results.accidents;
        const n = acc?.features?.features?.length ?? 0;
        if (n === 0) {
          showToast(
            'לא נמצאו נקודות תאונות באזור (אין התאמת citycode ליישובים חופפים, או שהמיגרציה query_accidents_points_per_taz לא רצה על פרויקט זה).',
            6500
          );
        }
      }

      const partial = data.errors ? Object.keys(data.errors).length : 0;
      const totalCount = Object.values(results).reduce(
        (sum, layer) => sum + (layer?.counts?.count ?? 0),
        0
      );
      showToast(
        partial
          ? `הניתוח הושלם חלקית (${totalCount} פיצ'רים, ${partial} שכבות נכשלו)`
          : `הניתוח הושלם — ${totalCount} פיצ'רים`,
        partial ? 5000 : 2800
      );
    } catch (err) {
      const message = (err as Error).message ?? 'שגיאה לא צפויה';
      setError(message);
      showToast(message, 5000);
    }
  }, [polygon, selection, hasLayer, beginRun, setResults, setError, showToast]);

  return {
    analyze,
    canAnalyze,
    isRunning: status === 'running',
  };
}

/**
 * The supabase-js `FunctionsError` family stuffs the actual server message
 * into `context.response.json()` rather than `error.message` — this helper
 * peels that out so the user sees the underlying SQL/RPC error rather than
 * the generic "Edge Function returned a non-2xx status code".
 */
async function extractErrorMessage(error: unknown): Promise<string> {
  const fallback = (error as Error)?.message ?? 'שגיאה ב-analyze-area';
  const ctx = (error as { context?: { response?: Response } }).context;
  if (!ctx?.response) return fallback;
  try {
    const body = await ctx.response.clone().json();
    if (body && typeof body === 'object' && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    /* ignore non-JSON bodies */
  }
  return fallback;
}
