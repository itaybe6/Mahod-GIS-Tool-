import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatPillTone = 'red' | 'emerald' | 'amber' | 'purple';

export interface StatPillProps {
  icon: LucideIcon;
  tone: StatPillTone;
  label: string;
  value: string;
  /** e.g. `↑ 4.2%`. */
  trend?: string;
  /** Direction of the trend — controls the trend color (down = red, up = green). */
  trendDirection?: 'up' | 'down';
  /** Optional inline unit (e.g. "ק״מ") rendered after the value. */
  unit?: string;
  /** Highlights the pill as the active/expanded one. */
  active?: boolean;
  /** Badge shown when analysis results replaced the static number. */
  analysisBadge?: string;
}

const TONE_BG: Record<StatPillTone, string> = {
  red: 'bg-danger/10 text-danger',
  emerald: 'bg-success/10 text-success',
  amber: 'bg-warning/10 text-warning',
  purple: 'bg-purple/10 text-purple',
};

/**
 * Glanceable KPI tile used in the stats bar under the map.
 */
const TONE_BORDER: Record<StatPillTone, string> = {
  red: 'border-danger/60',
  emerald: 'border-success/60',
  amber: 'border-warning/60',
  purple: 'border-purple/60',
};

const TONE_COLOR: Record<StatPillTone, string> = {
  red: 'text-danger',
  emerald: 'text-success',
  amber: 'text-warning',
  purple: 'text-purple',
};

export function StatPill({
  icon: Icon,
  tone,
  label,
  value,
  trend,
  trendDirection = 'up',
  unit,
  active = false,
  analysisBadge,
}: StatPillProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative flex animate-fadein items-center gap-2.5 rounded-md border bg-surface px-2.5 py-2.5 transition-all hover:-translate-y-px sm:gap-3 sm:px-3.5 sm:py-3',
        active
          ? cn('border-2', TONE_BORDER[tone], 'shadow-[0_0_16px_rgba(0,0,0,0.4)]')
          : 'border-border hover:border-brand-teal/30'
      )}
    >
      {analysisBadge && (
        <span
          className={cn(
            'absolute end-2 top-2 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold',
            TONE_COLOR[tone]
          )}
          style={{ background: `${TONE_BG[tone].includes('danger') ? '#ef444422' : TONE_BG[tone].includes('success') ? '#10b98122' : TONE_BG[tone].includes('warning') ? '#f59e0b22' : '#8b5cf622'}` }}
        >
          {analysisBadge}
        </span>
      )}
      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9', TONE_BG[tone])}>
        <Icon size={16} className="sm:hidden" />
        <Icon size={18} className="hidden sm:block" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="mb-0.5 truncate text-[10.5px] text-text-faint sm:text-[11.5px]">{label}</span>
        <span className="font-mono text-[15px] font-semibold leading-none text-text sm:text-[18px]">
          {value}
          {unit && <span className="ms-1 text-[10.5px] text-text-faint sm:text-[11px]">{unit}</span>}
        </span>
      </div>
      {trend && !analysisBadge && (
        <span
          className={cn(
            'ms-auto hidden font-mono text-[10.5px] sm:inline',
            trendDirection === 'down' ? 'text-danger' : 'text-success'
          )}
        >
          {trend}
        </span>
      )}
    </div>
  );
}
