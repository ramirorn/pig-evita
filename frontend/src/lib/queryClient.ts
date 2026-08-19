// ===========================================
// QueryClient — singleton compartido
// ===========================================
import { QueryClient } from '@tanstack/react-query';

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
      staleTime: 30_000, // 30 seconds
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
