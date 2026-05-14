import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import type { ReportData } from './types.ts';

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf';

function formatNumber(n: number): string {
  return n.toLocaleString('he-IL');
}

/** Right-align Hebrew-capable text using logical string order (embedded Noto Hebrew). */
function drawRtl(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  y: number,
  margin: number,
  width: number,
  color = rgb(0.12, 0.18, 0.2)
): number {
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = width - margin - textWidth;
  page.drawText(text, { x, y, size, font, color });
  return y - size - 6;
}

export async function generateReportPdf(data: ReportData): Promise<Uint8Array> {
  const fontRes = await fetch(FONT_URL);
  if (!fontRes.ok) {
    throw new Error(`טעינת גופן עברית נכשלה: ${fontRes.status}`);
  }
  const fontBytes = new Uint8Array(await fontRes.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 44;
  let y = height - margin;

  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.1, 0.43, 0.71),
  });
  const title = 'דוח ניתוח GIS תחבורתי';
  const titleSize = 18;
  const titleW = font.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: width - margin - titleW,
    y: height - 44,
    size: titleSize,
    font,
    color: rgb(1, 1, 1),
  });
  const sub = data.metadata.polygonName ?? 'איזור ניתוח מותאם';
  const subSize = 11;
  const subW = font.widthOfTextAtSize(sub, subSize);
  page.drawText(sub, {
    x: width - margin - subW,
    y: height - 66,
    size: subSize,
    font,
    color: rgb(0.95, 0.95, 0.95),
  });

  y = height - 110;
  y = drawRtl(page, font, `שטח: ${data.metadata.polygonAreaKm2.toFixed(2)} קמ״ר`, 11, y, margin, width);
  const analyzed = new Date(data.metadata.analyzedAt);
  const dateStr = Number.isNaN(analyzed.getTime())
    ? data.metadata.analyzedAt
    : analyzed.toLocaleDateString('he-IL');
  y = drawRtl(page, font, `תאריך: ${dateStr}`, 11, y, margin, width);
  y -= 10;

  y = drawRtl(page, font, 'סיכום', 14, y, margin, width, rgb(0.08, 0.35, 0.59));
  y = drawRtl(
    page,
    font,
    `תחנות: ${formatNumber(data.publicTransport.stopsCount)} · שיבוצי קו-תחנה (סכום): ${formatNumber(
      data.publicTransport.routesServingSum
    )}`,
    11,
    y,
    margin,
    width
  );
  y = drawRtl(
    page,
    font,
    `רשומות תאונות: ${formatNumber(data.accidents.total)} · אורך דרכים: ${(data.roads.totalLengthMeters / 1000).toFixed(2)} ק״מ`,
    11,
    y,
    margin,
    width
  );
  y -= 8;
  y = drawRtl(page, font, 'חומרת פציעות', 14, y, margin, width, rgb(0.08, 0.35, 0.59));
  y = drawRtl(
    page,
    font,
    `הרוגים: ${formatNumber(data.accidents.bySeverity.fatal)} · קשה: ${formatNumber(
      data.accidents.bySeverity.severe
    )} · קל: ${formatNumber(data.accidents.bySeverity.light)}`,
    11,
    y,
    margin,
    width
  );

  y -= 14;
  y = drawRtl(page, font, 'רשויות תמרור (חיתוך)', 14, y, margin, width, rgb(0.08, 0.35, 0.59));
  const rows = Object.entries(data.roads.byAuthority).sort(([, a], [, b]) => b - a).slice(0, 28);
  const denom = data.roads.totalLengthMeters > 0 ? data.roads.totalLengthMeters : 1;
  for (const [name, len] of rows) {
    const line = `${name} — ${(len / 1000).toFixed(2)} ק״מ (${((len / denom) * 100).toFixed(1)}%)`;
    if (y < margin + 40) break;
    y = drawRtl(page, font, line, 10, y, margin, width);
  }

  const foot = 'מהוד הנדסה בע״מ · GIS תחבורתי';
  const fs = 9;
  const fw = font.widthOfTextAtSize(foot, fs);
  page.drawText(foot, {
    x: width - margin - fw,
    y: margin - 10,
    size: fs,
    font,
    color: rgb(0.45, 0.48, 0.52),
  });

  return pdfDoc.save();
}
