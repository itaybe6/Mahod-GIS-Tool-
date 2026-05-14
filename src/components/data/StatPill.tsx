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
        'relative flex animate-fadein items-center gap-3 rounded-md border bg-surface px-3.5 py-3 transition-all hover:-translate-y-px',
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
      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE_BG[tone])}>
        <Icon size={18} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="mb-0.5 text-[11.5px] text-text-faint">{label}</span>
        <span className="font-mono text-[18px] font-semibold leading-none text-text">
          {value}
          {unit && <span className="ms-1 text-[11px] text-text-faint">{unit}</span>}
        </span>
      </div>
      {trend && !analysisBadge && (
        <span
          className={cn(
            'ms-auto font-mono text-[10.5px]',
            trendDirection === 'down' ? 'text-danger' : 'text-success'
          )}
        >
          {trend}
        </span>
      )}
    </div>
  );
}
