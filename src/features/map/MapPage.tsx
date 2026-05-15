import { MapView } from '@/components/map/MapContainer';
import { MapSearch } from '@/components/map/MapSearch';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { LayerToggle } from '@/components/map/LayerToggle';

/**
 * Full-bleed map page. Hides the stats bar so the map gets all available
 * vertical space — useful when working on geometric edits or hotspot analysis.
 */
export function MapPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-3.5">
      <div className="flex w-full min-w-0 shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <MapSearch />
        </div>
        <LayerToggle />
        <MapTypeSelector />
      </div>
      <div className="flex-1 animate-fadein">
        <MapView />
      </div>
    </div>
  );
}
