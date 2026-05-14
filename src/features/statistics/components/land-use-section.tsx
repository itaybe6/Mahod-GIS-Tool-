import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2 } from 'lucide-react';
import { formatDecimal, formatNumber, getTopLandUseInsight } from '@/statistics/calculations';
import { useLandUse } from '@/statistics/queries';
import { EmptyState, SectionShell } from './section-shell';

export function LandUseSection(): JSX.Element {
  const { data = [], isLoading, error } = useLandUse();

  return (
    <SectionShell
      icon={Building2}
      title="ניתוח לפי שימוש קרקע"
      eyebrow="Land Use"
      isLoading={isLoading}
      error={error}
    >
      {data.length ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="h-[320px] rounded-md border border-border bg-bg-1 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(0, 10)} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="mainuse" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#111827', border: '1px solid #1f2937' }}
                  formatter={(value, name) => [
                    name === 'total_accidents' ? formatNumber(Number(value)) : formatDecimal(Number(value)),
                    name === 'total_accidents' ? 'תאונות' : 'עוצמה לקמ״ר',
                  ]}
                />
                <Bar dataKey="total_accidents" name="תאונות" fill="#1a6fb5" radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="intensity_per_sqkm"
                  name="עוצמה לקמ״ר"
                  fill="#2eaa6f"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="rounded-md border border-brand-teal/25 bg-brand-teal/10 p-4 text-[13px] leading-7 text-text">
              {getTopLandUseInsight(data)}
            </div>
            <div className="max-h-[250px] overflow-auto rounded-md border border-border">
              {data.map((row) => (
                <div
                  key={row.mainuse}
                  className="flex items-center justify-between gap-3 border-b border-border bg-bg-1 px-3 py-2 last:border-b-0"
                >
                  <span className="text-[12px] text-text-dim">{row.mainuse}</span>
                  <span className="font-mono text-[12px] text-text">
                    {formatDecimal(row.intensity_per_sqkm)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState>אין נתוני שימושי קרקע להצגה.</EmptyState>
      )}
    </SectionShell>
  );
}
