import { useState } from 'react';
import { Layers, Contrast, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapLegendProps {
  /** Date range label, e.g. "01.04.2025 — 10.05.2025". */
  dateRange: string;
  title: string;
  /** When true, hides the severity gradient bar and its labels. */
  hideSeverityBar?: boolean;
}

/**
 * Floating, glass-style info card pinned to the bottom-end of the map.
 * On phones it starts collapsed (just a tappable chip) so it doesn't cover
 * the map; tapping the chip expands the full legend card.
 */
export function MapLegend({ dateRange, title, hideSeverityBar }: MapLegendProps): JSX.Element {
  const [expandedOnMobile, setExpandedOnMobile] = useState(false);

  return (
    <div
      className={cn(
        'absolute bottom-3 end-3 z-[400] rounded-md border border-white/[0.08] bg-bg-2/85 shadow-[0_10px_32px_rgba(0,0,0,0.5)] backdrop-blur-md sm:bottom-4 sm:end-4',
        // On <sm: chip when collapsed, full card when expanded.
        expandedOnMobile ? 'w-[min(86vw,280px)] p-3' : 'w-auto px-2.5 py-1.5 sm:p-4',
        // From sm and up: always full card.
        'sm:w-[280px] sm:p-4'
      )}
    >
      <button
        type="button"
        onClick={() => setExpandedOnMobile((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 text-text-dim sm:hidden',
          expandedOnMobile && 'mb-2'
        )}
        aria-expanded={expandedOnMobile}
        aria-label={expandedOnMobile ? 'מזער מקרא' : 'הצג מקרא'}
      >
        <span className="font-mono text-[11px]">{expandedOnMobile ? dateRange : 'מקרא'}</span>
        {expandedOnMobile ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      <div
        className={cn(
          'mb-2 hidden items-center justify-between sm:flex',
          expandedOnMobile && '!flex'
        )}
      >
        <span className="font-mono text-[11px] text-text-dim">{dateRange}</span>
        <div className="flex gap-1.5 text-text-faint">
          <button type="button" title="שכבות" aria-label="שכבות" className="hover:text-brand-teal">
            <Layers size={14} />
          </button>
          <button
            type="button"
            title="ניגודיות"
            aria-label="ניגודיות"
            className="hover:text-brand-teal"
          >
            <Contrast size={14} />
          </button>
          <button type="button" title="פרטים" aria-label="פרטים" className="hover:text-brand-teal">
            <Info size={14} />
          </button>
        </div>
      </div>

      <div className={cn('hidden sm:block', expandedOnMobile && '!block')}>
        <div className="my-1 text-[13px] font-medium text-text sm:text-[14px]">{title}</div>
        {!hideSeverityBar && (
          <>
            <div className="mb-1.5 grid h-1.5 grid-cols-4 overflow-hidden rounded-[3px]">
              <div className="bg-success" />
              <div className="bg-warning" />
              <div className="bg-[#f97316]" />
              <div className="bg-danger" />
            </div>
            <div className="grid grid-cols-4 text-center text-[10.5px] text-text-dim">
              <span>נמוך</span>
              <span>בינוני</span>
              <span>גבוה</span>
              <span>קריטי</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
