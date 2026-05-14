import { useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useUIStore } from '@/stores/uiStore';
import {
  hasBothEndpoints,
  useRoutePlannerStore,
  type RoutePlanResult,
} from '@/stores/routePlannerStore';

/**
 * Calls the `plan_transit_route` PostgREST RPC and feeds the result into the
 * route-planner Zustand store. The store is the single source of truth so the
 * map layer and the side panel stay in sync regardless of which view triggered
 * the run.
 */
export function useRoutePlanner(): {
  plan: () => Promise<void>;
  canPlan: boolean;
  isRunning: boolean;
} {
  const origin = useRoutePlannerStore((s) => s.origin);
  const destination = useRoutePlannerStore((s) => s.destination);
  const maxWalkMeters = useRoutePlannerStore((s) => s.maxWalkMeters);
  const status = useRoutePlannerStore((s) => s.status);
  const beginRun = useRoutePlannerStore((s) => s.beginRun);
  const setResults = useRoutePlannerStore((s) => s.setResults);
  const setError = useRoutePlannerStore((s) => s.setError);
  const showToast = useUIStore((s) => s.showToast);

  const ready = hasBothEndpoints({ origin, destination });
  const canPlan = ready && status !== 'running';
  const isRunning = status === 'running';

  const plan = useCallback(async (): Promise<void> => {
    if (!origin || !destination) {
      showToast('בחר נקודת מוצא ויעד', 3500);
      return;
    }
    if (!isSupabaseConfigured) {
      const msg = 'Supabase לא מוגדר (חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).';
      setError(msg);
      showToast(msg, 5000);
      return;
    }

    beginRun();
    showToast('מחפש מסלולי תח"צ ישירים…');
    const startedAt = performance.now();

    try {
      const { data, error } = await supabase.rpc('plan_transit_route', {
        origin_lng: origin.lng,
        origin_lat: origin.lat,
        dest_lng: destination.lng,
        dest_lat: destination.lat,
        max_walk_meters: maxWalkMeters,
      });

      if (error) {
        const msg = error.message ?? 'שגיאת RPC';
        setError(msg);
        showToast(msg, 5000);
        return;
      }

      const result = (data ?? null) as RoutePlanResult | null;
      if (!result) {
        const msg = 'ה-RPC לא החזיר תוצאות';
        setError(msg);
        showToast(msg, 5000);
        return;
      }

      const durationMs = Math.round(performance.now() - startedAt);
      setResults(result, durationMs);

      if (result.warning) {
        showToast(result.warning, 5500);
        return;
      }
      const n = result.options.length;
      if (n === 0) {
        showToast(
          'לא נמצאה תח"צ ישירה. נסה להגדיל את מרחק ההליכה המקסימלי, או לבחור נקודות סמוכות לתחנות.',
          6000
        );
      } else {
        showToast(`נמצאו ${n} מסלולים ישירים`, 2800);
      }
    } catch (err) {
      const message = (err as Error).message ?? 'שגיאה לא צפויה';
      setError(message);
      showToast(message, 5000);
    }
  }, [origin, destination, maxWalkMeters, beginRun, setResults, setError, showToast]);

  return { plan, canPlan, isRunning };
}
