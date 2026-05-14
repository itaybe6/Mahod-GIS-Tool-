import { Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAreaAnalysis } from '@/hooks/useAreaAnalysis';
import { useUploadStore } from '@/stores/uploadStore';

/**
 * Run-button for the area analysis. Reads the polygon presence from
 * `useUploadStore` to render a contextual hint when disabled, then
 * delegates the work to `useAreaAnalysis`.
 */
export function AnalyzeButton(): JSX.Element {
  const { analyze, canAnalyze, isRunning } = useAreaAnalysis();
  const hasPolygon = useUploadStore((s) => s.polygon !== null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        onClick={() => void analyze()}
        disabled={!canAnalyze}
        className="w-full bg-gradient-to-r from-brand-blue to-brand-teal text-white hover:opacity-90"
      >
        {isRunning ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            מנתח אזור...
          </>
        ) : (
          <>
            <Play size={14} />
            התחל ניתוח
          </>
        )}
      </Button>
      {!hasPolygon && (
        <div className="text-center text-[11px] text-text-faint">
          העלה פוליגון כדי להפעיל ניתוח
        </div>
      )}
    </div>
  );
}
