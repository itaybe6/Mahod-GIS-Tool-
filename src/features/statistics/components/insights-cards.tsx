import { BrainCircuit, Sparkles } from 'lucide-react';
import type { SeverityTone } from '@/statistics/types';
import { formatDecimal } from '@/statistics/calculations';
import { useInsights } from '@/statistics/queries';
import { cn } from '@/lib/utils';
import { EmptyState, SectionShell } from './section-shell';

const toneClasses: Record<SeverityTone, string> = {
  red: 'border-danger/30 bg-danger/10 text-danger',
  orange: 'border-warning/30 bg-warning/10 text-warning',
  yellow: 'border-yellow-300/30 bg-yellow-300/10 text-yellow-300',
  green: 'border-success/30 bg-success/10 text-success',
  blue: 'border-sky-300/30 bg-sky-300/10 text-sky-300',
  purple: 'border-purple/30 bg-purple/10 text-purple',
};

export function InsightsCards(): JSX.Element {
  const { data = [], isLoading, error } = useInsights();

  return (
    <SectionShell
      icon={BrainCircuit}
      title="תובנות אוטומטיות"
      eyebrow="SQL Insights"
      isLoading={isLoading}
      error={error}
    >
      {data.length ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {data.map((insight) => (
            <div
              key={insight.id}
              className={cn('rounded-md border bg-bg-1 p-4 shadow-card', toneClasses[insight.tone])}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <Sparkles size={17} className="shrink-0" />
                <span className="font-mono text-[18px] font-bold">
                  {formatDecimal(insight.metric_value)}
                  {insight.metric_unit}
                </span>
              </div>
              <h3 className="text-[13px] font-semibold text-text">{insight.title}</h3>
              <p className="mt-2 text-[12px] leading-6 text-text-dim">{insight.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState>אין מספיק נתונים להפקת תובנות אוטומטיות.</EmptyState>
      )}
    </SectionShell>
  );
}
