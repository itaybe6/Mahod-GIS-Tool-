import { AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { DangerRankingTable } from './components/danger-ranking-table';
import { DemographicCharts } from './components/demographic-charts';
import { HotspotsSection } from './components/hotspots-section';
import { InsightsCards } from './components/insights-cards';
import { KpiCards } from './components/kpi-cards';
import { LandUseSection } from './components/land-use-section';

export function StatisticsPage(): JSX.Element {
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-bg-1 p-6" dir="rtl">
        <div className="max-w-md rounded-lg border border-warning/30 bg-warning/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-warning" size={26} />
          <h2 className="mb-1 text-base font-semibold text-text">Supabase לא מוגדר</h2>
          <p className="text-sm leading-relaxed text-text-dim">
            כדי לטעון את סטטיסטיקות התאונות צריך להגדיר `VITE_SUPABASE_URL` ו־
            `VITE_SUPABASE_ANON_KEY` בקובץ הסביבה.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-0 flex-1 overflow-y-auto bg-bg-1">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(26,111,181,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(46,170,111,0.14),transparent_30%)]" />
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:p-5">
        <header className="overflow-hidden rounded-lg border border-border bg-surface p-4 shadow-card ring-1 ring-white/[0.03] sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-teal/25 bg-brand-teal/10 px-3 py-1 text-[11px] font-semibold text-brand-teal">
                <Sparkles size={13} />
                מערכת סטטיסטיקות תאונות מתקדמת
              </div>
              <h1 className="text-[20px] font-bold leading-tight tracking-tight text-text sm:text-2xl md:text-[32px]">
                ניתוח סיכוני תאונות לפי אזורים סטטיסטיים
              </h1>
              <p className="mt-2 max-w-2xl text-[12.5px] leading-6 text-text-dim sm:text-[13px]">
                כל הנתונים מחושבים מ־<span className="font-mono text-[12px] text-text">public.accidents</span> דרך
                views ו־RPC ב־Supabase. הטבלה מייצגת אגרגציה לפי תאי TAZ (מערך{' '}
                <span className="font-mono text-[12px] text-text">accid_taz</span>
                ), לא נקודות תאונה בודדות.
              </p>
              <p className="mt-3">
                <a
                  href="https://data.gov.il/he/datasets/ministry_of_transport/accid_taz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-teal hover:underline sm:text-[13px]"
                >
                  מקור הנתונים ב־data.gov.il — accid_taz
                  <ExternalLink size={14} className="opacity-80" aria-hidden />
                </a>
              </p>
            </div>
          </div>
        </header>

        <KpiCards />
        <DangerRankingTable />
        <HotspotsSection />
        <DemographicCharts />
        <LandUseSection />
        <InsightsCards />
      </div>
    </div>
  );
}
