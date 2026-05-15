import type { ReportData } from './types.ts';

function escapeCsvCell(s: string): string {
  const needsQuote = /[",\r\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function row(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Flat UTF-8 CSV (with BOM) for spreadsheets — same logical data as the HTML summary. */
export function renderReportCsv(data: ReportData): string {
  const lines: string[] = [];
  const fmt = (n: number) => n.toLocaleString('he-IL');
  const km = (m: number) => (m / 1000).toFixed(3);

  lines.push(row(['קטגוריה', 'פרט', 'ערך']));

  lines.push(row(['כללי', 'שם האזור', data.metadata.polygonName ?? 'אזור ניתוח']));
  lines.push(row(['כללי', 'שטח הניתוח (קמ״ר)', data.metadata.polygonAreaKm2.toFixed(4)]));
  lines.push(row(['כללי', 'תאריך ניתוח (ISO)', data.metadata.analyzedAt]));

  if (data.metadata.dataVersions) {
    const dv = data.metadata.dataVersions;
    if (dv.gtfs) lines.push(row(['גרסאות מקור', 'GTFS', dv.gtfs]));
    if (dv.accidents) lines.push(row(['גרסאות מקור', 'תאונות', dv.accidents]));
    if (dv.roads) lines.push(row(['גרסאות מקור', 'דרכים', dv.roads]));
  }

  lines.push(row(['תחבורה ציבורית', 'מספר תחנות', fmt(data.publicTransport.stopsCount)]));
  lines.push(row(['תחבורה ציבורית', 'סכום שיבוצי קו-תחנה', fmt(data.publicTransport.routesServingSum)]));
  lines.push(row(['תחבורה ציבורית', 'מספר מפעילים (אם זמין)', fmt(data.publicTransport.agenciesCount)]));

  lines.push(row(['תאונות', 'סה״כ רשומות באזור', fmt(data.accidents.total)]));
  lines.push(row(['תאונות', 'הרוגים', fmt(data.accidents.bySeverity.fatal)]));
  lines.push(row(['תאונות', 'פצועים קשה', fmt(data.accidents.bySeverity.severe)]));
  lines.push(row(['תאונות', 'פצועים קל', fmt(data.accidents.bySeverity.light)]));

  const years = Object.entries(data.accidents.byYear).sort(([a], [b]) => Number(a) - Number(b));
  for (const [y, c] of years) {
    lines.push(row(['תאונות לפי שנה', y, fmt(c)]));
  }

  lines.push(row(['דרכים', 'מספר מקטעים', fmt(data.roads.segmentsCount)]));
  lines.push(row(['דרכים', 'אורך כולל במטרים', fmt(Math.round(data.roads.totalLengthMeters))]));
  lines.push(row(['דרכים', 'אורך כולל בק״מ', km(data.roads.totalLengthMeters)]));

  const totalRoads = data.roads.totalLengthMeters > 0 ? data.roads.totalLengthMeters : 1;
  const auth = Object.entries(data.roads.byAuthority).sort(([, a], [, b]) => b - a);
  for (const [name, lengthM] of auth) {
    const pct = ((lengthM / totalRoads) * 100).toFixed(2);
    lines.push(row(['דרכים לפי רשות', name, `${km(lengthM)} ק״מ (${pct}%)`]));
  }

  return `\uFEFF${lines.join('\r\n')}`;
}
