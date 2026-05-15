import { AlertTriangle, Skull, TrendingUp, MapPinned } from 'lucide-react';
import { useAccidentsKpi } from '@/statistics/queries';
import { formatNumber, formatPercent } from '@/statistics/calculations';
import { cn } from '@/lib/utils';

const cards = [
  {
    key: 'total_accidents',
    label: 'סה״כ תאונות',
    icon: AlertTriangle,
    tone: 'text-danger border-danger/30 bg-danger/10',
  },
  {
    key: 'total_fatalities',
    label: 'הרוגים',
    icon: Skull,
    tone: 'text-warning border-warning/30 bg-warning/10',
  },
  {
    key: 'fatality_rate',
    label: 'שיעור קטלניות',
    icon: TrendingUp,
    tone: 'text-purple border-purple/30 bg-purple/10',
  },
  {
    key: 'most_dangerous_city',
    label: 'העיר המסוכנת ביותר',
    icon: MapPinned,
    tone: 'text-brand-teal border-brand-teal/30 bg-brand-teal/10',
  },
] as const;

export function KpiCards(): JSX.Element {
  const { data, isLoading, error } = useAccidentsKpi();

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value =
          card.key === 'fatality_rate'
            ? formatPercent(data?.fatality_rate)
            : card.key === 'most_dangerous_city'
              ? (data?.most_dangerous_city ?? '—')
              : formatNumber(data?.[card.key]);
        const helper =
          card.key === 'most_dangerous_city'
            ? `${formatNumber(data?.most_dangerous_city_accidents)} תאונות`
            : 'מחושב מ־public.accidents';

        return (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-lg border border-border bg-bg-1 p-3 shadow-card sm:p-4"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <span className={cn('grid h-9 w-9 place-items-center rounded-md border sm:h-10 sm:w-10', card.tone)}>
                <Icon size={17} className="sm:hidden" />
                <Icon size={19} className="hidden sm:block" />
              </span>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[9px] text-text-faint sm:text-[10px]">
                SQL
              </span>
            </div>
            <div className="mt-4 sm:mt-5">
              <div className="min-h-8 truncate font-mono text-[22px] font-bold leading-none text-text sm:text-[28px]">
                {isLoading ? '...' : value}
              </div>
              <div className="mt-2 text-[12px] font-medium text-text sm:text-[13px]">{card.label}</div>
              <div className="mt-1 text-[10.5px] text-text-faint sm:text-[11.5px]">
                {error ? 'טעינת KPI נכשלה' : helper}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
