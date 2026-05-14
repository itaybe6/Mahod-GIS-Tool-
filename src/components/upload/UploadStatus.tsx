import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, MapPin, Trash2 } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';
import { useUIStore } from '@/stores/uiStore';

/**
 * Status card that replaces the dropzone while a file is being parsed or after
 * a successful / failed upload. Clears back to the empty dropzone when the user
 * removes the polygon.
 */
export function UploadStatus(): JSX.Element | null {
  const status = useUploadStore((s) => s.status);
  const sourceName = useUploadStore((s) => s.sourceName);
  const featureCount = useUploadStore((s) => s.featureCount);
  const bbox = useUploadStore((s) => s.bbox);
  const reprojectedFrom = useUploadStore((s) => s.reprojectedFrom);
  const error = useUploadStore((s) => s.error);
  const municipalitiesStatus = useUploadStore((s) => s.municipalitiesStatus);
  const municipalities = useUploadStore((s) => s.municipalities);
  const municipalitiesError = useUploadStore((s) => s.municipalitiesError);
  const clear = useUploadStore((s) => s.clear);
  const showToast = useUIStore((s) => s.showToast);

  const bboxLabel = useMemo(() => {
    if (!bbox) return null;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    return `[${minLng.toFixed(3)}, ${minLat.toFixed(3)}] → [${maxLng.toFixed(3)}, ${maxLat.toFixed(3)}]`;
  }, [bbox]);

  if (status === 'idle') return null;

  return (
    <div
      className={[
        'flex flex-col gap-1.5 rounded-md border px-3 py-2 text-[12px]',
        status === 'ready' && 'border-brand-teal/40 bg-brand-teal/10 text-text',
        status === 'parsing' && 'border-border bg-bg-1 text-text-dim',
        status === 'error' && 'border-red-500/40 bg-red-500/10 text-red-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {status === 'parsing' && <Loader2 size={14} className="shrink-0 animate-spin" />}
          {status === 'ready' && (
            <CheckCircle2 size={14} className="shrink-0 text-brand-teal" />
          )}
          {status === 'error' && (
            <AlertTriangle size={14} className="shrink-0 text-red-400" />
          )}
          <span className="truncate font-medium">{sourceName ?? 'ללא שם'}</span>
        </div>
        {(status === 'ready' || status === 'error') && (
          <button
            type="button"
            onClick={() => {
              clear();
              showToast('הפוליגון הוסר מהמפה');
            }}
            title="הסר את הפוליגון"
            aria-label="הסר את הפוליגון"
            className="grid place-items-center rounded p-1 text-text-faint transition-colors hover:bg-bg-2 hover:text-red-300"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {status === 'ready' && (
        <div className="flex flex-col gap-0.5 font-mono text-[10.5px] text-text-dim">
          <span>
            {featureCount} פיצ'רים · WGS84
            {reprojectedFrom && ` (הומר מ-${reprojectedFrom})`}
          </span>
          {bboxLabel && <span className="truncate" title={bboxLabel}>bbox {bboxLabel}</span>}
        </div>
      )}

      {status === 'ready' && (
        <MunicipalityLine
          lookupStatus={municipalitiesStatus}
          hits={municipalities}
          error={municipalitiesError}
        />
      )}

      {status === 'error' && error && (
        <div className="text-[11.5px] leading-snug text-red-200">{error}</div>
      )}
    </div>
  );
}

interface MunicipalityLineProps {
  lookupStatus: ReturnType<typeof useUploadStore.getState>['municipalitiesStatus'];
  hits: ReturnType<typeof useUploadStore.getState>['municipalities'];
  error: string | null;
}

function MunicipalityLine({
  lookupStatus,
  hits,
  error,
}: MunicipalityLineProps): JSX.Element | null {
  if (lookupStatus === 'idle') return null;

  if (lookupStatus === 'loading') {
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
        <Loader2 size={12} className="animate-spin" />
        <span>מאתר עיר…</span>
      </div>
    );
  }

  if (lookupStatus === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 text-[11.5px] text-amber-300"
        title={error ?? undefined}
      >
        <AlertTriangle size={12} />
        <span>לא הצלחנו לזהות את העיר</span>
      </div>
    );
  }

  if (!hits || hits.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
        <MapPin size={12} />
        <span>הפוליגון רחוק מכל רשות מוניציפלית בטבלה</span>
      </div>
    );
  }

  const primary = hits[0]!;
  const others = hits.slice(1);

  if (primary.is_nearest) {
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-text">
        <MapPin size={12} className="shrink-0 text-amber-300" />
        <span className="truncate">
          לא בתוך עיר — הקרובה ביותר:{' '}
          <span className="font-semibold">{primary.name_he}</span>{' '}
          <span className="text-text-dim">({formatDistance(primary.distance_m)})</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 text-[11.5px]">
      <div className="flex items-center gap-1.5 text-text">
        <MapPin size={12} className="shrink-0 text-brand-teal" />
        <span className="truncate">
          ממוקם ב<span className="font-semibold">{primary.name_he}</span>
          {primary.overlap_pct != null && others.length === 0 && primary.overlap_pct < 99
            ? ` (${primary.overlap_pct}%)`
            : ''}
        </span>
      </div>
      {others.length > 0 && (
        <div
          className="truncate ps-[18px] text-[10.5px] text-text-dim"
          title={others
            .map((m) => `${m.name_he}${m.overlap_pct != null ? ` ${m.overlap_pct}%` : ''}`)
            .join(' · ')}
        >
          + {others.length === 1 ? 'רשות נוספת' : `${others.length} רשויות נוספות`}:{' '}
          {others
            .map((m) =>
              m.overlap_pct != null ? `${m.name_he} ${m.overlap_pct}%` : m.name_he
            )
            .join(' · ')}
        </div>
      )}
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}
