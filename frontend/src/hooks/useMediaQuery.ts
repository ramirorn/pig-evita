// ===========================================
// useMediaQuery — suscripción a una media query de CSS
// ===========================================
import { useCallback, useSyncExternalStore } from 'react';

/**
 * `true` mientras la media query se cumple. Usa `useSyncExternalStore` para no
 * desincronizarse con el render (nada de `useEffect` + `setState`).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
