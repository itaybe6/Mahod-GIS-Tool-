import { useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Construction,
  Building2,
  Gauge,
  MapPin,
  X,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatPill, type StatPillTone } from '@/components/data/StatPill';
import { useAnalysisStore, type AnalysisLayerKey } from '@/stores/analysisStore';
import { useMapStore } from '@/stores/mapStore';
import type { LucideIcon } from 'lucide-react';
import type { LayerKey } from '@/types/common';
import type { FeatureCollection, Geometry } from 'geojson';

/* ── Static config per layer ──────────────────────────────────── */
interface LayerStatConfig {
  key: LayerKey;
  icon: LucideIcon;
  tone: StatPillTone;
  label: string;
  staticValue: string;
  staticUnit?: string;
  staticTrend?: string;
  trendDirection?: 'up' | 'down';
  color: string;
}

const LAYER_STATS: LayerStatConfig[] = [
  {
    key: 'accidents',
    icon: AlertTriangle,
    tone: 'red',
    label: 'תאונות דרכים',
    staticValue: '2,847',
    staticTrend: '↑ 4.2%',
    trendDirection: 'down',
    color: '#ef4444',
  },
  {
    key: 'transit',
    icon: Bus,
    tone: 'emerald',
    label: 'קווי תח״צ',
    staticValue: '342',
    staticTrend: '↑ 1.1%',
    color: '#10b981',
  },
  {
    key: 'roads',
    icon: Construction,
    tone: 'amber',
    label: 'רשת כבישים',
    staticValue: '1,205',
    staticUnit: 'ק״מ',
    staticTrend: '↑ 0.3%',
    color: '#f59e0b',
  },
  {
    key: 'infrastructure',
    icon: Building2,
    tone: 'purple',
    label: 'תשתיות',
    staticValue: '89',
    staticTrend: '↑ 2.5%',
    color: '#a855f7',
  },
  {
    key: 'traffic',
    icon: Gauge,
    tone: 'emerald' as StatPillTone,
    label: 'ספירות תנועה',
    staticValue: '—',
    color: '#0ea5e9',
  },
];

/* ── Feature helpers ──────────────────────────────────────────── */
function getTitle(key: LayerKey, props: Record<string, unknown>): string {
  const s = (v: unknown) => (v == null ? '' : String(v));
  switch (key) {
    case 'transit': return s(props.stop_name ?? props.name) || '—';
    case 'accidents': return props.city ? s(props.city) : `אזור ${s(props.id ?? '—')}`;
    case 'roads':
      if (props.road_name) return s(props.road_name);
      if (props.road_number) return `כביש ${s(props.road_number)}`;
      return '—';
    case 'infrastructure': return s(props.name ?? props.category) || '—';
    case 'traffic': return s(props.description ?? props.count_type) || '—';
    default: return '—';
  }
}

function getSubtitle(key: LayerKey, props: Record<string, unknown>): string {
  const s = (v: unknown) => (v == null ? '' : String(v));
  switch (key) {
    case 'transit': return s(props.type ?? '');
    case 'accidents': {
      const n = typeof props.accidents === 'number' ? props.accidents : null;
      return n != null ? `${n.toLocaleString('he-IL')} תאונות` : '';
    }
    case 'roads': {
      const parts: string[] = [];
      if (props.authority) parts.push(s(props.authority));
      if (typeof props.length_m === 'number')
        parts.push(`${Math.round(props.length_m).toLocaleString('he-IL')} מ'`);
      return parts.join(' · ');
    }
    case 'infrastructure': return s(props.category ?? props.status ?? '');
    case 'traffic':
      return typeof props.total_volume === 'number' && props.total_volume > 0
        ? `נפח: ${props.total_volume.toLocaleString('he-IL')}`
        : '';
    default: return '';
  }
}

/* ── Feature list panel (horizontal scroll) ───────────────────── */
interface FeatureListProps {
  cfg: LayerStatConfig;
  features: FeatureCollection<Geometry>['features'];
  onClose: () => void;
}

