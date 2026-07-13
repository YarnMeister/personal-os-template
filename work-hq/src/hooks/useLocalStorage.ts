import { useCallback, useEffect, useState } from "react";

// SSR-safe: reads only after mount, avoiding hydration mismatches.
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  }, [key, value, hydrated]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, { hydrated, reset }] as const;
}
