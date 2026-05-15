import { useEffect, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

/**
 * Keeps `useAuthStore.isAuthenticated` aligned with the Supabase session so
 * navigation and gated UI match reality after refresh or external auth events.
 */
export function AuthSessionSync({ children }: { children: ReactNode }): JSX.Element {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(Boolean(session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setAuthenticated]);

  return <>{children}</>;
}
