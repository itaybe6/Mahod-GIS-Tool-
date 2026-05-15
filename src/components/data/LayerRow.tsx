import { Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { cn } from '@/lib/utils';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';
import type { LayerKey } from '@/types/common';
import {
  useMetroStations,
  useRailwayStations,
} from '@/features/infrastructure/useRailwayStations';

export interface LayerRowProps {
  dotTone: 'emerald' | 'red' | 'amber' | 'purple';
  name: string;
  count: string;
  layer: LayerKey;
  /** שורה נוספת מתחת למונה — למשל פירוט תחת «תשתיות». */
  detail?: string;
}

const DOT_TONES: Record<LayerRowProps['dotTone'], string> = {
  emerald: 'bg-success shadow-[0_0_8px_#10b981,0_0_0_3px_rgba(16,185,129,0.1)]',
  red: 'bg-danger shadow-[0_0_8px_#ef4444,0_0_0_3px_rgba(239,68,68,0.1)]',
  amber: 'bg-warning shadow-[0_0_8px_#f59e0b,0_0_0_3px_rgba(245,158,11,0.1)]',
  purple: 'bg-purple shadow-[0_0_8px_#8b5cf6,0_0_0_3px_rgba(139,92,246,0.1)]',
};

export function LayerRow({ dotTone, name, count, layer, detail }: LayerRowProps): JSX.Element {
  const enabled = useMapStore((s) => s.activeLayers[layer]);
  const setLayer = useMapStore((s) => s.setLayer);

  return (
    <div className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-white/[0.03] [&+&]:rounded-none [&+&]:border-t [&+&]:border-border">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT_TONES[dotTone])} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-white">{name}</div>
        <div className="font-mono text-[12px] leading-snug text-white">{count}</div>
        {detail ? (
          <div className="mt-0.5 text-[11.5px] leading-snug text-white">{detail}</div>
        ) : null}
      </div>
      <ToggleSwitch
        checked={enabled}
        onCheckedChange={(v) => setLayer(layer, v)}
        label={`${enabled ? 'הסתר' : 'הצג'} ${name}`}
      />
    </div>
  );
}

/** Default Layers card used by the right panel. */
export function LayersCard(): JSX.Element {
  const showToast = useUIStore((s) => s.showToast);
  const { data: railwayStations } = useRailwayStations();
  const { data: metroStations } = useMetroStations();
  const infrastructureCount = (railwayStations?.length ?? 0) + (metroStations?.length ?? 0);
  const infrastructureCountLabel =
    railwayStations == null && metroStations == null
      ? '—'
      : `${infrastructureCount.toLocaleString('he-IL')} תחנות`;
  const infrastructureDetail =
    railwayStations != null && metroStations != null
      ? `רכבת: ${railwayStations.length.toLocaleString('he-IL')} · רכבת קלה: ${metroStations.length.toLocaleString('he-IL')}`
      : 'רכבת כבדה ורכבת קלה (מטרו/רק"ל)';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-white">שכבות מידע</CardTitle>
        <button
          type="button"
          title="הוסף שכבה"
          aria-label="הוסף שכבה"
          onClick={() => showToast('הוספת שכבה — בקרוב')}
          className="grid place-items-center text-white/60 transition-colors hover:text-brand-teal"
        >
          <Plus size={14} />
        </button>
      </CardHeader>
      <div>
        <LayerRow dotTone="emerald" name="תחבורה ציבורית" count="342 קווים פעילים" layer="transit" />
        <LayerRow dotTone="red" name="תאונות דרכים" count="2,847 רשומות" layer="accidents" />
        <LayerRow dotTone="amber" name="רשת כבישים" count="1,205 ק״מ" layer="roads" />
        <LayerRow
          dotTone="purple"
          name="תשתיות"
          count={infrastructureCountLabel}
          detail={infrastructureDetail}
          layer="infrastructure"
        />
      </div>
    </Card>
  );
}