function FeatureList({ cfg, features, onClose }: FeatureListProps): JSX.Element {
  const setFocusAnalysisFeature = useMapStore((s) => s.setFocusAnalysisFeature);

  return (
    <div
      className="animate-fadein overflow-hidden rounded-md border border-border bg-surface"
      dir="rtl"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${cfg.color}28` }}
      >
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
        />
        <span className="text-[12px] font-semibold text-text">{cfg.label}</span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
          style={{ background: `${cfg.color}22`, color: cfg.color }}
        >
          {features.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ms-auto rounded-md p-0.5 text-text-faint transition-colors hover:bg-white/[0.08] hover:text-text"
          aria-label="סגור"
        >
          <X size={12} />
        </button>
      </div>

      {/* Horizontal scroll list */}
      <div className="flex gap-2 overflow-x-auto p-2 pb-2.5">
        {features.map((feature, idx) => {
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          const title = getTitle(cfg.key, props);
          const sub = getSubtitle(cfg.key, props);

          return (
            <div
              key={idx}
              className={cn(
                'flex w-[160px] flex-shrink-0 flex-col gap-1 rounded-md border border-border/70',
                'bg-bg-1 px-2.5 py-2 transition-colors hover:border-border hover:bg-surface'
              )}
            >
              <div className="truncate text-[11.5px] font-medium text-text" title={title}>
                {title}
              </div>
              {sub && (
                <div className="truncate text-[10px] text-text-faint" title={sub}>
                  {sub}
                </div>
              )}
              <button
                type="button"
                title="התמקד על המפה"
                onClick={() => setFocusAnalysisFeature({ layerKey: cfg.key, featureIndex: idx })}
                className="mt-auto flex items-center gap-1 self-start rounded px-1.5 py-0.5 text-[10px] text-text-faint transition-all hover:text-white"
                style={{ ['--c' as string]: cfg.color }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = cfg.color)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '')}
              >
                <MapPin size={9} />
                התמקד
              </button>
            </div>
          );
        })}

        {features.length === 0 && (
          <span className="py-2 text-[11.5px] text-text-faint">אין תוצאות לשכבה זו</span>
        )}
      </div>

      {/* Hint */}
      <div
        className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-text-faint"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <ChevronLeft size={10} className="opacity-50" />
        לחץ "התמקד" כדי לעוף לנקודה על המפה ולפתוח את הפופ-אפ שלה
      </div>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────── */
export function AnalysisBottomSection(): JSX.Element {
  const [expandedLayer, setExpandedLayer] = useState<LayerKey | null>(null);
  const results = useAnalysisStore((s) => s.results);
  const status = useAnalysisStore((s) => s.status);
  const hasAnalysis = status === 'ready' && results != null;

  const visibleStats = hasAnalysis
    ? LAYER_STATS.filter(
        (cfg) => results[cfg.key as AnalysisLayerKey] != null || cfg.key !== 'traffic'
      )
    : LAYER_STATS.filter((cfg) => cfg.key !== 'traffic');

  const handlePillClick = (cfg: LayerStatConfig) => {
    if (!hasAnalysis || !results[cfg.key as AnalysisLayerKey]) return;
    setExpandedLayer((prev) => (prev === cfg.key ? null : cfg.key));
  };

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {/* Feature list panel — shown when a pill is clicked */}
      {expandedLayer && hasAnalysis && (() => {
        const cfg = LAYER_STATS.find((c) => c.key === expandedLayer)!;
        const fc = results[expandedLayer as AnalysisLayerKey]?.features as
          | FeatureCollection<Geometry>
          | undefined;
        return (
          <FeatureList
            cfg={cfg}
            features={fc?.features ?? []}
            onClose={() => setExpandedLayer(null)}
          />
        );
      })()}

      {/* Stat pills row */}
      <div
        className={cn(
          'grid gap-2.5 max-[1024px]:grid-cols-2',
          visibleStats.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
        )}
      >
        {visibleStats.map((cfg) => {
          const analysisResult = hasAnalysis ? results[cfg.key as AnalysisLayerKey] : null;
          const isActive = expandedLayer === cfg.key;
          const hasResult = analysisResult != null;

          const displayValue = hasResult
            ? analysisResult.counts.count.toLocaleString('he-IL')
            : cfg.staticValue;

          const pillTone: StatPillTone =
            cfg.key === 'traffic' ? 'emerald' : (cfg.tone as StatPillTone);

          return (
            <button
              key={cfg.key}
              type="button"
              onClick={() => handlePillClick(cfg)}
              className={cn(
                'w-full text-start transition-transform',
                hasResult && 'cursor-pointer active:scale-[0.98]',
                !hasResult && 'cursor-default'
              )}
              aria-pressed={isActive}
              disabled={!hasResult}
            >
              <StatPill
                icon={cfg.key === 'traffic' ? Gauge : cfg.icon}
                tone={cfg.key === 'traffic' ? ('emerald' as StatPillTone) : pillTone}
                label={cfg.label}
                value={displayValue}
                {...(!hasResult && cfg.staticUnit ? { unit: cfg.staticUnit } : {})}
                {...(!hasResult && cfg.staticTrend ? { trend: cfg.staticTrend } : {})}
                {...(cfg.trendDirection ? { trendDirection: cfg.trendDirection } : {})}
                active={isActive}
                {...(hasResult ? { analysisBadge: 'ניתוח' } : {})}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
