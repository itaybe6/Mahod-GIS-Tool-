import { Footprints } from 'lucide-react';
import { useRoutePlannerStore } from '@/stores/routePlannerStore';
import { formatMeters } from '../formatters';

const MIN = 200;
const MAX = 2000;
const STEP = 100;

/**
 * Compact slider for `max_walk_meters`. Wide enough to be tappable
 * but lives inside the planner card so it doesn't dominate the layout.
 */
export function WalkRangeSlider(): JSX.Element {
  const maxWalkMeters = useRoutePlannerStore((s) => s.maxWalkMeters);
  const setMaxWalkMeters = useRoutePlannerStore((s) => s.setMaxWalkMeters);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[11px] text-white">
        <Footprints size={12} className="text-white" />
        <span>מרחק הליכה מקסימלי לכל קצה</span>
        <span className="ms-auto rounded-full border border-border bg-bg-1 px-2 py-0.5 font-mono text-[10.5px] text-white">
          {formatMeters(maxWalkMeters)}
        </span>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={maxWalkMeters}
        onChange={(e) => setMaxWalkMeters(Number(e.target.value))}
        aria-label="מרחק הליכה מקסימלי"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-brand-teal"
      />
      <div className="flex justify-between font-mono text-[9.5px] text-white">
        <span>{formatMeters(MIN)}</span>
        <span>{formatMeters(MAX)}</span>
      </div>
    </div>
  );
}
