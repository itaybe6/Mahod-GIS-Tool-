import { Bus, AlertOctagon, Route, Train, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAnalysisStore,
  type AnalysisLayerKey,
} from '@/stores/analysisStore';

interface LayerEntry {
  key: AnalysisLayerKey;
  title: string;
  icon: typeof Bus;
}

const LAYERS: LayerEntry[] = [
  {
    key: 'transit',
    title: 'תחבורה ציבורית',
    icon: Bus,
  },
  {
    key: 'accidents',
    title: 'תאונות דרכים',
    icon: AlertOctagon,
  },
  {
    key: 'roads',
    title: 'דרכים ורשויות תמרור',
    icon: Route,
  },
  {
    key: 'infrastructure',
    title: 'תשתיות',
    icon: Train,
  },
  {
    key: 'traffic',
    title: 'ספירות תנועה',
    icon: Gauge,
  },
];

interface AnalysisLayerSelectorProps {
  disabled?: boolean;
}

/**
 * Lets the user pick which spatial layers to query for the area analysis.
 * Each card is a controlled checkbox tied directly to `useAnalysisStore`.
 *
 * When `disabled` (no polygon yet), the cards are dimmed but selection is
 * preserved — the user can pre-pick layers before uploading.
 */
export function AnalysisLayerSelector({
  disabled = false,
}: AnalysisLayerSelectorProps): JSX.Element {
  const selection = useAnalysisStore((s) => s.selection);
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer);

  return (
    <div className="flex flex-col gap-2">
      {LAYERS.map((layer) => {
        const checked = selection[layer.key];
        const Icon = layer.icon;
        return (
          <label
            key={layer.key}
            className={cn(
              'group flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 transition-all',
              checked
                ? 'border-brand-teal/60 bg-brand-teal/10'
                : 'border-border bg-bg-1 hover:border-brand-teal/40',
              disabled && 'cursor-not-allowed opacity-50 hover:border-border'
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggleLayer(layer.key)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-brand-teal disabled:cursor-not-allowed"
              aria-label={layer.title}
            />
            <Icon
              size={16}
              className={cn(
                'shrink-0 transition-colors',
                checked ? 'text-brand-teal' : 'text-text-faint'
              )}
            />
            <div className="min-w-0 flex-1 text-[12.5px] font-medium text-text">
              {layer.title}
            </div>
          </label>
        );
      })}
    </div>
  );
}
