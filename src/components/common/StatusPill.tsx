import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StatusVariant = 'green' | 'yellow' | 'red';

export interface StatusPillProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  variant?: StatusVariant;
}

/**
 * Compact dot-and-label pill used in the header to show DB connection,
 * agent status, and data freshness.
 */
export function StatusPill({
  label,
  variant = 'green',
  className,
  ...props
}: StatusPillProps): JSX.Element {
  return (
    <div
      className={cn('flex items-center gap-1.5 text-xs text-text-dim', className)}
      {...props}
    >
      <span className={cn('status-dot', variant)} />
      <span>{label}</span>
    </div>
  );
}
