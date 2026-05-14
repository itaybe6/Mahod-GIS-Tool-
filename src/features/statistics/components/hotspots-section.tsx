import { Flame } from 'lucide-react';
import { formatDecimal, formatNumber } from '@/statistics/calculations';
import { useStatisticalHotspots } from '@/statistics/queries';
import { EmptyState, SectionShell } from './section-shell';

export function HotspotsSection(): JSX.Element {
  const hotspots = useStatisticalHotspots();

  return (
    <div>
      <SectionShell
        icon={Flame}
        title="נקודות חמות סטטיסטיות"
        eyebrow="Z-Score Hotspots"
        isLoading={hotspots.isLoading}
        error={hotspots.error}
      >
        {hotspots.data?.length ? (
          <div className="max-h-[420px] overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] border-collapse text-right text-[12px]">
              <thead className="sticky top-0 bg-bg-2 text-[10.5px] uppercase tracking-[1px] text-text-faint">
                <tr>
                  <th className="px-3 py-2">עיר</th>
                  <th className="px-3 py-2">אזור</th>
                  <th className="px-3 py-2">תאונות</th>
                  <th className="px-3 py-2">אוכלוסייה</th>
                  <th className="px-3 py-2">שיעור ל־1,000</th>
                  <th className="px-3 py-2">Z</th>
                  <th className="px-3 py-2">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {hotspots.data.map((row) => (
                  <tr key={row.area_id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-3 py-3 font-medium text-text">{row.city}</td>
                    <td className="px-3 py-3 font-mono text-text-faint">{row.area_id}</td>
                    <td className="px-3 py-3 font-mono text-text">{formatNumber(row.accidents)}</td>
                    <td className="px-3 py-3 font-mono text-text-dim">{formatNumber(row.population)}</td>
                    <td className="px-3 py-3 font-mono text-text-dim">
                      {formatDecimal(row.rate_per_1000_residents)}
                    </td>
                    <td className="px-3 py-3 font-mono text-warning">{formatDecimal(row.z_score)}</td>
                    <td className="px-3 py-3">
                      {row.is_hotspot ? (
                        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 font-mono text-[10px] font-bold text-danger">
                          HOTSPOT
                        </span>
                      ) : (
                        <span className="text-text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>לא נמצאו חריגות סטטיסטיות לפי z-score.</EmptyState>
        )}
      </SectionShell>
    </div>
  );
}
