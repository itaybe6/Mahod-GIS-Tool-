import type { ReportData } from './types.ts';
import { buildPolygonMapSvg, type MapLayerFeatures } from './mapSvg.ts';

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function renderReportHtml(
  data: ReportData,
  polygonGeometry?: unknown,
  mapFeatures: MapLayerFeatures = {}
): Promise<string> {
  const formatNumber = (n: number) => n.toLocaleString('he-IL');
  const formatKm = (meters: number) => (meters / 1000).toFixed(2);
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const yearEntries = Object.entries(data.accidents.byYear).sort(([a], [b]) => Number(a) - Number(b));
  const maxAccidentYear = Math.max(1, ...yearEntries.map(([, c]) => c));
  const yearBars = yearEntries
    .map(([year, count]) => {
      const height = (count / maxAccidentYear) * 100;
      return `
        <div class="bar-wrap">
          <div class="bar" style="height: ${height}%"></div>
          <div class="bar-value">${formatNumber(count)}</div>
          <div class="bar-label">${escapeHtml(year)}</div>
        </div>
      `;
    })
    .join('');

  const totalRoads = data.roads.totalLengthMeters > 0 ? data.roads.totalLengthMeters : 1;
  const authorityRows = Object.entries(data.roads.byAuthority)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([name, lengthM]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="num">${formatKm(lengthM)} ק״מ</td>
        <td class="num">${((lengthM / totalRoads) * 100).toFixed(1)}%</td>
      </tr>
    `
    )
    .join('');

  const routesNote =
    data.publicTransport.routesServingSum > 0
      ? `<div class="meta-note">סה״כ שיבוצי קו-תחנה באזור (לא מספר קווים ייחודי): ${formatNumber(
          data.publicTransport.routesServingSum
        )}</div>`
      : '';

  const mapSvg = await buildPolygonMapSvg(
    polygonGeometry,
    data.metadata.polygonAreaKm2,
    mapFeatures
  );
  const mapSection = mapSvg
    ? `
<h2>תצוגה ויזואלית של אזור הניתוח</h2>
<div class="map-card">
  ${mapSvg}
</div>
`
    : '';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>דוח ניתוח GIS - מהוד הנדסה</title>
<style>
  @page {
    size: A4;
    margin: 20mm 15mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Rubik', 'Heebo', Arial, sans-serif;
    color: #1f2933;
    line-height: 1.6;
    font-size: 13px;
    direction: rtl;
    background: #eef2f6;
    padding: 24px;
  }

  .report-page {
    width: min(100%, 820px);
    margin: 0 auto;
    padding: 28px;
    background: #ffffff;
    box-shadow: 0 8px 28px rgba(31, 41, 51, 0.12);
  }

  @media print {
    body {
      background: #ffffff;
      padding: 0;
    }
    .report-page {
      width: auto;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
  }

  .header {
    background: linear-gradient(135deg, #1a6fb5 0%, #2eaa6f 100%);
    color: white;
    padding: 32px 28px;
    margin-bottom: 24px;
    border-radius: 8px;
  }
  .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .header .subtitle { font-size: 14px; opacity: 0.95; }
  .header .meta { margin-top: 16px; font-size: 12px; opacity: 0.9; }
  .meta-note { margin-top: 8px; font-size: 11px; opacity: 0.85; }

  h2 {
    font-size: 18px;
    color: #155a96;
    border-bottom: 2px solid #e5e9ef;
    padding-bottom: 8px;
    margin: 28px 0 14px;
    page-break-after: avoid;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin: 16px 0;
  }
  .kpi {
    background: #f5f7fa;
    border-right: 4px solid #1a6fb5;
    padding: 14px 16px;
    border-radius: 6px;
  }
  .kpi-value { font-size: 22px; font-weight: 700; color: #155a96; }
  .kpi-label { font-size: 11px; color: #6b7785; margin-top: 4px; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
  }
  th {
    background: linear-gradient(135deg, #1a6fb5, #2eaa6f);
    color: white;
    padding: 10px 12px;
    text-align: right;
    font-weight: 600;
  }
  td {
    padding: 8px 12px;
    border-bottom: 1px solid #eef1f5;
  }
  td.num { font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fafbfc; }

  .severity-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 12px 0;
  }
  .severity-card {
    padding: 12px;
    border-radius: 6px;
    text-align: center;
  }
  .severity-fatal { background: #FFEBEE; border-right: 4px solid #C62828; }
  .severity-severe { background: #FFF3CD; border-right: 4px solid #f0b429; }
  .severity-light { background: #DFF5E8; border-right: 4px solid #2eaa6f; }
  .severity-value { font-size: 24px; font-weight: 700; }
  .severity-label { font-size: 11px; margin-top: 4px; }

  .chart {
    display: flex;
    align-items: flex-end;
    height: 160px;
    gap: 6px;
    padding: 12px;
    background: #f9fafc;
    border-radius: 6px;
    margin: 12px 0;
  }
  .bar-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }
  .bar {
    width: 100%;
    background: linear-gradient(to top, #1a6fb5, #2eaa6f);
    border-radius: 3px 3px 0 0;
    min-height: 2px;
  }
  .bar-value { font-size: 10px; margin-top: 4px; font-weight: 600; }
  .bar-label { font-size: 10px; color: #6b7785; }

  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #e5e9ef;
    text-align: center;
    font-size: 11px;
    color: #6b7785;
  }

  .map-card {
    max-width: 600px;
    margin: 12px auto 18px;
    padding: 8px;
    background: #ffffff;
    border: 1px solid #e5e9ef;
    border-radius: 8px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .map-card svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: 320px;
  }

  .page-break { page-break-before: always; }
</style>
</head>
<body>
<main class="report-page">

<div class="header">
  <h1>דוח ניתוח GIS תחבורתי</h1>
  <div class="subtitle">${escapeHtml(data.metadata.polygonName || 'איזור ניתוח מותאם')}</div>
  <div class="meta">
    שטח ניתוח: ${data.metadata.polygonAreaKm2.toFixed(2)} קמ״ר ·
    תאריך הפקה: ${formatDate(data.metadata.analyzedAt)}
  </div>
  ${routesNote}
</div>

<h2>סיכום ראשי</h2>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-value">${formatNumber(data.publicTransport.stopsCount)}</div>
    <div class="kpi-label">תחנות תחבורה ציבורית</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">${formatNumber(data.publicTransport.routesServingSum)}</div>
    <div class="kpi-label">שיבוצי קו-תחנה (סכום)</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">${formatNumber(data.accidents.total)}</div>
    <div class="kpi-label">רשומות תאונות (אזור סטטיסטי)</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">${formatKm(data.roads.totalLengthMeters)}</div>
    <div class="kpi-label">ק״מ דרכים (חיתוך)</div>
  </div>
</div>
${mapSection}
<h2>תאונות דרכים - פילוח חומרה (פציעות)</h2>
<div class="severity-grid">
  <div class="severity-card severity-fatal">
    <div class="severity-value">${formatNumber(data.accidents.bySeverity.fatal)}</div>
    <div class="severity-label">הרוגים</div>
  </div>
  <div class="severity-card severity-severe">
    <div class="severity-value">${formatNumber(data.accidents.bySeverity.severe)}</div>
    <div class="severity-label">פצועים קשה</div>
  </div>
  <div class="severity-card severity-light">
    <div class="severity-value">${formatNumber(data.accidents.bySeverity.light)}</div>
    <div class="severity-label">פצועים קל</div>
  </div>
</div>

<h2>תאונות לפי שנה (סכימת רשומות)</h2>
<div class="chart">
  ${yearBars || '<span class="bar-label">אין נתונים</span>'}
</div>

<div class="page-break"></div>

<h2>דרכים לפי רשות תמרור</h2>
<table>
  <thead>
    <tr>
      <th>רשות תמרור</th>
      <th>אורך כולל</th>
      <th>אחוז</th>
    </tr>
  </thead>
  <tbody>
    ${authorityRows || '<tr><td colspan="3">אין נתונים</td></tr>'}
  </tbody>
</table>

<div class="footer">
  <strong>מהוד הנדסה בע״מ</strong> · מערכת GIS תחבורתית · ${formatDate(data.metadata.analyzedAt)}
</div>

</main>
</body>
</html>`;
}
