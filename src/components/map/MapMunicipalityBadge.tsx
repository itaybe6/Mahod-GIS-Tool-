import { MapPin, AlertTriangle, Loader2, Compass } from 'lucide-react';
import { useUploadStore } from '@/stores/uploadStore';

/**
 * Big floating chip pinned to the top of the map that surfaces the result
 * of `find_municipalities_for_polygon`. Three visual states:
 *   - loading  : muted glass pill with a spinner.
 *   - inside   : teal-glow chip with the primary city, percent + secondary
 *                cities aggregated as a small subtitle.
 *   - nearest  : amber-glow chip with the nearest city + distance.
 *
 * Renders nothing when there's no polygon (idle) or the user hasn't kicked
 * off a lookup yet.
 */
export function MapMunicipalityBadge(): JSX.Element | null {
  const polygon = useUploadStore((s) => s.polygon);
  const lookupStatus = useUploadStore((s) => s.municipalitiesStatus);
  const hits = useUploadStore((s) => s.municipalities);

  if (!polygon) return null;
  if (lookupStatus === 'idle') return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[450] flex justify-center px-4">
      <div className="pointer-events-auto animate-fadein">{renderInner(lookupStatus, hits)}</div>
    </div>
  );
}

function renderInner(
  lookupStatus: ReturnType<typeof useUploadStore.getState>['municipalitiesStatus'],
  hits: ReturnType<typeof useUploadStore.getState>['municipalities']
): JSX.Element {
  if (lookupStatus === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-bg-2/85 px-4 py-2 text-text-dim shadow-card backdrop-blur-md">
        <Loader2 size={16} className="animate-spin text-brand-teal2" />
        <span className="text-[13px]">מאתר עיר…</span>
      </div>
    );
  }

  if (lookupStatus === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-amber-200 shadow-card backdrop-blur-md">
        <AlertTriangle size={16} />
        <span className="text-[13px]">שגיאה בזיהוי העיר</span>
      </div>
    );
  }

  if (!hits || hits.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-bg-2/85 px-4 py-2 text-text-dim shadow-card backdrop-blur-md">
        <Compass size={16} />
        <span className="text-[13px]">הפוליגון רחוק מכל רשות בטבלה</span>
      </div>
    );
  }

  const primary = hits[0]!;
  const others = hits.slice(1);

  if (primary.is_nearest) {
    return (
      <div className="relative max-w-full">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-transparent blur-2xl"
        />
        <div className="flex max-w-full items-center gap-2.5 rounded-2xl border border-amber-300/30 bg-bg-2/85 ps-3 pe-4 py-2 shadow-[0_10px_40px_rgba(245,158,11,0.18)] backdrop-blur-md sm:gap-3 sm:ps-4 sm:pe-5 sm:py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-200 sm:h-9 sm:w-9">
            <Compass size={16} className="sm:hidden" />
            <Compass size={18} className="hidden sm:block" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-amber-200/80 sm:text-[10.5px]">
              סמוך לעיר
            </span>
            <span className="truncate text-[16px] font-bold text-text sm:text-[20px]">
              {primary.name_he}
            </span>
            <span className="truncate text-[11px] text-text-dim sm:text-[11.5px]">
              במרחק {formatDistance(primary.distance_m)} מהפוליגון
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-full">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-brand-teal/30 via-brand-blue/20 to-transparent blur-2xl"
      />
      <div className="flex max-w-full items-center gap-2.5 rounded-2xl border border-brand-teal/30 bg-bg-2/85 ps-3 pe-4 py-2 shadow-glow backdrop-blur-md sm:gap-3 sm:ps-4 sm:pe-5 sm:py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-teal/20 text-brand-teal2 sm:h-9 sm:w-9">
          <MapPin size={16} className="sm:hidden" />
          <MapPin size={18} className="hidden sm:block" />
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-brand-teal2/90 sm:text-[10.5px]">
            הפוליגון נמצא ב
          </span>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[18px] font-bold text-text sm:text-[22px]">
              {primary.name_he}
            </span>
            {primary.overlap_pct != null && primary.overlap_pct < 99 && (
              <span className="shrink-0 text-[12px] text-brand-teal2">{primary.overlap_pct}%</span>
            )}
          </div>
          {others.length > 0 && (
            <span
              className="truncate text-[11px] text-text-dim sm:text-[11.5px]"
              title={others
                .map((m) =>
                  m.overlap_pct != null ? `${m.name_he} ${m.overlap_pct}%` : m.name_he
                )
                .join(' · ')}
            >
              + {others
                .slice(0, 3)
                .map((m) =>
                  m.overlap_pct != null ? `${m.name_he} ${m.overlap_pct}%` : m.name_he
                )
                .join(' · ')}
              {others.length > 3 ? ` · +${others.length - 3}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} מ׳`;
  return `${(meters / 1000).toFixed(1)} ק״מ`;
}
