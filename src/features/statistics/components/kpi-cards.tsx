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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            className="relative overflow-hidden rounded-lg border border-border bg-bg-1 p-4 shadow-card"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-white/20 to-transparent" />
            <div className="flex items-start justify-between gap-3">
              <span className={cn('grid h-10 w-10 place-items-center rounded-md border', card.tone)}>
                <Icon size={19} />
              </span>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-text-faint">
                SQL VIEW
              </span>
            </div>
            <div className="mt-5">
              <div className="min-h-8 font-mono text-[28px] font-bold leading-none text-text">
                {isLoading ? '...' : value}
              </div>
              <div className="mt-2 text-[13px] font-medium text-text">{card.label}</div>
              <div className="mt-1 text-[11.5px] text-text-faint">
                {error ? 'טעינת KPI נכשלה' : helper}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
