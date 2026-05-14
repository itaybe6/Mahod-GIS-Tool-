import { cn } from '@/lib/utils';
import { LAYER_COLORS, type LayerColorKey } from '@/constants/colors';
import { useMapStore } from '@/stores/mapStore';
import type { LayerKey } from '@/types/common';

interface TabMeta {
  label: string;
  /** Hover tooltip — explains exactly what the colored dot represents on the map. */
  description: string;
  /** Key into `LAYER_COLORS` (the same palette the map markers use). */
  colorKey: LayerColorKey;
}

const TABS: Record<LayerKey, TabMeta> = {
  transit: {
    label: 'תחבורה ציבורית',
    description: 'נקודה ירוקה = תחנת אוטובוס / רכבת',
    colorKey: 'transit',
  },
  accidents: {
    label: 'תאונות',
    description: 'תאונות לפי יישוב (אגרגט CBS / TAZ)',
    colorKey: 'accidents',
  },
  roads: {
    label: 'דרכים',
    description: 'קו כתום = ציר דרך / כביש',
    colorKey: 'roads',
  },
  infrastructure: {
    label: 'תשתיות',
    description: 'נקודה סגולה = תשתית ציבורית',
    colorKey: 'infra',
  },
  traffic: {
    label: 'ספירות תנועה',
    description: 'נקודה תכולה = תחנת ספירת תנועה (Vol4)',
    colorKey: 'traffic',
  },
};

const TAB_ORDER: LayerKey[] = ['transit', 'accidents', 'roads', 'infrastructure', 'traffic'];

/**
 * Pill-shaped tab strip that "spotlights" a specific domain on the map.
 *
 * Each tab now carries a dot in the *exact same color* its markers use on the
 * map (so the strip doubles as a quick-glance legend), plus a Hebrew `title`
 * tooltip describing what that color means. Active tab gets a soft ring around
 * the dot for emphasis without losing the category color.
 */
export function LayerToggle(): JSX.Element {
  const activeDomain = useMapStore((s) => s.activeDomain);
  const setActiveDomain = useMapStore((s) => s.setActiveDomain);

  return (
    <div
      className="flex gap-1 rounded-full border border-border bg-bg-2 p-1"
      role="tablist"
      aria-label="שכבות מפה"
    >
      {TAB_ORDER.map((tab) => {
        const meta = TABS[tab];
        const dotColor = LAYER_COLORS[meta.colorKey];
        const isActive = activeDomain === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            onClick={() => setActiveDomain(tab)}
            aria-pressed={isActive}
            aria-selected={isActive}
            title={meta.description}
            className={cn(
              'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all',
              isActive
                ? 'bg-gradient-to-br from-brand-teal to-brand-teal2 font-semibold text-white shadow-[0_4px_14px_rgba(76,175,80,0.4)]'
                : 'text-text-dim hover:text-text'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-2 w-2 rounded-full ring-offset-1 transition-all',
                isActive
                  ? 'ring-2 ring-white/80 ring-offset-brand-teal'
                  : 'ring-1 ring-white/15 ring-offset-bg-2'
              )}
              style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}66` }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
