import { Sparkles } from 'lucide-react';

export interface ComingSoonProps {
  title: string;
  description?: string;
}

/**
 * Placeholder used by feature pages that aren't wired to live data yet.
 * Shared across accidents / transit / infrastructure / history routes.
 */
export function ComingSoon({ title, description }: ComingSoonProps): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-6">
      <div className="max-w-md animate-fadein rounded-md border border-border bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
          <Sparkles size={22} />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-text">{title}</h2>
        <p className="text-sm leading-relaxed text-text-dim">
          {description ?? 'הדף הזה ממתין לחיבור מקורות הנתונים. נעדכן ברגע שהסכימה ב-Supabase תאושר.'}
        </p>
        <p className="mt-4 font-mono text-[11px] text-text-faint">בקרוב — Coming soon</p>
      </div>
    </div>
  );
}
