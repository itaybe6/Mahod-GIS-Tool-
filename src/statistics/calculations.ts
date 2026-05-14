import type { DemographicsByCity, LandUseStat, SeverityTone } from './types';

export const hebrewNumber = new Intl.NumberFormat('he-IL');
export const hebrewDecimal = new Intl.NumberFormat('he-IL', {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return hebrewNumber.format(value);
}

export function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return hebrewDecimal.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${hebrewDecimal.format(value)}%`;
}

export function formatRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `פי ${hebrewDecimal.format(value)}`;
}

export function safePercent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return (part / total) * 100;
}

export function toneForPercentile(percentile: number): SeverityTone {
  if (percentile <= 10) return 'red';
  if (percentile <= 25) return 'orange';
  if (percentile <= 50) return 'yellow';
  return 'green';
}

export function makeAgeChartData(row: DemographicsByCity) {
  return [
    { name: '0-19', value: row.inj0_19, fill: '#f59e0b' },
    { name: '20-64', value: row.inj20_64, fill: '#ef4444' },
    { name: '65+', value: row.inj65_, fill: '#8b5cf6' },
  ];
}

export function makeVehicleChartData(row: DemographicsByCity) {
  return [
    { name: 'רכב פרטי', value: row.private_vehicle, fill: '#1a6fb5' },
    { name: 'אופנוע', value: row.motorcycle, fill: '#f59e0b' },
    { name: 'משאית', value: row.truck, fill: '#8b5cf6' },
    { name: 'אופניים', value: row.bicycle, fill: '#10b981' },
    { name: 'הולכי רגל', value: row.pedestrian, fill: '#ef4444' },
  ];
}

export function getTopLandUseInsight(rows: LandUseStat[]): string {
  const top = rows
    .filter((row) => row.intensity_vs_average != null && Number.isFinite(row.intensity_vs_average))
    .sort((a, b) => (b.intensity_vs_average ?? 0) - (a.intensity_vs_average ?? 0))[0];

  if (!top) {
    return 'אין מספיק נתונים לחישוב עוצמת תאונות לפי שימוש קרקע.';
  }

  return `אזורים מסוג ${top.mainuse} מציגים ${formatRatio(top.intensity_vs_average)} יותר תאונות לקמ״ר מהממוצע.`;
}
