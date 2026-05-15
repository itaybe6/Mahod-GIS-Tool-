import { useCallback, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { Button } from '@/components/ui/button';
import type { ExportAnalysisPayload, ExportFormat } from '@/lib/export/exportPayloadTypes';
import { fetchExportBlob } from '@/lib/export/fetchExportBlob';
import { getExportApiBaseUrl } from '@/lib/export/apiBaseUrl';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';

export interface ExportLayerSelection {
  publicTransport: boolean;
  accidents: boolean;
  roads: boolean;
}

export interface ExportButtonsProps {
  polygon: FeatureCollection | null;
  layers: ExportLayerSelection;
  /** Built in `ExportPanel` when analysis status is `ready`; required for Excel (CSV) and HTML. */
  analysisPayload: ExportAnalysisPayload | null;
  disabledReason?: string;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}

function stemFromPolygonName(name: string | null | undefined): string {
  const raw = name?.trim();
  if (raw == null || raw === '') return 'אזור';
  const cleaned = raw.replace(/[<>:"/\\|?*]+/g, '_').trim();
  return cleaned === '' ? 'אזור' : cleaned.slice(0, 120);
}

export function ExportButtons({
  polygon,
  layers,
  analysisPayload,
  disabledReason,
}: ExportButtonsProps): JSX.Element {
  const sourceName = useUploadStore((s) => s.sourceName);
  const showToast = useUIStore((s) => s.showToast);
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);

  const apiBaseUrl = getExportApiBaseUrl();
  const envDisabled = !isSupabaseConfigured || apiBaseUrl === '';
  const baseReason =
    disabledReason ??
    (envDisabled ? 'חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — לא ניתן לייצא.' : undefined);
  const baseDisabled = baseReason != null || polygon == null;

  const formatNeedsAnalysis = (format: ExportFormat): boolean =>
    format === 'csv' || format === 'html';

  const isFormatDisabled = (format: ExportFormat): boolean => {
    if (baseDisabled) return true;
    if (formatNeedsAnalysis(format) && analysisPayload == null) return true;
    return false;
  };

  const formatDisabledTitle = (format: ExportFormat): string | undefined => {
    if (baseReason != null) return baseReason;
    if (formatNeedsAnalysis(format) && analysisPayload == null) {
      return 'יש להריץ ניתוח אזור מוצלח לפני ייצוא ל-Excel או HTML.';
    }
    return undefined;
  };

  const onExport = useCallback(
    async (format: ExportFormat) => {
      if (polygon == null || !isSupabaseConfigured || apiBaseUrl === '') return;
      if (formatNeedsAnalysis(format) && analysisPayload == null) {
        showToast('יש להריץ ניתוח אזור לפני ייצוא ל-Excel או HTML', 4000);
        return;
      }
      setBusyFormat(format);
      try {
        const blob = await fetchExportBlob({
          format,
          polygon,
          layers,
          ...(analysisPayload != null ? { analysis: analysisPayload } : {}),
        });
        const stem = stemFromPolygonName(sourceName);
        const ext = format === 'geojson' ? 'geojson' : format;
        downloadBlob(blob, `${stem}.${ext}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'ייצוא נכשל';
        showToast(msg, 5000);
      } finally {
        setBusyFormat(null);
      }
    },
    [analysisPayload, apiBaseUrl, layers, polygon, showToast, sourceName]
  );

  const items: Array<{ format: ExportFormat; idleLabel: string }> = [
    { format: 'geojson', idleLabel: 'GeoJSON' },
    { format: 'csv', idleLabel: 'Excel' },
    { format: 'html', idleLabel: 'HTML' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className={cn('flex gap-2')}>
        {items.map(({ format, idleLabel }) => {
          const disabled = isFormatDisabled(format) || busyFormat != null;
          const busy = busyFormat === format;
          return (
            <Button
              key={format}
              type="button"
              variant="default"
              size="sm"
              className="flex-1 font-bold"
              disabled={disabled}
              title={formatDisabledTitle(format)}
              onClick={() => {
                void onExport(format);
              }}
            >
              {busy ? 'מייצא…' : idleLabel}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
