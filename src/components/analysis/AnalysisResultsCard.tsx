import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, X, Bus, Route, Train, AlertOctagon } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAnalysisStore,
  type AnalysisLayerKey,
  type LayerResult,
} from '@/stores/analysisStore';

const LAYER_META: Record<
  AnalysisLayerKey,
  { label: string; icon: typeof Bus; color: string }
> = {
  transit: { label: 'תחבורה ציבורית', icon: Bus, color: 'text-success' },
  accidents: { label: 'תאונות דרכים', icon: AlertOctagon, color: 'text-danger' },
  roads: { label: 'דרכים', icon: Route, color: 'text-warning' },
  infrastructure: { label: 'תשתיות', icon: Train, color: 'text-purple' },
};

/**
 * Right-panel card that summarises the most recent area-analysis run.
 * Hidden when the analysis store is `idle`. Falls back to a compact
 * loading state during runs and a clear error message on failure.
 */
export function AnalysisResultsCard(): JSX.Element | null {
  const status = useAnalysisStore((s) => s.status);
  const results = useAnalysisStore((s) => s.results);
  const error = useAnalysisStore((s) => s.error);
  const durationMs = useAnalysisStore((s) => s.durationMs);
  const clearResults = useAnalysisStore((s) => s.clearResults);

  const totalCount = useMemo(() => {
    if (!results) return 0;
    return Object.values(results).reduce(
      (sum, layer) => sum + (layer?.counts?.count ?? 0),
      0
    );
  }, [results]);

  if (status === 'idle') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === 'running' && <Loader2 size={12} className="animate-spin text-text-faint" />}
          {status === 'ready' && <CheckCircle2 size={12} className="text-success" />}
          {status === 'error' && <AlertTriangle size={12} className="text-danger" />}
          תוצאות ניתוח
        </CardTitle>
        {(status === 'ready' || status === 'error') && (
          <button
            type="button"
            onClick={clearResults}
            title="נקה תוצאות"
            aria-label="נקה תוצאות"
            className="grid place-items-center text-text-faint transition-colors hover:text-danger"
          >
            <X size={13} />
          </button>
        )}
      </CardHeader>

      {status === 'running' && (
        <div className="text-[12px] text-text-dim">מריץ spatial queries...</div>
      )}

      {status === 'error' && error && (
        <div className="rounded border border-danger/30 bg-danger/10 px-2.5 py-2 text-[11.5px] leading-snug text-danger">
          {error}
        </div>
      )}

      {status === 'ready' && results && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-[11px] text-text-faint">
            <span>סה"כ {totalCount.toLocaleString('he-IL')} פיצ'רים</span>
            {durationMs != null && <span className="font-mono">{durationMs}ms</span>}
          </div>
          {(Object.keys(LAYER_META) as AnalysisLayerKey[]).map((key) => {
            const layerResult = results[key];
            if (!layerResult) return null;
            return (
              <LayerRow key={key} layerKey={key} result={layerResult} />
            );
          })}
        </div>
      )}
    </Card>
  );
}

interface LayerRowProps {
  layerKey: AnalysisLayerKey;
  result: LayerResult;
}

function LayerRow({ layerKey, result }: LayerRowProps): JSX.Element {
  const meta = LAYER_META[layerKey];
  const Icon = meta.icon;
  const breakdown = result.counts.breakdown;

  return (
    <div className="flex flex-col gap-0.5 rounded border border-border/60 bg-bg-1 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={meta.color} />
          <span className="text-[12px] text-text">{meta.label}</span>
        </div>
        <span className="font-mono text-[12px] text-text">
          {result.counts.count.toLocaleString('he-IL')}
        </span>
      </div>
      {breakdown && Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 ps-5 font-mono text-[10.5px] text-text-faint">
          {Object.entries(breakdown).map(([k, v]) => (
            <span key={k}>
              {k}: {typeof v === 'number' ? v.toLocaleString('he-IL') : String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
