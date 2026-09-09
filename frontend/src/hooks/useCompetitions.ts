// ===========================================
// React Query Hooks — Competitions
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  competitionsApi, 
  type CompetitionFilters, 
  type CreateCompetitionPayload,
  type UpdateCompetitionPayload,
  type GenerateFixturePayload
} from '@/api/competitions.api';
import { STALE_TIME } from '@/lib/queryClient';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { getFriendlyError } from '@/lib/utils';
import { toast } from 'sonner';

export const COMPETITION_KEYS = {
  all: ['competitions'] as const,
  lists: () => [...COMPETITION_KEYS.all, 'list'] as const,
  list: (filters?: CompetitionFilters) => [...COMPETITION_KEYS.lists(), { filters }] as const,
  listAll: (filters: CompetitionFilters) => [...COMPETITION_KEYS.lists(), 'all', filters] as const,
  details: () => [...COMPETITION_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...COMPETITION_KEYS.details(), id] as const,
};

export function useCompetitions(filters?: CompetitionFilters) {
  return useQuery({
    queryKey: COMPETITION_KEYS.list(filters),
    queryFn: () => competitionsApi.findAll(filters),
    staleTime: STALE_TIME.LIVE,
  });
}

/**
 * Todas las competencias que matchean el filtro, recorriendo la paginación
 * hasta el final.
 *
 * Cierra el caso más grave de la familia R29/S06/S13: `RankingsPage` llamaba a
 * `useCompetitions()` sin filtros —20 filas— y **después** descartaba en
 * memoria las `BORRADOR` y aplicaba la búsqueda. Con 20 borradores en la
 * primera página la pantalla quedaba vacía teniendo competencias activas en la
 * segunda, y una competencia de la página 2 no aparecía ni buscándola por
 * nombre.
 *
 * Por qué el descarte de `BORRADOR` sigue en el cliente: `CompetitionFilters`
 * acepta `status`, pero como **igualdad de un solo valor**. La pantalla pública
 * necesita ACTIVA **y** FINALIZADA, que no se expresa con un `status=` único
 * (verificado contra la API: `?status=ACTIVA` devuelve total 0 y
 * `?status=FINALIZADA` devuelve total 1, no hay forma de pedir las dos juntas
 * ni un `not`). Serían dos requests para ahorrar un `filter()` sobre un
 * catálogo chico. Lo que sí cambia, y es el bug de verdad, es que ahora el
 * filtro corre sobre el conjunto **completo**.
 */
export function useAllCompetitions(filters: CompetitionFilters = {}) {
  return useQuery({
    queryKey: COMPETITION_KEYS.listAll(filters),
    queryFn: () =>
      fetchAllPages((page, limit) => competitionsApi.findAll({ ...filters, page, limit })),
    staleTime: STALE_TIME.LIVE,
  });
}

export function useCompetition(id: string) {
  return useQuery({
    queryKey: COMPETITION_KEYS.detail(id),
    queryFn: () => competitionsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.LIVE,
  });
}

export function useCreateCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCompetitionPayload) => competitionsApi.create(payload),
    onSuccess: () => {
      toast.success('Competencia creada exitosamente');
      queryClient.invalidateQueries({ queryKey: COMPETITION_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear la competencia'));
    },
  });
}

export function useUpdateCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompetitionPayload }) => 
      competitionsApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Competencia actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: COMPETITION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: COMPETITION_KEYS.detail(variables.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar la competencia'));
    },
  });
}

export function useGenerateFixture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GenerateFixturePayload }) => 
      competitionsApi.generateFixture(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Fixture generado automáticamente con éxito');
      queryClient.invalidateQueries({ queryKey: COMPETITION_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['matches', variables.id] });
    },
    onError: (error: unknown) => {
      toast.error(
        getFriendlyError(
          error,
          'Error al generar el fixture. Verifique que existan suficientes equipos/participantes inscriptos.',
        ),
      );
    },
  });
}
