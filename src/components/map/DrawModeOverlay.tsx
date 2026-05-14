import { Pencil, X, RotateCcw, MousePointer2, Move } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * In-canvas overlay that floats above the map while the user is in draw mode.
 * It mirrors `useUploadStore.drawingPhase`:
 *   - `drawing`  → bright primary banner with a "cancel" button
 *   - `editing`  → translucent reminder strip explaining drag / scale controls
 *   - everything else → the overlay renders nothing
 *
 * Rendered as a sibling of the Leaflet map (not inside it) so it can use
 * normal pointer events without fighting the map's drag handlers.
 */
export function DrawModeOverlay(): JSX.Element | null {
  const inputMode = useUploadStore((s) => s.inputMode);
  const drawingPhase = useUploadStore((s) => s.drawingPhase);
  const polygon = useUploadStore((s) => s.polygon);
  const setInputMode = useUploadStore((s) => s.setInputMode);
  const clear = useUploadStore((s) => s.clear);
  const showToast = useUIStore((s) => s.showToast);

  if (inputMode !== 'draw') return null;

  if (drawingPhase === 'drawing') {
    return (
      <Banner>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-teal/20 text-brand-teal">
            <Pencil size={14} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[12.5px] font-medium text-text">מצב ציור פעיל</span>
            <span className="text-[10.5px] text-text-dim">
              לחץ על המפה להוספת נקודות · לחיצה כפולה לסיום
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setInputMode('upload');
            showToast('הציור בוטל');
          }}
          className="ms-2 inline-flex items-center gap-1 rounded-md border border-border bg-bg-1/80 px-2 py-1 text-[11px] text-text-dim transition-colors hover:border-red-400/60 hover:text-red-200"
        >
          <X size={12} />
          ביטול
        </button>
      </Banner>
    );
  }

  if (drawingPhase === 'editing' && polygon) {
    return (
      <Banner subtle>
        <div className="flex items-center gap-3 text-[11px] text-text-dim">
          <Hint icon={<MousePointer2 size={12} />}>גרור פינה</Hint>
          <Hint icon={<Move size={12} />}>גרור גוף</Hint>
          <Hint icon={<Pencil size={12} />}>הוסף נקודה באמצע צלע</Hint>
        </div>
        <button
          type="button"
          onClick={() => {
            clear();
            showToast('הפוליגון נמחק — אפשר לצייר מחדש');
          }}
          className="ms-2 inline-flex items-center gap-1 rounded-md border border-border bg-bg-1/80 px-2 py-1 text-[11px] text-text-dim transition-colors hover:border-red-400/60 hover:text-red-200"
        >
          <RotateCcw size={12} />
          התחל מחדש
        </button>
      </Banner>
    );
  }

  return (
    <Banner subtle>
      <div className="flex items-center gap-2 text-[11.5px] text-text-dim">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-teal/15 text-brand-teal">
          <Pencil size={12} />
        </span>
        לחץ במקום כלשהו על המפה כדי להתחיל לצייר את הפוליגון
      </div>
    </Banner>
  );
}

interface BannerProps {
  children: React.ReactNode;
  subtle?: boolean;
}

function Banner({ children, subtle }: BannerProps): JSX.Element {
  return (
    <div
      className={[
        'pointer-events-auto absolute left-1/2 top-3 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-md',
        subtle
          ? 'border-border/80 bg-bg-2/85 shadow-[0_8px_22px_rgba(0,0,0,0.45)]'
          : 'border-brand-teal/40 bg-brand-teal/10 shadow-[0_10px_30px_rgba(76,201,192,0.18)]',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

interface HintProps {
  icon: JSX.Element;
  children: React.ReactNode;
}

function Hint({ icon, children }: HintProps): JSX.Element {
  return (
    <span className="flex items-center gap-1">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-bg-1/70 text-brand-teal">
        {icon}
      </span>
      {children}
    </span>
  );
}
