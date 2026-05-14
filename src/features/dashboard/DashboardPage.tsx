import { AlertTriangle, Bus, Construction, Building2 } from 'lucide-react';
import { MapView } from '@/components/map/MapContainer';
import { MapSearch } from '@/components/map/MapSearch';
import { MapTypeSelector } from '@/components/map/MapTypeSelector';
import { LayerToggle } from '@/components/map/LayerToggle';
import { StatPill } from '@/components/data/StatPill';

/**
 * Top-level analytics dashboard — the screen captured in the reference UI.
 * Shows the live map with all 4 domains, plus the 4-KPI stats strip.
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

      <div className="grid shrink-0 grid-cols-4 gap-2.5 max-[1024px]:grid-cols-2">
        <StatPill
          icon={AlertTriangle}
          tone="red"
          label="תאונות דרכים"
          value="2,847"
          trend="↑ 4.2%"
          trendDirection="down"
        />
        <StatPill
          icon={Bus}
          tone="emerald"
          label="קווי תח״צ"
          value="342"
          trend="↑ 1.1%"
        />
        <StatPill
          icon={Construction}
          tone="amber"
          label="רשת כבישים"
          value="1,205"
          unit="ק״מ"
          trend="↑ 0.3%"
        />
        <StatPill
          icon={Building2}
          tone="purple"
          label="תשתיות"
          value="89"
          trend="↑ 2.5%"
        />
      </div>
    </div>
  );
}
