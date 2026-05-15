import { describe, it, expect } from 'vitest';
import { cn, formatNumber } from './utils';

describe('cn', () => {
  it('joins class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('merges conflicting Tailwind utilities (last wins)', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });

  it('handles conditional object syntax', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold');
  });

  it('returns empty string when no classes', () => {
    expect(cn()).toBe('');
  });

  it('handles array input', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });
});

describe('formatNumber', () => {
  it('formats a simple integer', () => {
    const result = formatNumber(1000);
    expect(result).toContain('1');
    expect(result).toContain('000');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('returns a non-empty string for any number', () => {
    expect(formatNumber(42).length).toBeGreaterThan(0);
    expect(formatNumber(1_000_000).length).toBeGreaterThan(0);
  });

  it('formats negative number', () => {
    const result = formatNumber(-500);
    expect(result).toContain('500');
  });
});
