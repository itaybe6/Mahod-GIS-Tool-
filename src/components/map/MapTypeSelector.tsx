import { MAP_TYPES, MAP_TYPE_HEBREW_LABELS, MAP_TYPE_LABELS, type MapType } from '@/constants/mapConfig';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

/**
 * Compact base-map switcher (DARK / OSM / SAT / TOPO).
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
    <div className="flex shrink-0 gap-1 rounded-lg border border-border bg-bg-2 p-1">
      {MAP_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => handleSelect(type)}
          title={MAP_TYPE_HEBREW_LABELS[type]}
          aria-pressed={mapType === type}
          className={cn(
            'grid h-7 w-8 cursor-pointer place-items-center rounded font-mono text-[10px] font-semibold transition-all',
            mapType === type
              ? 'bg-surface-2 text-brand-teal shadow-[0_0_0_1px_rgba(76,175,80,0.32)]'
              : 'text-text-faint hover:text-text'
          )}
        >
          {MAP_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
