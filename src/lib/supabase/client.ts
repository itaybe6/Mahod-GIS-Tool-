import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/** `createClient` expects the project origin only (no `/rest/v1`). */
function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});

/** Convenience flag for components to gate features that require Supabase credentials. */
export const isSupabaseConfigured = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
