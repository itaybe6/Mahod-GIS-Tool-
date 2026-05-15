import type { LucideIcon } from 'lucide-react';
import { Box, Map, Moon, Mountain, Satellite } from 'lucide-react';
import { MAP_TYPES, MAP_TYPE_HEBREW_LABELS, MAP_TYPE_LABELS, type MapType } from '@/constants/mapConfig';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

const MAP_TYPE_ICONS: Record<MapType, LucideIcon> = {
  mapbox3d: Box,
  topo: Mountain,
  sat: Satellite,
  osm: Map,
  dark: Moon,
};

/**
 * Compact base-map switcher (DARK / OSM / SAT / TOPO / 3D).
 * Reads & writes `mapType` from the map store; emits a toast on change.
 */
export function MapTypeSelector(): JSX.Element {
  const mapType = useMapStore((s) => s.mapType);
  const setMapType = useMapStore((s) => s.setMapType);
  const showToast = useUIStore((s) => s.showToast);

  const handleSelect = (type: MapType): void => {
    if (type === mapType) return;
    setMapType(type);
    showToast(`מפה: ${MAP_TYPE_LABELS[type]}`);
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/[0.08] bg-black/40 p-1 shadow-lg backdrop-blur-md">
      {MAP_TYPES.map((type) => {
        const Icon = MAP_TYPE_ICONS[type];
        const active = mapType === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            title={MAP_TYPE_HEBREW_LABELS[type]}
            aria-pressed={active}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1.5 transition-all duration-200',
              active
                ? 'bg-brand-teal/15 text-brand-teal shadow-[0_0_12px_rgba(76,175,80,0.25),inset_0_0_0_1px_rgba(76,175,80,0.35)]'
                : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
            )}
          >
            <Icon
              size={13}
              strokeWidth={active ? 2.5 : 2}
              className="transition-transform duration-200 group-hover:scale-110"
            />
            <span className="font-mono text-[9px] font-bold tracking-wide leading-none">
              {MAP_TYPE_LABELS[type]}
            </span>
            {active && (
              <span className="absolute inset-x-2 bottom-0.5 h-[2px] rounded-full bg-brand-teal/70" />
            )}
          </button>
        );
      })}
    </div>
  );
}
