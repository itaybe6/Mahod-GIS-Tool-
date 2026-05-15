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
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] 2xl:gap-3">
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
        'group relative flex w-full animate-fadein flex-col items-start gap-2.5 overflow-hidden rounded-xl border bg-surface p-3 text-start transition-all sm:min-h-[140px] sm:gap-3 sm:p-5',
        active
          ? 'border-brand-teal/50 bg-brand-teal/5 shadow-[0_0_0_1px_rgba(46,170,111,0.4),0_10px_28px_rgba(46,170,111,0.14)]'
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
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors sm:h-10 sm:w-10',
            active
              ? 'bg-brand-teal/15 text-brand-teal'
              : 'bg-bg-1 text-text-dim group-hover:text-brand-teal'
          )}
        >
          <Icon size={18} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>
        {isLoadingCount && count == null ? (
          <span className="block h-4 w-12 animate-pulse rounded bg-white/[0.05]" />
        ) : (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 font-mono text-[11px] sm:px-2.5 sm:text-[12px]',
              active
                ? 'border-brand-teal/40 bg-brand-teal/10 text-brand-teal'
                : 'border-border bg-bg-1 text-text-dim'
            )}
            title={count != null ? `${formatCount(count)} רשומות` : undefined}
          >
            {count != null ? formatCount(count) : '—'}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold leading-tight text-text sm:text-[17px]">
          {config.label}
        </div>
        {config.description && (
          <div className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-relaxed text-text-dim/95 sm:line-clamp-3 sm:text-[13.5px]">
            {config.description}
          </div>
        )}
      </div>
    </button>
  );
}
