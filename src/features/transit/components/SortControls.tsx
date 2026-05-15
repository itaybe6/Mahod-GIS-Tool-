import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  ChevronDown,
  ChevronUp,
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
  const sortableKeys = new Set(sortableColumns.map((c) => c.key));
  const activeSorts = sorts.filter((s) => sortableKeys.has(s.key));
  const usedKeys = new Set(activeSorts.map((s) => s.key));
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
        title={`מיון מתקדם עבור ${config.label}`}
      >
        <ArrowDownAZ size={14} />
        <span>מיון מתקדם</span>
        {activeSorts.length > 0 && (
          <span className="rounded-full bg-brand-teal/20 px-1.5 py-px font-mono text-[10px]">
            {activeSorts.length}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="הגדרת מיון מתקדם"
          className="fixed inset-x-3 top-1/2 z-50 max-h-[80dvh] -translate-y-1/2 animate-fadein overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-card sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:z-30 sm:mt-1.5 sm:max-h-none sm:w-[400px] sm:translate-y-0 sm:overflow-visible"
        >
          <header className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[14.5px] font-semibold text-text">מיון מתקדם</div>
              <div className="text-[12px] font-medium text-text-dim/95">
                שדות מיון עבור <span className="text-brand-teal">{config.label}</span>. ניתן גם להחזיק Shift+לחיצה על כותרת.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור"
              className="grid h-7 w-7 place-items-center rounded text-text-faint transition-colors hover:bg-white/[0.06] hover:text-text"
            >
              <X size={14} />
            </button>
          </header>

          {config.sortPresets && config.sortPresets.length > 0 && (
            <div className="mb-3 rounded-md border border-border/70 bg-bg-1/70 p-2.5">
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-text-dim">
                מיון מהיר ל-{config.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {config.sortPresets
                  .filter((preset) => sortableKeys.has(preset.key))
                  .map((preset) => {
                    const isActive =
                      activeSorts.length === 1 &&
                      activeSorts[0]?.key === preset.key &&
                      activeSorts[0]?.dir === preset.dir;
                    return (
                      <button
                        key={`${preset.key}-${preset.dir}`}
                        type="button"
                        onClick={() => onChange([{ key: preset.key, dir: preset.dir }])}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                          isActive
                            ? 'border-brand-teal/45 bg-brand-teal/12 text-brand-teal'
                            : 'border-border bg-bg-1 text-text-dim hover:border-brand-teal/45 hover:text-brand-teal'
                        )}
                      >
                        {preset.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {preset.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {activeSorts.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-bg-1 px-3 py-3 text-center text-[12.5px] text-text-dim">
              אין מיון מותאם — התוצאות מסודרות לפי ברירת המחדל של הטבלה.
            </div>
          )}

          <ul className="flex flex-col gap-1.5">
            {activeSorts.map((spec, idx) => {
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

                  <div className="inline-flex items-center rounded border border-border p-0.5">
                    <button
                      type="button"
                      title="מיון עולה"
                      onClick={() =>
                        onChange(
                          activeSorts.map((s, i) => (i === idx ? { ...s, dir: 'asc' as const } : s))
                        )
                      }
                      className={cn(
                        'inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] transition-colors',
                        spec.dir === 'asc'
                          ? 'bg-brand-teal/15 text-brand-teal'
                          : 'text-text-faint hover:text-text'
                      )}
                    >
                      <ArrowUp size={10} />
                      עולה
                    </button>
                    <button
                      type="button"
                      title="מיון יורד"
                      onClick={() =>
                        onChange(
                          activeSorts.map((s, i) => (i === idx ? { ...s, dir: 'desc' as const } : s))
                        )
                      }
                      className={cn(
                        'inline-flex h-5 items-center gap-1 rounded px-1.5 text-[10.5px] transition-colors',
                        spec.dir === 'desc'
                          ? 'bg-brand-teal/15 text-brand-teal'
                          : 'text-text-faint hover:text-text'
                      )}
                    >
                      <ArrowDown size={10} />
                      יורד
                    </button>
                  </div>

                  <SortMoveBtn
                    icon={ChevronUp}
                    label="העלה עדיפות"
                    disabled={idx === 0}
                    onClick={() => onChange(swap(activeSorts, idx, idx - 1))}
                  />
                  <SortMoveBtn
                    icon={ChevronDown}
                    label="הורד עדיפות"
                    disabled={idx === activeSorts.length - 1}
                    onClick={() => onChange(swap(activeSorts, idx, idx + 1))}
                  />
                  <SortMoveBtn
                    icon={Trash2}
                    label="הסר ממיון"
                    onClick={() => onChange(activeSorts.filter((_, i) => i !== idx))}
                    tone="danger"
                  />
                </li>
              );
            })}
          </ul>

          {available.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-text-dim">
                הוסף עמודה למיון
              </div>
              <div className="flex flex-col gap-1.5">
                {available.map((col) => (
                  <div key={col.key} className="flex items-center justify-between rounded-md border border-border bg-bg-1 px-2.5 py-1.5">
                    <span className="truncate pe-2 text-[12.5px] text-text-dim">{col.label}</span>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onChange([...activeSorts, { key: col.key, dir: 'asc' }])}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-text-dim transition-colors hover:border-brand-teal/40 hover:text-brand-teal"
                        title="הוסף במיון עולה"
                      >
                        <ArrowUp size={11} />
                        עולה
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange([...activeSorts, { key: col.key, dir: 'desc' }])}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-text-dim transition-colors hover:border-brand-teal/40 hover:text-brand-teal"
                        title="הוסף במיון יורד"
                      >
                        <ArrowDown size={11} />
                        יורד
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={activeSorts.length === 0}
              className="inline-flex items-center gap-1 text-[12.5px] text-text-dim transition-colors hover:text-text disabled:opacity-50"
            >
              <RotateCcw size={12} />
              איפוס לברירת המחדל
            </button>
            <span className="inline-flex items-center gap-1 text-[11.5px] text-text-dim">
              <ArrowUpAZ size={12} />
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
