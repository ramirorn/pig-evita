// ===========================================
// QueryClient — singleton compartido
// ===========================================
import { QueryClient } from '@tanstack/react-query';

/**
 * Frescura por dominio de datos (hallazgos Q4 y Q14).
 *
 * El default global era 30 s para todo, así que un catálogo que cambia una vez
 * por temporada se re-pedía igual que una tabla de posiciones en vivo. Cada hook
 * declara a qué grupo pertenece; el default de 5 min aplica al resto.
 */
export const STALE_TIME = {
  /** Catálogos: disciplinas, categorías, sedes, noticias. */
  CATALOG: 10 * 60_000,
  /** Datos operativos: inscripciones, participantes, equipos, usuarios. */
  OPERATIONAL: 2 * 60_000,
  /** Datos volátiles: resultados, fixtures, posiciones. */
  LIVE: 30_000,
} as const;

/**
 * Instancia única de TanStack Query para toda la app.
 *
 * Vive en su propio módulo (y no dentro de `App.tsx`) para que código fuera del
 * árbol de React —el store de autenticación, sobre todo— pueda vaciar la cache
 * en el logout. Ver `auth.store.tsx`: sin eso, el usuario B que loguea en el
 * mismo navegador después de A ve datos cacheados de A (hallazgo F3).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Default deliberadamente conservador; los hooks de cada dominio lo
      // sobrescriben con el valor de STALE_TIME que les corresponde.
      staleTime: 5 * 60_000,
    },
  },
});

/**
 * Descarta toda la cache al cambiar de sesión.
 *
 * Se cancelan primero las requests en vuelo: una respuesta que llegue *después*
 * de `clear()` volvería a poblar la cache con datos del usuario anterior, que es
 * exactamente la fuga que esta función existe para evitar.
 */
export async function resetQueryCache(): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
}
