import { Pencil, MousePointer2, Move, Trash2 } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * Right-rail content shown when the user picked "ציור על המפה". It mirrors
 * `useUploadStore.drawingPhase`:
 *   - `idle`      → step-by-step instructions before the first click
 *   - `drawing`   → live status while the user is laying down vertices
 *   - `editing`   → controls for tweaking / clearing the finished polygon
 *
 * All actual drawing happens via `PolygonDrawController` on the map.
 */
export function DrawHelper(): JSX.Element {
  const drawingPhase = useUploadStore((s) => s.drawingPhase);
  const polygon = useUploadStore((s) => s.polygon);
  const clear = useUploadStore((s) => s.clear);
  const showToast = useUIStore((s) => s.showToast);

  if (drawingPhase === 'editing' && polygon) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-brand-teal/40 bg-brand-teal/10 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-teal">
          <span className="status-dot green inline-block" />
          הפוליגון מוכן · ניתן לערוך אותו
        </div>
        <ul className="flex flex-col gap-1 text-[11px] text-text-dim">
          <Tip icon={<MousePointer2 size={11} />}>גרור נקודות פינה כדי לשנות את הצורה</Tip>
          <Tip icon={<Move size={11} />}>גרור את גוף הפוליגון כדי להזיז אותו</Tip>
          <Tip icon={<Pencil size={11} />}>לחץ באמצע צלע כדי להוסיף נקודה חדשה</Tip>
        </ul>
        <button
          type="button"
          onClick={() => {
            clear();
            showToast('הפוליגון נמחק — אפשר לצייר מחדש');
          }}
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-red-500/30 bg-red-500/5 px-2 py-1.5 text-[11.5px] font-medium text-red-200 transition-colors hover:border-red-400 hover:bg-red-500/15 hover:text-red-100"
        >
          <Trash2 size={12} />
          נקה ופצח מחדש
        </button>
      </div>
    );
  }

  if (drawingPhase === 'drawing') {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-brand-teal/40 bg-brand-teal/10 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-teal">
          <span className="status-dot green inline-block" />
          ציור פעיל
        </div>
        <p className="text-[11px] leading-relaxed text-text-dim">
          לחץ על המפה להוספת נקודות. סיים בלחיצה כפולה או לחיצה על הנקודה הראשונה.
        </p>
      </div>
    );
  }

  return (
    <div
      className={[
        'flex flex-col items-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-brand-teal/35 px-3 py-4 text-center',
        'bg-[radial-gradient(circle_at_50%_0%,rgba(76,201,192,0.10),transparent_70%)]',
      ].join(' ')}
    >
      <div className="grid h-[42px] w-[42px] place-items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
        <Pencil size={18} />
      </div>
      <div className="text-[13px] font-medium text-text">לחץ על המפה כדי להתחיל לצייר</div>
      <div className="font-mono text-[10.5px] leading-snug text-text-faint">
        לחיצה = הוספת נקודה · לחיצה כפולה = סיום
      </div>
    </div>
  );
}

interface TipProps {
  icon: JSX.Element;
  children: React.ReactNode;
}

function Tip({ icon, children }: TipProps): JSX.Element {
  return (
    <li className="flex items-center gap-1.5">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-bg-1/60 text-brand-teal">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
