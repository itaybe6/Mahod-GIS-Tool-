import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButtons, type ExportLayerSelection } from '@/components/ExportButtons/ExportButtons';
import { buildExportAnalysisPayload } from '@/lib/export/buildExportPayload';
import { useAnalysisStore } from '@/stores/analysisStore';
import { useUploadStore } from '@/stores/uploadStore';

export function ExportPanel(): JSX.Element {
  const polygon = useUploadStore((s) => s.polygon);
  const sourceName = useUploadStore((s) => s.sourceName);
  const selection = useAnalysisStore((s) => s.selection);
  const status = useAnalysisStore((s) => s.status);
  const results = useAnalysisStore((s) => s.results);
  const lastAnalyzedAt = useAnalysisStore((s) => s.lastAnalyzedAt);

  const layers: ExportLayerSelection = {
    publicTransport: selection.transit,
    accidents: selection.accidents,
    roads: selection.roads,
  };

  const hasLayer = layers.publicTransport || layers.accidents || layers.roads;
  const disabledReason =
    polygon == null
      ? 'יש להעלות פוליגון או לצייר אזור לפני הורדת תוצרים.'
      : !hasLayer
        ? 'יש לבחור לפחות שכבה אחת (מתגי שכבות בפאנל הניתוח).'
        : undefined;

  const analysisPayload = useMemo(() => {
    if (polygon == null || status !== 'ready' || results == null) return null;
    return buildExportAnalysisPayload(polygon, results, {
      polygonName: sourceName,
      analyzedAt: lastAnalyzedAt != null ? new Date(lastAnalyzedAt) : new Date(),
    });
  }, [polygon, status, results, sourceName, lastAnalyzedAt]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ייצוא</CardTitle>
      </CardHeader>
      <ExportButtons
        polygon={polygon}
        layers={layers}
        analysisPayload={analysisPayload}
        {...(disabledReason != null ? { disabledReason } : {})}
      />
    </Card>
  );
}
