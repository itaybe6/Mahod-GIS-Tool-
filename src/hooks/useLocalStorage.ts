import { useCallback, useEffect, useState } from 'react';

/**
 * Persist a piece of state in `window.localStorage`.
 *
 * Behaviour:
 * - Reads the initial value lazily from storage on first render.
 * - Falls back to `initialValue` on parse errors and on the server (SSR-safe).
 * - Listens to `storage` events so multiple tabs stay in sync.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): readonly [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const [stored, setStored] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* quota exceeded / private mode: ignore */
        }
        return next;
      });
    },
    [key]
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setStored(initialValue);
  }, [key, initialValue]);

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== key || event.newValue === null) return;
      try {
        setStored(JSON.parse(event.newValue) as T);
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [stored, setValue, remove] as const;
}
