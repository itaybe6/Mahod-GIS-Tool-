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
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
      <div className="flex shrink-0 items-center gap-3">
        <LayerToggle />
        <MapSearch />
        <MapTypeSelector />
      </div>

      <div className="flex-1 animate-fadein">
        <MapView />
      </div>

      <AnalysisBottomSection />
    </div>
  );
}
