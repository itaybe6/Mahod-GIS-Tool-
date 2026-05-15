import {
  ArrowDownUp,
  CheckCircle2,
  Compass,
  Info,
  Loader2,
  Navigation,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { hasBothEndpoints, useRoutePlannerStore } from '@/stores/routePlannerStore';
import { useRoutePlanner } from '../useRoutePlanner';
import { EndpointField } from './EndpointField';
import { RouteOptionRow } from './RouteOptionRow';
import { WalkRangeSlider } from './WalkRangeSlider';

/**
 * Right-panel content for the route-planner page. Three sections:
 *   1. From / To inputs with swap.
 *   2. Walk-radius slider + "find" button.
 *   3. Results (loading / error / empty / list).
 */
export function RoutePlannerPanel(): JSX.Element {
  const origin = useRoutePlannerStore((s) => s.origin);
  const destination = useRoutePlannerStore((s) => s.destination);
  const swapEndpoints = useRoutePlannerStore((s) => s.swapEndpoints);
  const clear = useRoutePlannerStore((s) => s.clear);
  const status = useRoutePlannerStore((s) => s.status);
  const results = useRoutePlannerStore((s) => s.results);
  const error = useRoutePlannerStore((s) => s.error);
  const durationMs = useRoutePlannerStore((s) => s.durationMs);
  const { plan, canPlan, isRunning } = useRoutePlanner();

  const ready = hasBothEndpoints({ origin, destination });
  const options = results?.options ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-white">
            <Navigation size={12} className="text-brand-teal" />
            תכנון מסלול A→B
          </CardTitle>
          <button
            type="button"
            onClick={clear}
            disabled={!origin && !destination && !results}
            title="איפוס"
            aria-label="איפוס"
            className="grid place-items-center text-white transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={13} />
          </button>
        </CardHeader>

        <div className="flex flex-col gap-2.5">
          <EndpointField kind="origin" />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={swapEndpoints}
              disabled={!origin && !destination}
              title="החלף מוצא ויעד"
              aria-label="החלף מוצא ויעד"
              className="grid h-7 w-7 place-items-center rounded-full border border-border bg-bg-1 text-white transition-colors hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowDownUp size={13} />
            </button>
          </div>
          <EndpointField kind="destination" />

          <div className="mt-1 border-t border-border/60 pt-2.5">
            <WalkRangeSlider />
          </div>

          <Button
            type="button"
            onClick={() => void plan()}
            disabled={!canPlan || !isSupabaseConfigured}
            className="mt-1 w-full gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                מחפש מסלולים…
              </>
            ) : (
              <>
                <Compass size={14} />
                מצא מסלול
              </>
            )}
          </Button>

          {!isSupabaseConfigured && (
            <p className="text-[10.5px] leading-snug text-amber-400/90">
              Supabase לא מוגדר — אי אפשר להריץ את ה-RPC. הגדר{' '}
              <code className="font-mono">VITE_SUPABASE_URL</code> ו-
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
            </p>
          )}
          {!ready && isSupabaseConfigured && (
            <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-white">
              <Info size={11} className="mt-px shrink-0" />
              בחר נקודת מוצא ויעד. ניתן להקליד כתובת או ללחוץ על המפה.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">
            {status === 'running' && (
              <Loader2 size={12} className="animate-spin text-white" />
            )}
            {status === 'ready' && options.length > 0 && (
              <CheckCircle2 size={12} className="text-success" />
            )}
            {status === 'error' && <TriangleAlert size={12} className="text-danger" />}
            {status === 'idle' && <Info size={12} className="text-white" />}
            תוצאות
          </CardTitle>
          {status === 'ready' && durationMs != null && (
            <span className="font-mono text-[10px] text-white">{durationMs}ms</span>
          )}
        </CardHeader>

        {status === 'idle' && (
          <p className="text-[11.5px] leading-snug text-white">
            התוצאות יוצגו כאן אחרי הריצה — האופציות ממוינות לפי מרחק הליכה כולל מינימלי.
          </p>
        )}
        {status === 'running' && (
          <p className="text-[11.5px] text-white">
            מריץ <code>plan_transit_route</code>…
          </p>
        )}
        {status === 'error' && error && (
          <div className="rounded border border-danger/30 bg-danger/10 px-2.5 py-2 text-[11.5px] leading-snug text-danger">
            {error}
          </div>
        )}
        {status === 'ready' && results?.warning && (
          <div className="mb-2 rounded border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11.5px] leading-snug text-warning">
            {results.warning}
          </div>
        )}
        {status === 'ready' && options.length === 0 && (
          <p className="text-[11.5px] leading-snug text-white">
            לא נמצא מסלול תח"צ ישיר. נסה להגדיל את מרחק ההליכה או לבחור נקודות סמוכות יותר לתחנות.
          </p>
        )}
        {status === 'ready' && options.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {options.map((opt, i) => (
              <RouteOptionRow key={`${opt.route_id}-${opt.direction_id}`} option={opt} index={i} />
            ))}
            <p
              className={cn(
                'mt-0.5 flex items-start gap-2 rounded-lg border border-border/60 bg-bg-1 px-3 py-2.5',
                'text-[12px] leading-relaxed text-white'
              )}
            >
              <Info size={14} className="mt-0.5 shrink-0 text-white" aria-hidden />
              <span>
                חישוב זמן משוער: הליכה ~1.4 מ׳/ש׳, אוטובוס ~22 קמ״ש, רכבת/רק״ל ~50 קמ״ש. ללוחות זמנים אמיתיים
                נדרש <code className="rounded bg-bg-2 px-1 font-mono text-[11px] text-white">stop_times</code> במסד. הסבר על בדיקות
                ומגבלות נתונים נמצא בקובץ README של תכנון המסלול במאגר.
              </span>
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
