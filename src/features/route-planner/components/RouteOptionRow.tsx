import { Bus, Footprints, Train, TramFront } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  optionId,
  useRoutePlannerStore,
  type RoutePlanOption,
} from '@/stores/routePlannerStore';
import {
  formatDirection,
  formatMeters,
  routeTypeHebrew,
  transitMinutes,
  walkingMinutes,
} from '../formatters';

interface RouteOptionRowProps {
  option: RoutePlanOption;
  index: number;
}

function iconForRouteType(routeType: number | null): typeof Bus {
  if (routeType === 0 || routeType === 1) return TramFront;
  if (routeType === 2) return Train;
  return Bus;
}

/**
 * One direct-transit suggestion. Clicking the row highlights its shape on
 * the map and (if applicable) zooms the camera to the segment's bounds.
 */
export function RouteOptionRow({ option, index }: RouteOptionRowProps): JSX.Element {
  const selectedOptionId = useRoutePlannerStore((s) => s.selectedOptionId);
  const selectOption = useRoutePlannerStore((s) => s.selectOption);

  const id = optionId(option);
  const isActive = id === selectedOptionId;

  const Icon = iconForRouteType(option.route_type);
  const totalMin =
    walkingMinutes(option.walk_to_stop_m) +
    transitMinutes(option.transit_distance_m, option.route_type) +
    walkingMinutes(option.walk_from_stop_m);
  const routeBadge = option.route_short_name?.trim() || `קו ${option.route_id}`;
  const longName = option.route_long_name?.trim();

  return (
    <button
      type="button"
      onClick={() => selectOption(id)}
      aria-pressed={isActive}
      className={cn(
        'group flex w-full flex-col gap-1.5 rounded-lg border bg-bg-1 px-2.5 py-2 text-start transition-colors',
        isActive
          ? 'border-brand-teal/60 bg-brand-teal/5 shadow-[0_0_0_1px_rgba(76,175,80,0.25)_inset]'
          : 'border-border/70 hover:border-brand-teal/30 hover:bg-bg-2'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-5 w-5 place-items-center rounded text-[10px] font-bold',
            'bg-brand-teal/15 text-brand-teal'
          )}
          aria-hidden
        >
          {index + 1}
        </span>
        <span
          className="inline-flex h-6 items-center gap-1 rounded-md bg-gradient-to-br from-brand-teal to-brand-teal2 px-2 font-mono text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(76,175,80,0.3)]"
          title={`קו ${option.route_id}`}
        >
          <Icon size={12} />
          {routeBadge}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-text" title={longName ?? ''}>
          {longName ?? routeTypeHebrew(option.route_type)}
        </span>
        <span className="rounded-full border border-border/70 bg-surface px-1.5 py-0.5 text-[10px] text-text-faint">
          {formatDirection(option.direction_id)}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 ps-7 text-[11px] text-text-dim">
        <div className="flex items-center gap-1.5">
          <Footprints size={10} className="shrink-0 text-emerald-300/80" />
          <span>
            הליכה לתחנה <span className="text-text">{option.from_stop.stop_name}</span> ·{' '}
            <span className="font-mono">{formatMeters(option.walk_to_stop_m)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon size={10} className="shrink-0 text-brand-teal" />
          <span>
            נסיעה ל-<span className="text-text">{option.to_stop.stop_name}</span> ·{' '}
            <span className="font-mono">{formatMeters(option.transit_distance_m)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Footprints size={10} className="shrink-0 text-rose-300/80" />
          <span>
            הליכה ליעד · <span className="font-mono">{formatMeters(option.walk_from_stop_m)}</span>
          </span>
        </div>
      </div>

      <div className="ms-7 flex items-center gap-3 border-t border-border/40 pt-1 font-mono text-[10.5px] text-text-faint">
        <span title="זמן משוער כולל הליכה ונסיעה">
          ≈ <span className="text-text">{totalMin}</span> דק׳
        </span>
        <span>
          הליכה: <span className="text-text">{formatMeters(option.total_walk_m)}</span>
        </span>
        <span>
          נסיעה: <span className="text-text">{formatMeters(option.transit_distance_m)}</span>
        </span>
      </div>
    </button>
  );
}
