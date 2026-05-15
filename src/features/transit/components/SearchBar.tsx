import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchBarProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  isFetching?: boolean;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  isFetching,
  className,
}: SearchBarProps): JSX.Element {
  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      <Search
        size={15}
        aria-hidden
        className={cn(
          'pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 transition-opacity',
          isFetching ? 'animate-pulse text-brand-teal' : 'text-text-faint'
        )}
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'חיפוש בכל העמודות (שם, מס׳, תאריך…)'}
        className="pe-10 ps-9"
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="נקה חיפוש"
          title="נקה חיפוש"
          className="absolute start-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-text-faint transition-colors hover:bg-white/[0.06] hover:text-text"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
