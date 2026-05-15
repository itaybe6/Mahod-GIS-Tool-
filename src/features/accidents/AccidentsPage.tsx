import { ExternalLink, Sparkles } from 'lucide-react';

const ACCID_TAZ_URL = 'https://data.gov.il/he/datasets/ministry_of_transport/accid_taz';

/**
 * Not mounted in the main router today (`/accidents` redirects to statistics).
 * Kept for clarity and possible future split of the accidents UI from the stats dashboard.
 */
export function AccidentsPage(): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-6" dir="rtl">
      <div className="max-w-lg animate-fadein rounded-md border border-border bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
          <Sparkles size={22} />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-text">תאונות דרכים</h2>
        <p className="text-sm leading-relaxed text-text-dim">
          במערכת נטענת אגרגציה לפי תאי TAZ מתוך מערך{' '}
          <span className="font-mono text-[11px] text-text">accid_taz</span> של משרד התחבורה ב־data.gov.il — לא
          נקודות LMS בודדות. סטטיסטיקות וגרפים זמינים תחת &quot;סטטיסטיקות&quot; בניווט.
        </p>
        <p className="mt-4">
          <a
            href={ACCID_TAZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal hover:underline"
          >
            עמוד המקור — accid_taz
            <ExternalLink size={14} className="opacity-80" aria-hidden />
          </a>
        </p>
      </div>
    </div>
  );
}
