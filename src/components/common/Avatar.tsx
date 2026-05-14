import { cn } from '@/lib/utils';

export interface AvatarProps {
  initials: string;
  className?: string;
  /** Tooltip / accessible name. */
  label?: string;
}

export function Avatar({ initials, className, label }: AvatarProps): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label ?? initials}
      className={cn(
        'grid h-[34px] w-[34px] place-items-center rounded-full border border-border-2',
        'bg-gradient-to-br from-brand-green to-brand-blue text-xs font-semibold text-white',
        'cursor-pointer transition-transform hover:scale-105',
        className
      )}
    >
      {initials}
    </button>
  );
}
