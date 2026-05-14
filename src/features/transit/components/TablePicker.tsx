import { cn } from '@/lib/utils';

import { formatCount } from '../formatters';
import type { TableConfig } from '../types';

export interface TablePickerProps {
  tables: TableConfig[];
  active: string;
  onSelect: (tableName: string) => void;
  counts: Map<string, number>;
  isLoadingCounts: boolean;
}

export function TablePicker({
  tables,
  active,
  onSelect,
  counts,
  isLoadingCounts,
}: TablePickerProps): JSX.Element {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {tables.map((config) => (
        <TablePickerItem
          key={config.name}
          config={config}
          active={config.name === active}
          count={counts.get(config.name) ?? null}
          isLoadingCount={isLoadingCounts}
          onClick={() => onSelect(config.name)}
        />
      ))}
    </div>
  );
}

interface TablePickerItemProps {
  config: TableConfig;
  active: boolean;
  count: number | null;
  isLoadingCount: boolean;
  onClick: () => void;
}

function TablePickerItem({
  config,
  active,
  count,
  isLoadingCount,
  onClick,
}: TablePickerItemProps): JSX.Element {
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      title={config.description}
      aria-pressed={active}
      className={cn(
        'group relative flex animate-fadein flex-col items-start gap-2 overflow-hidden rounded-md border bg-surface p-3 text-start transition-all',
        active
          ? 'border-brand-teal/50 bg-brand-teal/5 shadow-[0_0_0_1px_rgba(46,170,111,0.4),0_8px_24px_rgba(46,170,111,0.12)]'
          : 'border-border hover:-translate-y-px hover:border-brand-teal/30'
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-l from-brand-teal2 via-brand-teal to-brand-blue"
        />
      )}

      <div className="flex w-full items-center justify-between gap-2">
        <div
          className={cn(
            'grid h-8 w-8 place-items-center rounded-md transition-colors',
            active
              ? 'bg-brand-teal/15 text-brand-teal'
              : 'bg-bg-1 text-text-dim group-hover:text-brand-teal'
          )}
        >
          <Icon size={16} />
        </div>
        {isLoadingCount && count == null ? (
          <span className="block h-4 w-10 animate-pulse rounded bg-white/[0.05]" />
        ) : (
          <span
            className={cn(
              'rounded-full border px-1.5 py-0.5 font-mono text-[10.5px]',
              active
                ? 'border-brand-teal/40 bg-brand-teal/10 text-brand-teal'
                : 'border-border bg-bg-1 text-text-faint'
            )}
            title={count != null ? `${formatCount(count)} רשומות` : undefined}
          >
            {count != null ? formatCount(count) : '—'}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <div className={cn('truncate text-[13px] font-semibold', active ? 'text-text' : 'text-text')}>
          {config.label}
        </div>
        {config.description && (
          <div className="line-clamp-2 text-[11px] leading-snug text-text-faint">
            {config.description}
          </div>
        )}
      </div>
    </button>
  );
}
