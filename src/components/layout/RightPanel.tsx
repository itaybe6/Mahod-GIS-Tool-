import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Dropzone } from '@/components/upload/Dropzone';
import { UploadStatus } from '@/components/upload/UploadStatus';
import { AnalysisLayerSelector } from '@/components/analysis/AnalysisLayerSelector';
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton';
import { LayersCard } from '@/components/data/LayerRow';
import { ResultsCard } from '@/components/data/ResultRow';
import { ExportPanel } from '@/features/export/ExportPanel';

export interface RightPanelProps {
  /** Optional override — when provided, replaces the default cards. */
  children?: ReactNode;
}

/**
 * Container for the page-level right rail. Pages can either render the default
 * stack of cards (upload, layers, results, export) or pass their own
 * children to fully customize the panel.
 */
export function RightPanel({ children }: RightPanelProps): JSX.Element {
  return (
    <aside className="flex flex-col gap-3 overflow-y-auto border-e border-border bg-bg-2 p-3.5">
      {children ?? <DefaultRightPanel />}
    </aside>
  );
}

function DefaultRightPanel(): JSX.Element {
  const hasPolygon = useUploadStore((s) => s.polygon !== null);
  const uploadStatus = useUploadStore((s) => s.status);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>שלב 1: פוליגון תיחום</CardTitle>
          <button
            type="button"
            aria-label="עזרה"
            title="עזרה"
            className="grid place-items-center text-text-faint transition-colors hover:text-brand-teal"
          >
            <HelpCircle size={14} />
          </button>
        </CardHeader>
        {uploadStatus === 'idle' ? <Dropzone /> : <UploadStatus />}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>שלב 2: שכבות לניתוח</CardTitle>
        </CardHeader>
        <AnalysisLayerSelector disabled={!hasPolygon} />
        <div className="mt-3">
          <AnalyzeButton />
        </div>
      </Card>

      <LayersCard />
      <ResultsCard />
      <ExportPanel />
    </>
  );
}
