import { Upload, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUploadStore, type PolygonInputMode } from '@/stores/uploadStore';

const OPTIONS: { value: PolygonInputMode; label: string; icon: typeof Upload }[] = [
  { value: 'upload', label: 'העלאת קובץ', icon: Upload },
  { value: 'draw', label: 'ציור על המפה', icon: Pencil },
];

/**
 * Two-segment switch that lives at the top of the "שלב 1" card. Picks which
 * sub-UI the panel exposes (dropzone vs. draw-helper) and toggles geoman on
 * the active Leaflet map via `useUploadStore`.
 *
 * Disabled while a polygon is in-flight (parsing / drawing) so the user can't
 * yank the pipeline out from under whatever is mid-flight.
 */
export function InputModeToggle(): JSX.Element {
  const inputMode = useUploadStore((s) => s.inputMode);
  const setInputMode = useUploadStore((s) => s.setInputMode);
  const status = useUploadStore((s) => s.status);

  // We *don't* lock the toggle while drawing — it acts as an explicit "cancel
  // and switch" instead, mirroring the in-canvas overlay's cancel button.
  const isLocked = status === 'parsing';

  return (
    <div
      role="tablist"
      aria-label="מצב פוליגון"
      className="mb-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-bg-1 p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = inputMode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isLocked && !isActive}
            onClick={() => setInputMode(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-[11.5px] font-medium transition-all',
              isActive
                ? 'bg-gradient-to-br from-brand-teal to-brand-teal2 text-[#04150c] shadow-[0_2px_10px_rgba(76,201,192,0.35)]'
                : 'text-text-dim hover:bg-white/[0.04] hover:text-text',
              isLocked && !isActive && 'cursor-not-allowed opacity-40'
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
