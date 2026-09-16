// ===========================================
// React Query Hooks — Inscriptions
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  inscriptionsApi,
  type InscriptionFilters,
  type CreateInscriptionPayload,
  type CreateTeamInscriptionPayload,
  type ReviewInscriptionPayload,
  type RejectInscriptionPayload
} from '@/api/inscriptions.api';
import { TEAM_KEYS } from './useTeams';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
import { useQueryScope } from './useQueryScope';
import { toast } from 'sonner';

/**
 * Claves de cache namespaceadas por usuario (hallazgos F4-F7).
 *
 * Forma: `['inscriptions', <userId>, 'list' | 'detail', ...]`. El dominio va
 * primero para que `invalidateQueries({ queryKey: ['inscriptions'] })` siga
 * alcanzando a todo el dominio; el `userId` va inmediatamente después, de modo
 * que dos usuarios nunca comparten una entrada.
 */
export const INSCRIPTION_KEYS = {
  all: (userId: string) => ['inscriptions', userId] as const,
  lists: (userId: string) => [...INSCRIPTION_KEYS.all(userId), 'list'] as const,
  list: (userId: string, filters?: InscriptionFilters) =>
    [...INSCRIPTION_KEYS.lists(userId), { filters }] as const,
  details: (userId: string) => [...INSCRIPTION_KEYS.all(userId), 'detail'] as const,
  detail: (userId: string, id: string) =>
    [...INSCRIPTION_KEYS.details(userId), id] as const,
  /**
   * Consulta pública por código QR: la respuesta es idéntica para cualquiera
   * (ver `findByQr` en el backend, T01), así que queda fuera del namespace por
   * usuario — no tiene sentido re-pedirla por cada sesión.
   */
  publicByQr: (qrCode: string) => ['inscriptions', 'public', 'qr', qrCode] as const,
};

export function useInscriptions(filters?: InscriptionFilters) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: INSCRIPTION_KEYS.list(scope, filters),
    queryFn: () => inscriptionsApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useInscription(id: string) {
  const scope = useQueryScope();

  return useQuery({
    queryKey: INSCRIPTION_KEYS.detail(scope, id),
    queryFn: () => inscriptionsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useInscriptionByQr(qrCode: string) {
  return useQuery({
    queryKey: INSCRIPTION_KEYS.publicByQr(qrCode),
    queryFn: () => inscriptionsApi.findByQr(qrCode),
    enabled: !!qrCode,
    retry: false,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (payload: CreateInscriptionPayload) => inscriptionsApi.create(payload),
    onSuccess: () => {
      toast.success('Inscripción registrada exitosamente');
      // Public facing form usually doesn't need invalidation of admin lists, 
      // but it's good practice just in case admin is logged in.
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists(scope) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al registrar la inscripción'));
    },
  });
}

/**
 * Alta de un plantel entero en un solo request transaccional.
 *
 * **No lleva `onError`, a diferencia del resto de las mutaciones de este
 * archivo.** Es deliberado: cuando el backend rechaza el alta porque un chico
 * ya está inscripto en esa categoría, la respuesta útil no es un toast —es
 * marcar a *esa* persona en la lista de 16 que el encargado tiene delante. El
 * asistente (`useTeamInscriptionWizard`) hace las dos cosas: señala al que
 * falló e informa. Un toast genérico acá se le superpondría.
 */
export function useCreateTeamInscription() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (payload: CreateTeamInscriptionPayload) => inscriptionsApi.createTeam(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists(scope) });
      // El alta crea también el equipo: el listado de Equipos queda viejo.
      queryClient.invalidateQueries({ queryKey: TEAM_KEYS.lists(scope) });
    },
  });
}

export function useReviewInscription() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewInscriptionPayload }) => 
      inscriptionsApi.review(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Inscripción marcada como revisada');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(scope, variables.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al revisar la inscripción'));
    },
  });
}

export function useApproveInscription() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: (id: string) => inscriptionsApi.approve(id),
    onSuccess: (_, variables) => {
      toast.success('Inscripción aprobada exitosamente');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(scope, variables) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al aprobar la inscripción'));
    },
  });
}

export function useRejectInscription() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectInscriptionPayload }) => 
      inscriptionsApi.reject(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Inscripción rechazada');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists(scope) });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(scope, variables.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al rechazar la inscripción'));
    },
  });
}
