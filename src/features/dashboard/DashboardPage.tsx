import { MapView } from '@/components/map/MapContainer';
import { MapSearch } from '@/components/map/MapSearch';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { LayerToggle } from '@/components/map/LayerToggle';
import { AnalysisBottomSection } from './AnalysisBottomSection';

/**
 * Top-level analytics dashboard.
 * Layer KPI strip (`AnalysisBottomSection`) under the map shows live counts
 * after an area analysis — not in the right rail.
 */
export function DashboardPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-3.5">
      <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:gap-3">
        <div className="order-1 min-w-0 flex-1 basis-full sm:basis-auto">
          <MapSearch />
        </div>
        <div className="order-3 -mx-1 flex w-full min-w-0 overflow-x-auto px-1 sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <LayerToggle />
        </div>
        <div className="order-2 ms-auto sm:order-3">
          <MapTypeSelector />
        </div>
      </div>

      <div className="flex-1 animate-fadein">
        <MapView />
      </div>

      <AnalysisBottomSection />
    </div>
  );
}
