// ===========================================
// React Query Hooks — Auditoría
// ===========================================
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditApi, type AuditFilters } from '@/api/audit.api';
import { STALE_TIME } from '@/lib/queryClient';
import { useQueryScope } from './useQueryScope';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['audit', <userId>, 'list', { filters }]`. El registro de auditoría
 * es sensible: dos sesiones en el mismo navegador no comparten la entrada.
 */
export const AUDIT_KEYS = {
  all: (userId: string) => ['audit', userId] as const,
  lists: (userId: string) => [...AUDIT_KEYS.all(userId), 'list'] as const,
  list: (userId: string, filters?: AuditFilters) =>
    [...AUDIT_KEYS.lists(userId), { filters }] as const,
};

/**
 * Página del registro de auditoría con los filtros del servidor.
 *
 * `staleTime: OPERATIONAL`: los eventos se agregan con cada operación del
 * sistema. `keepPreviousData` deja la página anterior a la vista mientras llega
 * la siguiente, para que paginar no vacíe la tabla.
 */
export function useAuditLogs(filters?: AuditFilters) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: AUDIT_KEYS.list(scope, filters),
    queryFn: () => auditApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
    placeholderData: keepPreviousData,
  });
}
