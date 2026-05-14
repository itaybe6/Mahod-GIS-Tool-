import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatCount } from '../formatters';

export interface PaginationProps {
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isFetching?: boolean;
}

const DEFAULT_OPTIONS = [25, 50, 100, 250];

export function Pagination({
  page,
  pageSize,
  pageSizeOptions = DEFAULT_OPTIONS,
  totalCount,
  onPageChange,
  onPageSizeChange,
  isFetching,
}: PaginationProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = totalCount === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(totalCount, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-text-dim">
      <div className="flex items-center gap-3">
        <span>
          מציג <span className="font-mono text-text">{formatCount(start)}</span>–
          <span className="font-mono text-text">{formatCount(end)}</span> מתוך{' '}
          <span className="font-mono text-text">{formatCount(totalCount)}</span>
          {isFetching && <span className="ms-2 text-text-faint">— טוען…</span>}
        </span>

        <label className="flex items-center gap-2 text-[11.5px] text-text-faint">
          <span>שורות בעמוד</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              'h-7 cursor-pointer rounded border border-border bg-bg-1 px-2 text-[12px] text-text outline-none',
              'transition-colors hover:border-brand-teal/50 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20'
            )}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <PageBtn
          icon={ChevronsRight}
          label="לעמוד הראשון"
          disabled={safePage === 0}
          onClick={() => onPageChange(0)}
        />
        <PageBtn
          icon={ChevronRight}
          label="עמוד קודם"
          disabled={safePage === 0}
          onClick={() => onPageChange(Math.max(0, safePage - 1))}
        />

        <span className="px-2 font-mono text-[12px] text-text">
          {safePage + 1} / {totalPages}
        </span>

        <PageBtn
          icon={ChevronLeft}
          label="עמוד הבא"
          disabled={safePage >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
        />
        <PageBtn
          icon={ChevronsLeft}
          label="לעמוד האחרון"
          disabled={safePage >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
        />
      </div>
    </div>
  );
}

interface PageBtnProps {
  icon: typeof ChevronLeft;
  label: string;
  onClick: () => void;
  disabled: boolean;
}

function PageBtn({ icon: Icon, label, onClick, disabled }: PageBtnProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="icon"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="h-7 w-7"
    >
      <Icon size={14} />
    </Button>
  );
}
