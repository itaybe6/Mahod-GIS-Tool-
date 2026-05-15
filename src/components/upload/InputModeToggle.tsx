import { Upload, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadStore, type PolygonInputMode } from '@/stores/uploadStore';
import { useMapStore } from '@/stores/mapStore';
import { useUIStore } from '@/stores/uiStore';

const OPTIONS: { value: PolygonInputMode; label: string; icon: typeof Upload }[] = [
  { value: 'upload', label: 'העלאת קובץ', icon: Upload },
  { value: 'draw', label: 'ציור על המפה', icon: Pencil },
];

/**
 * Two-segment switch that lives at the top of the "שלב 1" card. Picks which
 * sub-UI the panel exposes (dropzone vs. draw-helper) and toggles geoman on
 * the active Leaflet map via `useUploadStore`.
 *
 * Disabled while a polygon is in-flight (parsing) so the user can't yank the
 * pipeline mid-parse. "ציור על המפה" is also disabled in 3D (`mapbox3d`) because
 * Geoman runs only on the Leaflet map.
 */
export function InputModeToggle(): JSX.Element {
  const inputMode = useUploadStore((s) => s.inputMode);
  const setInputMode = useUploadStore((s) => s.setInputMode);
  const status = useUploadStore((s) => s.status);
  const mapType = useMapStore((s) => s.mapType);
  const setMobileRightPanelOpen = useUIStore((s) => s.setMobileRightPanelOpen);
  const is3D = mapType === 'mapbox3d';

  // We *don't* lock the toggle while drawing — it acts as an explicit "cancel
  // and switch" instead, mirroring the in-canvas overlay's cancel button.
  const isLocked = status === 'parsing';

  const handleSelect = (value: PolygonInputMode): void => {
    setInputMode(value);
    // Drawing requires interacting with the map directly, so close the
    // mobile sheet to expose it.
    if (value === 'draw') setMobileRightPanelOpen(false);
  };

  return (
    <div
      role="tablist"
      aria-label="מצב פוליגון"
      className="mb-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-bg-1 p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = inputMode === value;
        const drawBlockedIn3D = value === 'draw' && is3D;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={
              drawBlockedIn3D
                ? 'במצב תלת־מימדי אפשר להגדיר תיחום רק בהעלאת קובץ. החלף למפה דו־ממדית כדי לצייר.'
                : undefined
            }
            disabled={(isLocked && !isActive) || drawBlockedIn3D}
            onClick={() => handleSelect(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11.5px] font-medium transition-all',
              isActive
                ? 'bg-gradient-to-br from-brand-teal to-brand-teal2 text-[#04150c] shadow-[0_2px_10px_rgba(76,201,192,0.35)]'
                : 'text-text-dim hover:bg-white/[0.04] hover:text-text',
              (isLocked && !isActive) || drawBlockedIn3D ? 'cursor-not-allowed opacity-40' : ''
            )}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
