import { useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import type { LatLngTuple } from '@/types/common';

/** Mock address index used until we hook up a geocoder. */
const KNOWN_ADDRESSES: Record<string, LatLngTuple> = {
  הרצל: [32.0707, 34.7766],
  רבין: [32.0879, 34.7818],
  איילון: [32.0823, 34.7951],
  יפו: [32.0501, 34.7547],
  'רמת גן': [32.068, 34.8248],
  חולון: [32.0167, 34.7795],
};

export interface MapSearchProps {
  /** Receives the resolved coordinates when an entry from `KNOWN_ADDRESSES` matches. */
  onLocate?: (coords: LatLngTuple, label: string) => void;
}

export function MapSearch({ onLocate }: MapSearchProps): JSX.Element {
  const [value, setValue] = useState('');
  const showToast = useUIStore((s) => s.showToast);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return;
    const query = value.trim();
    if (!query) return;
    for (const [key, coords] of Object.entries(KNOWN_ADDRESSES)) {
      if (query.includes(key)) {
        onLocate?.(coords, key);
        showToast(`מיקוד: ${key}`);
        return;
      }
    }
    showToast('כתובת לא נמצאה');
  };

  return (
    <div className="relative max-w-[320px] flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="חפש כתובת..."
        className="h-9 w-full rounded-lg border border-border bg-surface px-3 pe-9 text-[13px] text-text outline-none transition-colors placeholder:text-text-faint focus:border-brand-teal"
      />
      <Search
        size={15}
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-faint"
      />
    </div>
  );
}
