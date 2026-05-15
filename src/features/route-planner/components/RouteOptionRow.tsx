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
        'group flex w-full flex-col gap-2.5 rounded-xl border bg-bg-1 px-4 py-3.5 text-start transition-colors',
        isActive
          ? 'border-brand-teal/70 bg-brand-teal/[0.08] shadow-[0_0_0_2px_rgba(76,175,80,0.28)_inset]'
          : 'border-border/80 hover:border-brand-teal/40 hover:bg-bg-2'
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold',
            'bg-brand-teal/20 text-brand-teal ring-1 ring-brand-teal/25'
          )}
          aria-hidden
        >
          {index + 1}
        </span>
        <span
          className="inline-flex h-9 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal2 px-3 font-mono text-[15px] font-bold text-white shadow-[0_3px_12px_rgba(76,175,80,0.35)]"
          title={`קו ${option.route_id}`}
        >
          <Icon size={16} className="opacity-95" />
          {routeBadge}
        </span>
        <span
          className="ms-auto inline-flex shrink-0 items-center rounded-full border border-border/80 bg-surface px-2.5 py-1 text-[12px] font-medium text-white"
          title="זמן משוער כולל"
        >
          ≈{' '}
          <span className="mx-0.5 font-mono text-[15px] font-semibold text-white">{totalMin}</span>
          דק׳
        </span>
      </div>

      <p className="text-[13px] font-medium leading-snug text-white" title={longName ?? ''}>
        {longName ?? routeTypeHebrew(option.route_type)}
      </p>
      <p className="text-[12px] text-white">
        כיוון: <span className="font-medium text-white">{formatDirection(option.direction_id)}</span>
      </p>

      <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2.5 ps-1 text-[13px] leading-relaxed text-white">
        <div className="flex items-start gap-2">
          <Footprints size={15} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
          <span>
            הליכה לתחנה <span className="font-medium text-white">{option.from_stop.stop_name}</span>
            <span className="mx-1 text-white">·</span>
            <span className="font-mono text-[13px] text-white">{formatMeters(option.walk_to_stop_m)}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Icon size={15} className="mt-0.5 shrink-0 text-brand-teal" aria-hidden />
          <span>
            נסיעה ל־<span className="font-medium text-white">{option.to_stop.stop_name}</span>
            <span className="mx-1 text-white">·</span>
            <span className="font-mono text-[13px] text-white">{formatMeters(option.transit_distance_m)}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Footprints size={15} className="mt-0.5 shrink-0 text-rose-300" aria-hidden />
          <span>
            הליכה ליעד
            <span className="mx-1 text-white">·</span>
            <span className="font-mono text-[13px] text-white">{formatMeters(option.walk_from_stop_m)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-2.5 font-mono text-[12px] text-white">
        <span>
          סה״כ הליכה:{' '}
          <span className="text-[13px] font-semibold text-white">{formatMeters(option.total_walk_m)}</span>
        </span>
        <span>
          אורך נסיעה:{' '}
          <span className="text-[13px] font-semibold text-white">{formatMeters(option.transit_distance_m)}</span>
        </span>
      </div>
    </button>
  );
}
