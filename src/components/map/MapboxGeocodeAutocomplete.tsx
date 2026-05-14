import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox/config';
import {
  DEFAULT_PROXIMITY,
  ISRAEL_REGION_BBOX,
  fetchMapboxGeocodeAutocomplete,
  type GeocodeFeatureNormalized,
} from '@/lib/mapbox/geocoding';
import { fetchGtfsStopSuggestions } from '@/lib/gtfs/stopSuggestions';

export type GeocodeFieldVariant = 'city' | 'address' | 'place' | 'full';

const VARIANT_TYPES: Record<GeocodeFieldVariant, string> = {
  city: 'place,locality',
  address: 'address',
  place: 'poi,neighborhood',
  /** Single bar: street-level, settlements, and POIs (Hebrew full-address typing). */
  full: 'address,place,locality,poi,neighborhood',
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_CHARS = 2;
const SUGGESTION_LIMIT = 8;
/** When true, merge GTFS stop name matches (Supabase) so rail/bus stop names autocomplete. */
const GTFS_STOP_LIMIT = 6;

export interface MapboxGeocodeAutocompleteProps {
  variant: GeocodeFieldVariant;
  /** Short label above the field; omit or leave empty for a bare input. */
  label?: string;
  placeholder: string;
  /** When set (e.g. chosen city), address queries become `{input}, {cityContext}`. */
  cityContext?: string;
  className?: string;
  onPick: (feature: GeocodeFeatureNormalized) => void;
  /** Fires on every keystroke — use to combine address search with a typed city line. */
  onInputChange?: (value: string) => void;
  /**
   * When true, also queries `gtfs_stops` (Supabase) by `stop_name` and prepends those
   * suggestions. Mapbox Geocoding v5 no longer returns many POIs (e.g. rail stations);
   * this keeps Hebrew station names working in the route planner.
   */
  includeGtfsStops?: boolean;
}

export function MapboxGeocodeAutocomplete({
  variant,
  label,
  placeholder,
  cityContext,
  className,
  onPick,
  onInputChange,
  includeGtfsStops = false,
}: MapboxGeocodeAutocompleteProps): JSX.Element {
  const listId = useId();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<GeocodeFeatureNormalized[]>([]);
  const [loading, setLoading] = useState(false);

  const blurTimeoutRef = useRef<number | null>(null);
  const token = MAPBOX_ACCESS_TOKEN;

  const buildQuery = useCallback(
    (raw: string): string => {
      const t = raw.trim();
      if (variant === 'address' && cityContext?.trim()) {
        return `${t}, ${cityContext.trim()}`;
      }
      return t;
    },
    [variant, cityContext]
  );

  useEffect(() => {
    let active = true;
    const q = value.trim();

    if (q.length < MIN_QUERY_CHARS) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return () => {
        active = false;
      };
    }

    if (!token && !includeGtfsStops) {
      setSuggestions([]);
      setLoading(false);
      setActiveIndex(-1);
      return () => {
        active = false;
      };
    }

    const built = buildQuery(q);
    if (built.length < MIN_QUERY_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const mapboxPromise =
          token != null && token !== ''
            ? fetchMapboxGeocodeAutocomplete({
                query: built,
                types: VARIANT_TYPES[variant],
                limit: SUGGESTION_LIMIT,
                bbox: ISRAEL_REGION_BBOX,
                proximity: DEFAULT_PROXIMITY,
                fuzzyMatch: true,
                accessToken: token,
              })
            : Promise.resolve([] as GeocodeFeatureNormalized[]);
        const gtfsPromise = includeGtfsStops
          ? fetchGtfsStopSuggestions(built, GTFS_STOP_LIMIT)
          : Promise.resolve([] as GeocodeFeatureNormalized[]);

        const [mapboxResults, gtfsResults] = await Promise.all([mapboxPromise, gtfsPromise]);

        if (!active) return;

        const seen = new Set<string>();
        const merged: GeocodeFeatureNormalized[] = [];
        for (const f of gtfsResults) {
          const key = `${f.center[0].toFixed(5)},${f.center[1].toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(f);
        }
        for (const f of mapboxResults) {
          const key = `${f.center[0].toFixed(5)},${f.center[1].toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(f);
          if (merged.length >= SUGGESTION_LIMIT + GTFS_STOP_LIMIT) break;
        }

        setSuggestions(merged.slice(0, SUGGESTION_LIMIT + GTFS_STOP_LIMIT));
        setLoading(false);
        setActiveIndex(-1);
      })();
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value, token, variant, buildQuery, includeGtfsStops]);

  const pick = useCallback(
    (f: GeocodeFeatureNormalized) => {
      onPick(f);
      setValue(f.place_name);
      onInputChange?.(f.place_name);
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
    },
    [onPick, onInputChange]
  );

  const cancelBlurClose = useCallback(() => {
    if (blurTimeoutRef.current != null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null;
      setOpen(false);
      setActiveIndex(-1);
    }, 150);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      const idx = activeIndex >= 0 ? activeIndex : 0;
      const f = suggestions[idx];
      if (f) {
        e.preventDefault();
        pick(f);
      }
    }
  };

  const showLabel = Boolean(label?.trim());

  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className ?? ''}`}>
      {showLabel && (
        <label className="truncate text-[10px] font-medium uppercase tracking-wide text-text-faint">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          dir="rtl"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          disabled={!token && !includeGtfsStops}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            onInputChange?.(next);
            setOpen(true);
          }}
          onFocus={() => {
            cancelBlurClose();
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={scheduleClose}
          onKeyDown={handleKeyDown}
          className="h-9 w-full min-w-[120px] rounded-lg border border-border bg-surface px-2.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-brand-teal disabled:cursor-not-allowed disabled:opacity-50"
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            dir="rtl"
            role="listbox"
            className="absolute end-0 top-full z-50 mt-1 max-h-60 min-w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
            onMouseDown={cancelBlurClose}
          >
            {suggestions.map((f, idx) => (
              <li
                key={f.id}
                id={`${listId}-opt-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                className={`cursor-pointer px-2.5 py-1.5 text-[12px] leading-snug text-text ${
                  idx === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(f);
                }}
              >
                {f.place_name}
              </li>
            ))}
          </ul>
        )}
        {loading &&
          (Boolean(token) || includeGtfsStops) &&
          value.trim().length >= MIN_QUERY_CHARS && (
          <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-text-faint">
            …
          </span>
        )}
      </div>
    </div>
  );
}
