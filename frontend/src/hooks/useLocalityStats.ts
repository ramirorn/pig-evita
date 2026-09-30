// ===========================================
// React Query Hooks — Estadísticas por localidad (mapa de impacto)
// ===========================================
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats.api';
import { STALE_TIME } from '@/lib/queryClient';

/**
 * Sin namespace de usuario, a diferencia de los dominios privados: el endpoint
 * es público y devuelve lo mismo para todos. El sitio y el panel comparten la
 * entrada de cache, así que abrir el mapa en los dos lugares es una sola
 * request.
 */
export const LOCALITY_STATS_KEYS = {
  all: ['stats'] as const,
  localities: () => [...LOCALITY_STATS_KEYS.all, 'localities'] as const,
};

/**
 * Participación por localidad.
 *
 * `staleTime: OPERATIONAL` (2 min): cambia con cada inscripción aprobada y cada
 * resultado cargado, pero no es un marcador en vivo.
 */
export function useLocalityStats() {
  return useQuery({
    queryKey: LOCALITY_STATS_KEYS.localities(),
    queryFn: () => statsApi.getLocalities(),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}
