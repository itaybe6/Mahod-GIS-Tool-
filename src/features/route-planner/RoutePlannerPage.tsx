import { Navigation } from 'lucide-react';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { hasBothEndpoints, useRoutePlannerStore } from '@/stores/routePlannerStore';
import { RoutePlannerMap } from './components/RoutePlannerMap';
import { RoutePlannerPanel } from './components/RoutePlannerPanel';

/**
 * `/route-planner` — A→B transit planning. Pairs a slim Leaflet map with a
 * dedicated right panel on desktop. On mobile the planner form is rendered
 * inline before the map so users can enter A/B details before interacting
 * with route geometry.
 */
export function RoutePlannerPage(): JSX.Element {
  const origin = useRoutePlannerStore((s) => s.origin);
  const destination = useRoutePlannerStore((s) => s.destination);
  const pickingMode = useRoutePlannerStore((s) => s.pickingMode);
  const status = useRoutePlannerStore((s) => s.status);
  const shouldShowMobileMap =
    pickingMode != null || hasBothEndpoints({ origin, destination }) || status === 'ready';

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-3.5 lg:overflow-hidden lg:pb-3.5">
      <header className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-teal/10 text-brand-teal">
            <Navigation size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-white">
              תכנון מסלול A→B
            </h1>
            <p className="line-clamp-2 text-[11.5px] text-white sm:line-clamp-1">
              מציאת קווי תח"צ ישירים בין שתי נקודות, על בסיס נתוני GTFS של ישראל.
            </p>
          </div>
        </div>
        <div className="ms-auto hidden lg:block">
          <MapTypeSelector />
        </div>
      </header>

      <div className="animate-fadein lg:hidden">
        <RoutePlannerPanel />
      </div>

      <div
        className={
          shouldShowMobileMap
            ? 'hidden'
            : 'shrink-0 rounded-md border border-border bg-surface p-3 text-[12px] leading-relaxed text-white lg:hidden'
        }
      >
        מלא נקודת מוצא ויעד כדי להציג את המפה והמסלולים. אפשר גם ללחוץ על "בחר במפה" באחד השדות.
      </div>

      <div
        className={
          shouldShowMobileMap
            ? 'flex h-[52dvh] min-h-[360px] shrink-0 animate-fadein flex-col lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink'
            : 'hidden lg:flex lg:flex-1 lg:flex-col'
        }
      >
        <div className="mb-2 flex justify-end lg:hidden">
          <MapTypeSelector />
        </div>
        <div className="min-h-0 flex-1">
          <RoutePlannerMap />
        </div>
      </div>
    </div>
  );
}
