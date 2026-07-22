// ===========================================
// React Query Hooks — Documents
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type ReviewDocumentPayload } from '@/api/documents.api';
import { toast } from 'sonner';

export const DOCUMENT_KEYS = {
  all: ['documents'] as const,
  participant: (participantId: string) => [...DOCUMENT_KEYS.all, 'participant', participantId] as const,
};

export function useParticipantDocuments(participantId: string) {
  return useQuery({
    queryKey: DOCUMENT_KEYS.participant(participantId),
    queryFn: () => documentsApi.findByParticipant(participantId),
    enabled: !!participantId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ participantId, type, file }: { participantId: string; type: string; file: File }) => 
      documentsApi.upload(participantId, type, file),
    onSuccess: (_, variables) => {
      toast.success('Documento subido exitosamente');
      queryClient.invalidateQueries({ queryKey: DOCUMENT_KEYS.participant(variables.participantId) });
    },
    onError: () => {
      toast.error('Error al subir documento');
    },
  });
}

export function useReviewDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewDocumentPayload }) => 
      documentsApi.review(id, payload),
    onSuccess: (data) => {
      toast.success(`Documento ${data.status.toLowerCase()} exitosamente`);
      if (data.participantId) {
        queryClient.invalidateQueries({ queryKey: DOCUMENT_KEYS.participant(data.participantId) });
      }
    },
    onError: () => {
      toast.error('Error al revisar el documento');
    },
  });
}
