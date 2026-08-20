// ===========================================
// React Query Hooks — Dashboard
// ===========================================
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import { STALE_TIME } from '@/lib/queryClient';
import { useQueryScope } from './useQueryScope';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['dashboard', <userId>, 'stats']`. Aunque hoy el endpoint devuelve
 * los mismos totales globales para todos los roles habilitados, la clave se
 * namespacea igual que el resto de los dominios privados: si mañana el backend
 * empieza a filtrar por delegación, dos usuarios en el mismo navegador no
 * comparten la entrada.
 */
export const DASHBOARD_KEYS = {
  all: (userId: string) => ['dashboard', userId] as const,
  stats: (userId: string) => [...DASHBOARD_KEYS.all(userId), 'stats'] as const,
};

/**
 * Métricas del panel de administración en una única request.
 *
 * `staleTime: OPERATIONAL` (2 min): son datos operativos —inscripciones,
 * participantes, equipos— y además el backend los sirve desde una cache Redis
 * con hasta 60 s de atraso. Pedirlos más seguido que eso no traería números más
 * frescos, sólo más tráfico.
 */
export function useDashboardStats() {
  const scope = useQueryScope();

  return useQuery({
    queryKey: DASHBOARD_KEYS.stats(scope),
    queryFn: () => dashboardApi.getStats(),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}
