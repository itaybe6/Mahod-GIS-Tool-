import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SectionShell({
  icon: Icon,
  title,
  eyebrow,
  children,
  className,
  isLoading,
  error,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
  error?: unknown;
}): JSX.Element {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-surface/90 p-4 shadow-card ring-1 ring-white/[0.03]',
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-brand-teal/25 bg-brand-teal/10 text-brand-teal shadow-[0_0_18px_rgba(46,170,111,0.12)]">
            <Icon size={18} />
          </span>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[1.5px] text-text-faint">
              {eyebrow}
            </div>
            <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          </div>
        </div>
        {isLoading && <Loader2 size={16} className="animate-spin text-brand-teal" />}
      </div>

      {error ? (
        <div className="rounded-md border border-danger/25 bg-danger/10 p-3 text-[12px] leading-6 text-danger">
          {error instanceof Error ? error.message : 'טעינת הנתונים נכשלה'}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-bg-1 p-4 text-center text-[12px] leading-6 text-text-faint">
      {children}
    </div>
  );
}
