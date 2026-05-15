import { MousePointerClick, MapPin, Flag, X } from 'lucide-react';
import { MapboxGeocodeAutocomplete } from '@/components/map/MapboxGeocodeAutocomplete';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  useRoutePlannerStore,
  type RoutePlannerEndpoint,
  type RoutePlannerEndpointKind,
} from '@/stores/routePlannerStore';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';
import type { GeocodeFeatureNormalized } from '@/lib/mapbox/geocoding';

interface EndpointFieldProps {
  kind: RoutePlannerEndpointKind;
}

const META: Record<
  RoutePlannerEndpointKind,
  { label: string; placeholder: string; icon: typeof MapPin; tone: string; ringTone: string }
> = {
  origin: {
    label: 'מאיפה',
    placeholder: 'כתובת או נקודת התחלה…',
    icon: MapPin,
    tone: 'bg-emerald-500/15 text-emerald-300',
    ringTone: 'ring-emerald-400/40',
  },
  destination: {
    label: 'לאן',
    placeholder: 'כתובת או יעד…',
    icon: Flag,
    tone: 'bg-rose-500/15 text-rose-300',
    ringTone: 'ring-rose-400/40',
  },
};

/**
 * Single A or B field: Mapbox autocomplete + map-pick toggle + clear.
 * The current value is rendered as a chip below the input so the user
 * always sees the resolved coordinates / label that will be sent to the RPC.
 */
export function EndpointField({ kind }: EndpointFieldProps): JSX.Element {
  const meta = META[kind];
  const Icon = meta.icon;
  const value = useRoutePlannerStore((s) =>
    kind === 'origin' ? s.origin : s.destination
  );
  const pickingMode = useRoutePlannerStore((s) => s.pickingMode);
  const setOrigin = useRoutePlannerStore((s) => s.setOrigin);
  const setDestination = useRoutePlannerStore((s) => s.setDestination);
  const setPickingMode = useRoutePlannerStore((s) => s.setPickingMode);
  const requestMapFocus = useMapStore((s) => s.requestMapFocus);
  const setMobileRightPanelOpen = useUIStore((s) => s.setMobileRightPanelOpen);

  const setEndpoint = (next: RoutePlannerEndpoint | null) =>
    kind === 'origin' ? setOrigin(next) : setDestination(next);

  const isPicking = pickingMode === kind;

  const handlePick = (feature: GeocodeFeatureNormalized): void => {
    const [lng, lat] = feature.center;
    setEndpoint({ lat, lng, label: feature.place_name });
    requestMapFocus(lat, lng, 15, feature.bbox);
  };

  const togglePicking = (): void => {
    const next = isPicking ? null : kind;
    setPickingMode(next);
    // When entering picking mode, dismiss the mobile sheet so the map is reachable.
    if (next != null) setMobileRightPanelOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ring-1 ring-inset',
            meta.tone,
            meta.ringTone
          )}
          aria-hidden
        >
          <Icon size={12} />
        </span>
        <label className="text-[11px] font-medium uppercase tracking-wide text-white">
          {meta.label}
        </label>
        <button
          type="button"
          onClick={togglePicking}
          title={isPicking ? 'בטל בחירה מהמפה' : 'בחר נקודה על המפה'}
          aria-pressed={isPicking}
          className={cn(
            'ms-auto inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10.5px] transition-colors',
            isPicking
              ? 'border-brand-teal/60 bg-brand-teal/15 text-brand-teal'
              : 'border-border bg-bg-1 text-white hover:border-brand-teal/40 hover:text-brand-teal'
          )}
        >
          <MousePointerClick size={11} />
          {isPicking ? 'לחץ על המפה…' : 'בחר במפה'}
        </button>
      </div>

      <MapboxGeocodeAutocomplete
        variant="full"
        placeholder={meta.placeholder}
        onPick={handlePick}
        includeGtfsStops={isSupabaseConfigured}
        whiteText
      />

      {value && (
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-bg-1 px-2 py-1.5 text-[11.5px]">
          <span className={cn('h-2 w-2 rounded-full', meta.tone.split(' ')[0])} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-white" title={value.label}>
            {value.label}
          </span>
          <span className="hidden font-mono text-[10px] text-white sm:inline">
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={() => setEndpoint(null)}
            aria-label="הסר"
            title="הסר"
            className="grid h-5 w-5 place-items-center rounded text-white transition-colors hover:bg-danger/15 hover:text-danger"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
