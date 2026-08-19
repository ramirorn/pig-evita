// ===========================================
// React Query Hooks — Inscriptions
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  inscriptionsApi, 
  type InscriptionFilters, 
  type CreateInscriptionPayload, 
  type ReviewInscriptionPayload,
  type RejectInscriptionPayload
} from '@/api/inscriptions.api';
import { STALE_TIME } from '@/lib/queryClient';
import { toast } from 'sonner';

export const INSCRIPTION_KEYS = {
  all: ['inscriptions'] as const,
  lists: () => [...INSCRIPTION_KEYS.all, 'list'] as const,
  list: (filters?: InscriptionFilters) => [...INSCRIPTION_KEYS.lists(), { filters }] as const,
  details: () => [...INSCRIPTION_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...INSCRIPTION_KEYS.details(), id] as const,
};

export function useInscriptions(filters?: InscriptionFilters) {
  return useQuery({
    queryKey: INSCRIPTION_KEYS.list(filters),
    queryFn: () => inscriptionsApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useInscription(id: string) {
  return useQuery({
    queryKey: INSCRIPTION_KEYS.detail(id),
    queryFn: () => inscriptionsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useInscriptionByQr(qrCode: string) {
  return useQuery({
    queryKey: [...INSCRIPTION_KEYS.details(), 'qr', qrCode],
    queryFn: () => inscriptionsApi.findByQr(qrCode),
    enabled: !!qrCode,
    retry: false,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInscriptionPayload) => inscriptionsApi.create(payload),
    onSuccess: () => {
      toast.success('Inscripción registrada exitosamente');
      // Public facing form usually doesn't need invalidation of admin lists, 
      // but it's good practice just in case admin is logged in.
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists() });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Error al registrar la inscripción';
      toast.error(typeof message === 'string' ? message : 'Error en los datos ingresados');
    },
  });
}

export function useReviewInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewInscriptionPayload }) => 
      inscriptionsApi.review(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Inscripción marcada como revisada');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(variables.id) });
    },
    onError: () => {
      toast.error('Error al revisar la inscripción');
    },
  });
}

export function useApproveInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => inscriptionsApi.approve(id),
    onSuccess: (_, variables) => {
      toast.success('Inscripción aprobada exitosamente');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(variables) });
    },
    onError: () => {
      toast.error('Error al aprobar la inscripción');
    },
  });
}

export function useRejectInscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RejectInscriptionPayload }) => 
      inscriptionsApi.reject(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Inscripción rechazada');
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: INSCRIPTION_KEYS.detail(variables.id) });
    },
    onError: () => {
      toast.error('Error al rechazar la inscripción');
    },
  });
}
