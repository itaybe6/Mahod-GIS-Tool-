import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeSupabaseUrl, getExportReportsFunctionUrl } from './supabaseFunctionsUrl';

describe('normalizeSupabaseUrl', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeSupabaseUrl('')).toBe('');
  });

  it('keeps a clean URL unchanged', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co')).toBe('https://abc.supabase.co');
  });

  it('strips a single trailing slash', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/')).toBe('https://abc.supabase.co');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co///')).toBe('https://abc.supabase.co');
  });

  it('strips /rest/v1 suffix', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1')).toBe(
      'https://abc.supabase.co',
    );
  });

  it('strips /rest/v1/ suffix with trailing slash', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/rest/v1/')).toBe(
      'https://abc.supabase.co',
    );
  });

  it('is case-insensitive for REST/V1', () => {
    expect(normalizeSupabaseUrl('https://abc.supabase.co/REST/V1')).toBe(
      'https://abc.supabase.co',
    );
  });
});

describe('getExportReportsFunctionUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the correct function URL from env', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    expect(getExportReportsFunctionUrl()).toBe(
      'https://abc.supabase.co/functions/v1/export-reports',
    );
  });

  it('handles URL with trailing slash in env', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co/');
    expect(getExportReportsFunctionUrl()).toBe(
      'https://abc.supabase.co/functions/v1/export-reports',
    );
  });

  it('returns /functions/v1/export-reports when env is empty', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(getExportReportsFunctionUrl()).toBe('/functions/v1/export-reports');
  });
});
