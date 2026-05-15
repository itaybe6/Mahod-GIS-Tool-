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
        'rounded-lg border border-border bg-surface/90 p-3 shadow-card ring-1 ring-white/[0.03] sm:p-4',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-brand-teal/25 bg-brand-teal/10 text-brand-teal shadow-[0_0_18px_rgba(46,170,111,0.12)]">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[1.4px] text-text-faint sm:text-[10.5px] sm:tracking-[1.5px]">
              {eyebrow}
            </div>
            <h2 className="truncate text-[14px] font-semibold text-text sm:text-[15px]">
              {title}
            </h2>
          </div>
        </div>
        {isLoading && <Loader2 size={16} className="shrink-0 animate-spin text-brand-teal" />}
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
