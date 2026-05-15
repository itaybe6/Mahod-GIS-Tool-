import { Navigation } from 'lucide-react';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { RoutePlannerMap } from './components/RoutePlannerMap';

/**
 * `/route-planner` — A→B transit planning. Pairs a slim Leaflet map with a
 * dedicated right panel (origin / destination / walk slider / results),
 * replacing the default upload + area-analysis panel that the rest of the
 * app uses. The right panel is injected via `AppShell`'s `rightPanel` prop
 * from `app/router.tsx`, keeping this page focused purely on the map.
 */
export function RoutePlannerPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-3.5">
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
        <div className="ms-auto">
          <MapTypeSelector />
        </div>
      </header>
      <div className="flex-1 animate-fadein">
        <RoutePlannerMap />
      </div>
    </div>
  );
}
