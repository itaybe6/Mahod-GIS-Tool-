import type { ReactNode } from 'react';
import { HelpCircle, Search } from 'lucide-react';
import { useFilterStore } from '@/stores/filterStore';
import { useUploadStore } from '@/stores/uploadStore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Dropzone } from '@/components/upload/Dropzone';
import { QuickUploadButtons } from '@/components/upload/QuickUploadButtons';
import { UploadStatus } from '@/components/upload/UploadStatus';
import { AnalysisLayerSelector } from '@/components/analysis/AnalysisLayerSelector';
import { AnalyzeButton } from '@/components/analysis/AnalyzeButton';
import { AnalysisResultsCard } from '@/components/analysis/AnalysisResultsCard';
import { LayersCard } from '@/components/data/LayerRow';
import { ResultsCard } from '@/components/data/ResultRow';
import { ExportPanel } from '@/features/export/ExportPanel';

export interface RightPanelProps {
  /** Optional override — when provided, replaces the default cards. */
  children?: ReactNode;
}

/**
 * Container for the page-level right rail. Pages can either render the default
 * stack of cards (search, upload, layers, results, export) or pass their own
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
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const hasPolygon = useUploadStore((s) => s.polygon !== null);

  return (
    <>
      <div className="relative">
        <input
          type="text"
          placeholder="חיפוש בנתונים..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 pe-10 text-[13px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-brand-teal"
        />
        <Search
          size={15}
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-faint"
        />
      </div>

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
        <Dropzone />
        <UploadStatus />
        <QuickUploadButtons />
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

      <AnalysisResultsCard />

      <LayersCard />
      <ResultsCard />
      <ExportPanel />
    </>
  );
}
