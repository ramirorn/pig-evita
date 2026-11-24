// ===========================================
// useLocalities — catálogo de departamentos y localidades
// ===========================================
import { useQuery } from '@tanstack/react-query';
import { localitiesApi } from '@/api/localities.api';
import { STALE_TIME } from '@/lib/queryClient';

export const LOCALITY_KEYS = {
  all: ['localities'] as const,
  catalog: () => [...LOCALITY_KEYS.all, 'catalog'] as const,
};

/** Público e igual para todos: no lleva el usuario en la clave. */
export function useLocalities() {
  return useQuery({
    queryKey: LOCALITY_KEYS.catalog(),
    queryFn: () => localitiesApi.findAll(),
    staleTime: STALE_TIME.CATALOG,
  });
}
