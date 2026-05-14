import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { SortSpec, TableConfig } from '../types';

export interface SortControlsProps {
  config: TableConfig;
  sorts: SortSpec[];
  onChange: (next: SortSpec[]) => void;
}

/**
 * Compact "Sort" pill — clicking opens a popover that lets the user manage a
 * multi-column sort stack. Each entry has an explicit direction; entries can
 * be reordered or removed. "Reset" reverts to the table's default sort.
 */
export function SortControls({ config, sorts, onChange }: SortControlsProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const sortableColumns = config.columns.filter((c) => c.sortable ?? true);
  const usedKeys = new Set(sorts.map((s) => s.key));
  const available = sortableColumns.filter((c) => !usedKeys.has(c.key));

  return (
    <div ref={popoverRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'gap-2 border-dashed',
          sorts.length > 0 && 'border-brand-teal/50 bg-brand-teal/5 text-brand-teal'
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ArrowDownAZ size={14} />
        <span>מיון מתקדם</span>
        {sorts.length > 0 && (
          <span className="rounded-full bg-brand-teal/20 px-1.5 py-px font-mono text-[10px]">
            {sorts.length}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="הגדרת מיון מתקדם"
          className="absolute end-0 top-full z-30 mt-1.5 w-[340px] animate-fadein rounded-md border border-border bg-surface p-3 shadow-card"
        >
          <header className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-semibold text-text">מיון מתקדם</div>
              <div className="text-[10.5px] text-text-faint">
                סדרו עמודות מיון לפי עדיפות. ניתן גם להחזיק Shift+לחיצה על כותרת.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור"
              className="grid h-6 w-6 place-items-center rounded text-text-faint transition-colors hover:bg-white/[0.06] hover:text-text"
            >
              <X size={13} />
            </button>
          </header>

          {sorts.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-bg-1 px-3 py-3 text-center text-[11.5px] text-text-faint">
              אין מיון מותאם — התוצאות מסודרות לפי ברירת המחדל של הטבלה.
            </div>
          )}

          <ul className="flex flex-col gap-1.5">
            {sorts.map((spec, idx) => {
              const column = sortableColumns.find((c) => c.key === spec.key);
              const label = column?.label ?? spec.key;
              return (
                <li
                  key={spec.key}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-bg-1 px-2 py-1.5"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-brand-teal/15 font-mono text-[10px] text-brand-teal">
                    {idx + 1}
                  </span>
                  <span className="flex-1 truncate text-[12.5px] text-text">{label}</span>

                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        sorts.map((s, i) =>
                          i === idx ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s
                        )
                      )
                    }
                    title={spec.dir === 'asc' ? 'עולה' : 'יורד'}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded border border-border px-1.5 text-[11px] transition-colors',
                      'hover:border-brand-teal/50 hover:text-brand-teal'
                    )}
                  >
                    {spec.dir === 'asc' ? (
                      <>
                        <ArrowUp size={11} />
                        עולה
                      </>
                    ) : (
                      <>
                        <ArrowDown size={11} />
                        יורד
                      </>
                    )}
                  </button>

                  <SortMoveBtn
                    icon={ChevronUp}
                    label="העלה עדיפות"
                    disabled={idx === 0}
                    onClick={() => onChange(swap(sorts, idx, idx - 1))}
                  />
                  <SortMoveBtn
                    icon={ChevronDown}
                    label="הורד עדיפות"
                    disabled={idx === sorts.length - 1}
                    onClick={() => onChange(swap(sorts, idx, idx + 1))}
                  />
                  <SortMoveBtn
                    icon={Trash2}
                    label="הסר ממיון"
                    onClick={() => onChange(sorts.filter((_, i) => i !== idx))}
                    tone="danger"
                  />
                </li>
              );
            })}
          </ul>

          {available.length > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint">
                הוסף עמודה למיון
              </div>
              <div className="flex flex-wrap gap-1.5">
                {available.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => onChange([...sorts, { key: col.key, dir: 'asc' }])}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-1 px-2 py-0.5 text-[11px] text-text-dim transition-colors hover:border-brand-teal/50 hover:text-brand-teal"
                  >
                    <Plus size={11} />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={sorts.length === 0}
              className="inline-flex items-center gap-1 text-[11.5px] text-text-faint transition-colors hover:text-text disabled:opacity-50"
            >
              <RotateCcw size={11} />
              איפוס לברירת המחדל
            </button>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-text-faint">
              <ArrowUpAZ size={11} />
              סדר עדיפות
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}

interface SortMoveBtnProps {
  icon: typeof ChevronUp;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

function SortMoveBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: SortMoveBtnProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-6 w-6 place-items-center rounded text-text-faint transition-colors',
        'hover:bg-white/[0.06] hover:text-text',
        tone === 'danger' && 'hover:text-danger',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-faint'
      )}
    >
      <Icon size={12} />
    </button>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = arr.slice();
  const itemA = next[a];
  const itemB = next[b];
  if (itemA === undefined || itemB === undefined) return arr;
  next[a] = itemB;
  next[b] = itemA;
  return next;
}
