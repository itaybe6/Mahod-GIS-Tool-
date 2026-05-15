import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Dropzone } from '@/components/upload/Dropzone';
import { SavedFilesPicker } from '@/components/upload/SavedFilesPicker';
import { UploadStatus } from '@/components/upload/UploadStatus';
import { InputModeToggle } from '@/components/upload/InputModeToggle';
import { DrawHelper } from '@/components/upload/DrawHelper';
import { AnalysisLayerSelector } from '@/components/analysis/AnalysisLayerSelector';
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton';
import { LayersCard } from '@/components/data/LayerRow';
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
  const inputMode = useUploadStore((s) => s.inputMode);

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
        <InputModeToggle />
        {renderStep1Body(inputMode, uploadStatus)}
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
      <ExportPanel />
    </>
  );
}

/**
 * The body of the "שלב 1" card depends on both the chosen input mode and the
 * current upload pipeline status — drawn polygons and uploaded ones share the
 * same `status` machine but expose different inline controls.
 */
function renderStep1Body(
  inputMode: ReturnType<typeof useUploadStore.getState>['inputMode'],
  status: ReturnType<typeof useUploadStore.getState>['status']
): JSX.Element {
  if (inputMode === 'draw') {
    return (
      <div className="flex flex-col gap-2">
        <DrawHelper />
        {status === 'ready' && <UploadStatus />}
      </div>
    );
  }

  if (status === 'idle') {
    return (
      <div className="flex flex-col gap-2">
        <Dropzone />
        <SavedFilesPicker />
      </div>
    );
  }
  return <UploadStatus />;
}
