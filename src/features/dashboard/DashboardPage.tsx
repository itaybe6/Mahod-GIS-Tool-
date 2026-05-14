import { MapView } from '@/components/map/MapContainer';
import { MapSearch } from '@/components/map/MapSearch';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { LayerToggle } from '@/components/map/LayerToggle';
import { AnalysisResultsCard } from '@/components/analysis/AnalysisResultsCard';
import { AnalysisBottomSection } from './AnalysisBottomSection';

/**
 * Top-level analytics dashboard.
 * Detailed analysis breakdown (`AnalysisResultsCard`) and the KPI strip
 * (`AnalysisBottomSection`) both sit under the map — not in the right rail.
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

      <div className="min-h-0 shrink-0">
        <AnalysisResultsCard />
      </div>

      <AnalysisBottomSection />
    </div>
  );
}
