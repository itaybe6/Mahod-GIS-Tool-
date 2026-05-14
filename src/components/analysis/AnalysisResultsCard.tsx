import { useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Bus,
  Route,
  Train,
  AlertOctagon,
  Gauge,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAnalysisStore,
  type AnalysisLayerKey,
  type LayerResult,
  type TrafficDetails,
} from '@/stores/analysisStore';

const LAYER_META: Record<
  AnalysisLayerKey,
  { label: string; icon: typeof Bus; color: string }
> = {
  transit: { label: 'תחבורה ציבורית', icon: Bus, color: 'text-success' },
  accidents: { label: 'תאונות דרכים', icon: AlertOctagon, color: 'text-danger' },
  roads: { label: 'דרכים', icon: Route, color: 'text-warning' },
  infrastructure: { label: 'תשתיות', icon: Train, color: 'text-purple' },
  traffic: { label: 'ספירות תנועה', icon: Gauge, color: 'text-[#0ea5e9]' },
};

const TRAFFIC_BREAKDOWN_LABELS: Record<string, string> = {
  total_volume: 'סה"כ נפח',
  volume_rows: 'רשומות נפח',
  stations_with_data: 'תחנות עם דאטה',
  stations_no_data: 'תחנות ללא דאטה',
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
  const isTraffic = layerKey === 'traffic';
  const labels = isTraffic ? TRAFFIC_BREAKDOWN_LABELS : null;

  return (
    <div className="flex flex-col gap-1 rounded border border-border/60 bg-bg-1 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className={meta.color} />
          <span className="text-[12px] text-text">{meta.label}</span>
          {isTraffic && (
            <span className="text-[10.5px] text-text-faint">
              ({result.counts.count.toLocaleString('he-IL')} תחנות)
            </span>
          )}
        </div>
        {!isTraffic && (
          <span className="font-mono text-[12px] text-text">
            {result.counts.count.toLocaleString('he-IL')}
          </span>
        )}
      </div>
      {breakdown && Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 ps-5 font-mono text-[10.5px] text-text-faint">
          {Object.entries(breakdown).map(([k, v]) => (
            <span key={k}>
              {labels?.[k] ?? k}:{' '}
              {typeof v === 'number' ? v.toLocaleString('he-IL') : String(v)}
            </span>
          ))}
        </div>
      )}
      {isTraffic && result.traffic && (
        <TrafficSummary details={result.traffic} />
      )}
    </div>
  );
}

interface TrafficSummaryProps {
  details: TrafficDetails;
}

/**
 * Compact, layer-specific dashboard for the traffic_count_volumes data.
 * Shows three pre-aggregated views the SQL function returns:
 *   1. Volume by vehicle group (chips, share %).
 *   2. Top 5 individual vehicle types (rows with proportional bar).
 *   3. Hourly distribution (24-bar mini chart).
 *
 * All numbers come pre-aggregated from PostgreSQL — no client-side arithmetic
 * over the raw 40K volume rows.
 */
function TrafficSummary({ details }: TrafficSummaryProps): JSX.Element | null {
  const groupTotal = details.by_group.reduce((sum, g) => sum + g.volume, 0);
  const topMax = details.top_types.reduce((m, t) => Math.max(m, t.volume), 0);
  const hourBuckets = useMemo(() => {
    const out: Array<{ hour: number; volume: number }> = [];
    for (let h = 0; h < 24; h += 1) {
      out.push({ hour: h, volume: details.by_hour[String(h)] ?? 0 });
    }
    return out;
  }, [details.by_hour]);
  const hourMax = hourBuckets.reduce((m, b) => Math.max(m, b.volume), 0);

  if (groupTotal === 0 && topMax === 0 && hourMax === 0) {
    return (
      <div className="ps-5 text-[10.5px] text-text-faint">
        אין רשומות נפח בתוך האזור (ייתכן שהתחנות הן מחוץ לטווח 2025 או שלא הועלו עדיין).
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-2 ps-5">
      {details.by_group.length > 0 && (
        <section>
          <div className="mb-0.5 text-[10.5px] font-medium text-text-dim">
            פילוח לפי קבוצת רכב
          </div>
          <div className="flex flex-wrap gap-1">
            {details.by_group.map((g) => {
              const share = groupTotal > 0 ? g.volume / groupTotal : 0;
              return (
                <span
                  key={g.group}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-bg-2 px-1.5 py-0.5 text-[10.5px] text-text"
                  title={`${g.volume.toLocaleString('he-IL')} (${(share * 100).toFixed(1)}%)`}
                >
                  <span className="text-text-dim">{g.group}</span>
                  <span className="font-mono text-text">
                    {g.volume.toLocaleString('he-IL')}
                  </span>
                  <span className="text-text-faint">{(share * 100).toFixed(0)}%</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {details.top_types.length > 0 && (
        <section>
          <div className="mb-0.5 text-[10.5px] font-medium text-text-dim">
            5 סוגי רכב מובילים
          </div>
          <div className="flex flex-col gap-0.5">
            {details.top_types.map((t) => {
              const ratio = topMax > 0 ? t.volume / topMax : 0;
              return (
                <div key={t.vehicle_type} className="flex items-center gap-2 text-[10.5px]">
                  <span className="w-20 shrink-0 truncate text-text" title={t.vehicle_type}>
                    {t.vehicle_type}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded bg-bg-2">
                    <div
                      className="absolute inset-y-0 right-0 bg-[#0ea5e9]/70"
                      style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-end font-mono text-text-dim">
                    {t.volume.toLocaleString('he-IL')}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hourMax > 0 && (
        <section>
          <div className="mb-0.5 text-[10.5px] font-medium text-text-dim">
            פילוח שעתי (00–23)
          </div>
          <div
            className="flex h-12 items-end gap-[1px] rounded border border-border/40 bg-bg-2 p-1"
            role="img"
            aria-label="גרף עמודות של נפח לפי שעת יום"
          >
            {hourBuckets.map((b) => {
              const ratio = hourMax > 0 ? b.volume / hourMax : 0;
              return (
                <div
                  key={b.hour}
                  className="group relative flex-1"
                  title={`שעה ${b.hour.toString().padStart(2, '0')}: ${b.volume.toLocaleString('he-IL')}`}
                >
                  <div
                    className="mx-auto w-full rounded-sm bg-[#0ea5e9]/70 transition-colors group-hover:bg-[#0ea5e9]"
                    style={{ height: `${Math.max(ratio * 100, 4)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-0.5 flex justify-between font-mono text-[9.5px] text-text-faint">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </section>
      )}
    </div>
  );
}
