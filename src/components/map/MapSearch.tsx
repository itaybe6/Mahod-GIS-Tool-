import { useCallback } from 'react';
import { Search } from 'lucide-react';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox/config';
import type { GeocodeFeatureNormalized } from '@/lib/mapbox/geocoding';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';
import { MapboxGeocodeAutocomplete } from '@/components/map/MapboxGeocodeAutocomplete';

function zoomForPlaceTypes(placeType: string[]): number {
  if (placeType.includes('address')) return 17;
  if (placeType.includes('poi')) return 15;
  if (placeType.includes('neighborhood')) return 13;
  if (placeType.includes('locality') || placeType.includes('place')) return 11;
  return 14;
}

export interface MapSearchProps {
  onLocate?: never;
}

/**
 * Hebrew Mapbox Geocoding: one field for full address / city / place.
 * Requires `VITE_MAPBOX_ACCESS_TOKEN` (URL-restrict the token in Mapbox).
 */
export function MapSearch(_props: MapSearchProps): JSX.Element {
  const requestMapFocus = useMapStore((s) => s.requestMapFocus);
  const showToast = useUIStore((s) => s.showToast);
  const token = MAPBOX_ACCESS_TOKEN;

  const handlePick = useCallback(
    (feature: GeocodeFeatureNormalized) => {
      const [lng, lat] = feature.center;
      const zoom = zoomForPlaceTypes(feature.place_type);
      requestMapFocus(lat, lng, zoom, feature.bbox);
      showToast(`מיקוד: ${feature.place_name}`);
    },
    [requestMapFocus, showToast]
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {!token && (
        <p className="text-[10px] leading-tight text-amber-500/90">
          הגדרו VITE_MAPBOX_ACCESS_TOKEN להשלמה אוטומטית (והגבילו לפי URL בחשבון Mapbox).
        </p>
      )}
      <div className="relative max-w-[min(100%,420px)] min-w-0 flex-1 [&_input]:pe-9">
        <MapboxGeocodeAutocomplete
          variant="full"
          placeholder="כתובת מלאה, עיר או מקום…"
          onPick={handlePick}
          className="w-full"
        />
        <Search
          size={15}
          className="pointer-events-none absolute end-3 top-1/2 z-10 -translate-y-1/2 text-text-faint"
          aria-hidden
        />
      </div>
    </div>
  );
}
