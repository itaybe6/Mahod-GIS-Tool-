import { Layers, Contrast, Info } from 'lucide-react';

export interface MapLegendProps {
  /** Date range label, e.g. "01.04.2025 — 10.05.2025". */
  dateRange: string;
  title: string;
}

/**
 * Floating, glass-style info card pinned to the bottom-right of the map.
 * Currently a presentational widget; will accept dynamic gradients & bucket
 * counts once heatmap data is wired in.
 */
export function MapLegend({ dateRange, title }: MapLegendProps): JSX.Element {
  return (
    <div className="absolute bottom-4 end-4 z-[400] w-[280px] rounded-md border border-white/[0.08] bg-bg-2/80 p-4 shadow-[0_10px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between">
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
      <div className="my-1 text-[14px] font-medium text-text">{title}</div>
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
    </div>
  );
}
