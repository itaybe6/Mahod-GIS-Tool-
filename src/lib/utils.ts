import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware class concatenation.
 * Combines `clsx` for conditional class composition with `tailwind-merge`
 * so that conflicting Tailwind utilities (e.g. `p-2 p-4`) are deduplicated.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number using Hebrew locale grouping. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('he-IL').format(n);
}
