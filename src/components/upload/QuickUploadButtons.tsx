import { useCallback, useRef, type ChangeEvent } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useShapefileUpload } from '@/hooks/useShapefileUpload';

interface QuickUploadEntry {
  id: 'zip' | 'gtfs' | 'accidents';
  icon: string;
  label: string;
  /** `accept` attribute applied to the hidden file input. */
  accept: string;
  multiple: boolean;
}

const QUICK_UPLOADS: QuickUploadEntry[] = [
  { id: 'zip', icon: '📦', label: 'ZIP מלא', accept: '.zip', multiple: false },
  { id: 'gtfs', icon: '🚌', label: 'GTFS', accept: '.zip,.txt', multiple: true },
  { id: 'accidents', icon: '⚠️', label: 'תאונות', accept: '.csv', multiple: false },
];

/**
 * 3-up quick-pick buttons. The "ZIP" path now feeds the same shapefile
 * pipeline as the dropzone (parses with shpjs and renders on the map).
 *
 * GTFS and Accidents are routed through the existing toast for now — they
 * belong to dedicated import flows wired up separately.
 */
export function QuickUploadButtons(): JSX.Element {
  const showToast = useUIStore((s) => s.showToast);
  const { ingestFiles } = useShapefileUpload();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeIdRef = useRef<QuickUploadEntry['id'] | null>(null);

  const openPicker = useCallback((entry: QuickUploadEntry) => {
    const input = inputRef.current;
    if (!input) return;
    activeIdRef.current = entry.id;
    input.accept = entry.accept;
    input.multiple = entry.multiple;
    input.click();
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const id = activeIdRef.current;
      activeIdRef.current = null;
      const files = e.target.files;
      e.target.value = '';
      if (!files || files.length === 0) return;

      if (id === 'zip') {
        void ingestFiles(files);
      } else {
        showToast(`ייבוא ${id === 'gtfs' ? 'GTFS' : 'תאונות'} עדיין לא מחובר.`);
      }
    },
    [ingestFiles, showToast]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
      />
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_UPLOADS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => openPicker(entry)}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg-2 px-1.5 py-2.5 text-[11.5px] text-text-dim transition-all hover:border-brand-teal hover:bg-brand-teal/10 hover:text-brand-teal"
          >
            <span className="text-base">{entry.icon}</span>
            {entry.label}
          </button>
        ))}
      </div>
    </>
  );
}
