import type { ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import type { Severity } from '@/types/common';

export interface ResultRowProps {
  title: string;
  meta: string[];
  severity: Severity;
  /** Inline thumb (SVG sparkline / icon). */
  thumb: ReactNode;
}

const SEVERITY_BAR: Record<Severity, string> = {
  high: 'bg-danger shadow-[0_0_6px_#ef4444]',
  mid: 'bg-warning shadow-[0_0_6px_#f59e0b]',
  low: 'bg-success shadow-[0_0_6px_#10b981]',
};

export function ResultRow({ title, meta, severity, thumb }: ResultRowProps): JSX.Element {
  return (
    <div className="flex cursor-pointer gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-white/[0.03] [&+&]:rounded-none [&+&]:border-t [&+&]:border-border">
      <div className="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-md border border-border">
        {thumb}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 truncate text-[12.5px] font-medium text-text">{title}</div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10.5px] text-text-faint">
          {meta.map((chip) => (
            <span key={chip} className="inline-flex items-center gap-1">
              {chip}
            </span>
          ))}
        </div>
      </div>
      <div className={cn('w-[3px] self-stretch rounded-full', SEVERITY_BAR[severity])} />
    </div>
  );
}

/** Default Results card used by the right panel — wired to mock data for now. */
export function ResultsCard(): JSX.Element {
  const showToast = useUIStore((s) => s.showToast);
  return (
    <Card>
      <CardHeader>
        <CardTitle>תוצאות ניתוח</CardTitle>
        <button
          type="button"
          aria-label="רענן"
          title="רענן"
          onClick={() => showToast('רענון נתוני ניתוח...')}
          className="grid place-items-center text-text-faint transition-colors hover:text-brand-teal"
        >
          <RefreshCcw size={14} />
        </button>
      </CardHeader>

      <div className="-mx-1.5 flex max-h-[280px] flex-col overflow-y-auto px-1.5">
        <ResultRow
          title="צומת מסוכן — רחוב הרצל"
          meta={['תאונות: 12', 'היום']}
          severity="high"
          thumb={
            <svg viewBox="0 0 60 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <rect width="60" height="60" fill="#0a1424" />
              <path d="M0 30 L60 28" stroke="#f59e0b" strokeWidth="1.5" opacity="0.7" />
              <path d="M30 0 L28 60" stroke="#374151" strokeWidth="1" />
              <circle cx="30" cy="30" r="3" fill="#ef4444" />
              <circle cx="30" cy="30" r="8" fill="#ef4444" opacity="0.25" />
            </svg>
          }
        />
        <ResultRow
          title="קו 142 — חפיפת מסלולים"
          meta={['תדירות: 8 דק׳', 'אתמול']}
          severity="mid"
          thumb={
            <svg viewBox="0 0 60 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <rect width="60" height="60" fill="#0a1424" />
              <path d="M5 50 Q30 10 55 50" stroke="#10b981" strokeWidth="2" fill="none" />
              <circle cx="5" cy="50" r="2.5" fill="#10b981" />
              <circle cx="30" cy="22" r="2.5" fill="#10b981" />
              <circle cx="55" cy="50" r="2.5" fill="#10b981" />
            </svg>
          }
        />
        <ResultRow
          title="איילון — עומס תנועה חריג"
          meta={['ק״מ: 4.2', 'לפני 2 ימים']}
          severity="high"
          thumb={
            <svg viewBox="0 0 60 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <rect width="60" height="60" fill="#0a1424" />
              <path d="M0 20 L60 22" stroke="#f59e0b" strokeWidth="3" opacity="0.8" />
              <path d="M0 40 L60 38" stroke="#f59e0b" strokeWidth="2" opacity="0.5" />
              <path d="M20 0 L22 60" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
            </svg>
          }
        />
        <ResultRow
          title="תחנת רכבת — שדרוג נדרש"
          meta={['סטטוס: בתכנון', 'השבוע']}
          severity="low"
          thumb={
            <svg viewBox="0 0 60 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <rect width="60" height="60" fill="#0a1424" />
              <rect x="10" y="20" width="14" height="20" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
              <rect x="36" y="14" width="14" height="26" fill="none" stroke="#8b5cf6" strokeWidth="1.5" />
              <path d="M0 50 L60 50" stroke="#374151" strokeWidth="1" />
            </svg>
          }
        />
        <ResultRow
          title="אשכול תאונות — דרום ת״א"
          meta={['18 נקודות', 'לפני שבוע']}
          severity="mid"
          thumb={
            <svg viewBox="0 0 60 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <rect width="60" height="60" fill="#0a1424" />
              <circle cx="30" cy="30" r="3" fill="#ef4444" />
              <circle cx="15" cy="20" r="2" fill="#ef4444" opacity="0.7" />
              <circle cx="45" cy="40" r="2" fill="#ef4444" opacity="0.7" />
              <circle cx="20" cy="45" r="2" fill="#ef4444" opacity="0.5" />
            </svg>
          }
        />
      </div>
    </Card>
  );
}
