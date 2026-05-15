import { useState } from 'react';
import { MapPin, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import { useUploadStore } from '@/stores/uploadStore';
import type { LayerKey, MapDomainTab } from '@/types/common';
import type { FeatureCollection, Geometry } from 'geojson';

/* ── Meta per layer ─────────────────────────────────────────────── */
const LAYER_META: Record<
  LayerKey,
  { label: string; color: string; emptyMsg: string }
> = {
  transit: {
    label: 'תחבורה ציבורית',
    color: '#10b981',
    emptyMsg: 'אין תחנות בפוליגון זה',
  },
  accidents: {
    label: 'תאונות דרכים',
    color: '#ef4444',
    emptyMsg: 'אין נתוני תאונות באזור',
  },
  roads: {
    label: 'דרכים',
    color: '#f59e0b',
    emptyMsg: 'אין מקטעי דרך בפוליגון זה',
  },
  infrastructure: {
    label: 'תשתיות',
    color: '#a855f7',
    emptyMsg: 'אין תשתיות בפוליגון זה',
  },
  traffic: {
    label: 'ספירות תנועה',
    color: '#0ea5e9',
    emptyMsg: 'אין תחנות ספירה בפוליגון זה',
  },
};

/* ── Feature title / subtitle helpers ──────────────────────────── */
function getTitle(key: LayerKey, props: Record<string, unknown>): string {
  switch (key) {
    case 'transit':
      return str(props.stop_name ?? props.name ?? '—');
    case 'accidents':
      return props.city ? str(props.city) : `אזור TAZ ${str(props.id ?? '—')}`;
    case 'roads':
      if (props.road_name) return str(props.road_name);
      if (props.road_number) return `כביש ${str(props.road_number)}`;
      return '—';
    case 'infrastructure':
      return str(props.name ?? props.category ?? '—');
    case 'traffic':
      return str(props.description ?? props.count_type ?? '—');
    default:
      return '—';
  }
}

function getSubtitle(key: LayerKey, props: Record<string, unknown>): string {
  switch (key) {
    case 'transit':
      return str(props.type ?? '');
    case 'accidents': {
      const n = typeof props.accidents === 'number' ? props.accidents : null;
      return n != null ? `${n} תאונות` : '';
    }
    case 'roads': {
      const parts: string[] = [];
      if (props.authority) parts.push(str(props.authority));
      if (typeof props.length_m === 'number')
        parts.push(`${Math.round(props.length_m).toLocaleString('he-IL')} מ'`);
      return parts.join(' · ');
    }
    case 'infrastructure':
      return str(props.category ?? props.status ?? '');
    case 'traffic': {
      const vol =
        typeof props.total_volume === 'number' && props.total_volume > 0
          ? `נפח: ${props.total_volume.toLocaleString('he-IL')}`
          : '';
      return vol;
    }
    default:
      return '';
  }
}

const str = (v: unknown): string => (v == null ? '' : String(v));

/* ── Component ──────────────────────────────────────────────────── */

export function LayerResultsPanel(): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  const [prevDomain, setPrevDomain] = useState<MapDomainTab | null>(null);

  const activeDomain = useMapStore((s) => s.activeDomain);
  const setFocusAnalysisFeature = useMapStore((s) => s.setFocusAnalysisFeature);
  const results = useAnalysisStore((s) => s.results);
  const polygon = useUploadStore((s) => s.polygon);

  // Reset dismissed state when the user switches to a different layer tab.
  if (activeDomain !== prevDomain) {
    setPrevDomain(activeDomain);
    setDismissed(false);
  }

  if (!polygon || dismissed) return null;

  if (activeDomain === 'all') return null;

  const meta = LAYER_META[activeDomain];
  const layerResult = results?.[activeDomain as AnalysisLayerKey];
  const fc = layerResult?.features as FeatureCollection<Geometry> | undefined;
  const features = fc?.features ?? [];
  const count = features.length;

  // Nothing to show if no analysis ran yet for this layer.
  if (!results) return null;

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-14 start-2 z-[480] w-[260px] overflow-hidden',
        'rounded-xl border border-white/[0.08] bg-[rgba(10,14,26,0.96)] shadow-[0_16px_48px_rgba(0,0,0,0.7)]',
        'backdrop-blur-xl'
      )}
      dir="rtl"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${meta.color}28` }}
      >
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: meta.color, boxShadow: `0 0 7px ${meta.color}` }}
        />
        <span className="flex-1 text-[12.5px] font-semibold text-text">{meta.label}</span>
        {count > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `${meta.color}22`, color: meta.color }}
          >
            {count}
          </span>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md p-0.5 text-text-faint transition-colors hover:bg-white/[0.08] hover:text-text"
          aria-label="סגור"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      {count === 0 ? (
        <div className="px-3 py-3 text-[11.5px] text-text-faint">{meta.emptyMsg}</div>
      ) : (
        <ul className="max-h-[220px] overflow-y-auto">
          {features.map((feature, idx) => {
            const props = (feature.properties ?? {}) as Record<string, unknown>;
            const title = getTitle(activeDomain, props);
            const sub = getSubtitle(activeDomain, props);

            return (
              <li
                key={idx}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 transition-colors',
                  'border-b border-white/[0.04] last:border-0',
                  'hover:bg-white/[0.04]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-text">{title}</div>
                  {sub && (
                    <div className="truncate text-[10.5px] text-text-faint">{sub}</div>
                  )}
                </div>
                <button
                  type="button"
                  title="התמקד על המפה"
                  onClick={() =>
                    setFocusAnalysisFeature({
                      layerKey: activeDomain,
                      featureIndex: idx,
                    })
                  }
                  className="flex-shrink-0 rounded-md p-1.5 text-text-faint transition-all hover:text-white"
                  style={{ ['--hover-color' as string]: meta.color }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = meta.color)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = '')
                  }
                >
                  <MapPin size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer hint */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-text-faint"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <ChevronLeft size={10} className="opacity-50" />
        לחץ על
        <MapPin size={9} className="inline opacity-60" />
        כדי להתמקד על המפה
      </div>
    </div>
  );
}
