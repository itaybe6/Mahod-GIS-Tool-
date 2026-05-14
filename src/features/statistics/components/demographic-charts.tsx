import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Users } from 'lucide-react';
import {
  formatNumber,
  makeAgeChartData,
  makeVehicleChartData,
  safePercent,
} from '@/statistics/calculations';
import { useDemographics } from '@/statistics/queries';
import { EmptyState, SectionShell } from './section-shell';

export function DemographicCharts(): JSX.Element {
  const { data = [], isLoading, error } = useDemographics();
  const [city, setCity] = useState('כל הארץ');

  const selected = useMemo(
    () => data.find((row) => row.city === city) ?? data.find((row) => row.city === 'כל הארץ') ?? data[0],
    [city, data]
  );

  const ageData = selected ? makeAgeChartData(selected) : [];
  const vehicleData = selected ? makeVehicleChartData(selected).filter((item) => item.value > 0) : [];
  const totalVehicles = vehicleData.reduce((sum, item) => sum + item.value, 0);

  return (
    <SectionShell
      icon={Users}
      title="פילוח דמוגרפי וכלי רכב"
      eyebrow="Demographics"
      isLoading={isLoading}
      error={error}
    >
      {selected ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-text-dim">
              סה״כ נפגעים: <span className="font-mono text-text">{formatNumber(selected.injtotal)}</span>
            </div>
            <select
              value={selected.city}
              onChange={(event) => setCity(event.target.value)}
              className="rounded-md border border-border bg-bg-1 px-3 py-2 text-[12px] text-text outline-none transition-colors focus:border-brand-teal"
            >
              {data.map((row) => (
                <option key={row.city} value={row.city}>
                  {row.city}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-border bg-bg-1 p-3">
              <h3 className="mb-3 text-[13px] font-semibold text-text">קבוצות גיל</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: '#111827', border: '1px solid #1f2937' }}
                      formatter={(value) => formatNumber(Number(value))}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {ageData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-md border border-border bg-bg-1 p-3">
              <h3 className="mb-3 text-[13px] font-semibold text-text">תמהיל מעורבים</h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehicleData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                    >
                      {vehicleData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111827', border: '1px solid #1f2937' }}
                      formatter={(value, name) => [
                        `${formatNumber(Number(value))} (${safePercent(Number(value), totalVehicles).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState>אין נתוני דמוגרפיה להצגה.</EmptyState>
      )}
    </SectionShell>
  );
}
