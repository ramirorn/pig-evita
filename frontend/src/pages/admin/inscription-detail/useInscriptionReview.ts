// ===========================================
// useInscriptionReview — acciones de revisión de una inscripción
// ===========================================
import { useState } from 'react';
import { toast } from 'sonner';
import {
  useReviewInscription,
  useApproveInscription,
  useRejectInscription,
} from '@/hooks/useInscriptions';
import { logError } from '@/lib/logger';

/**
 * Agrupa las tres mutaciones del panel de revisión (revisar / aprobar /
 * rechazar) junto con el estado del formulario que las alimenta.
 *
 * Van juntas y no sueltas en la página porque comparten una misma pieza de
 * estado: el modo "rechazando" se abre desde los botones de acción, se cierra
 * solo cuando el rechazo sale bien, y el motivo que escribe el admin es el
 * único campo obligatorio de las tres. Separarlas dejaría a la página
 * coordinando ese ida y vuelta a mano.
 *
 * Los `catch` sólo logean: el toast de error ya lo dispara el `onError` de cada
 * hook de mutación, así que acá alcanza con no dejar la promesa rechazada
 * suelta (`mutateAsync` rechaza siempre, aunque el hook maneje el error).
 */
export function useInscriptionReview(inscriptionId: string) {
  const reviewMutation = useReviewInscription();
  const approveMutation = useApproveInscription();
  const rejectMutation = useRejectInscription();

  const [notes, setNotes] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const handleReview = async () => {
    try {
      await reviewMutation.mutateAsync({ id: inscriptionId, payload: { notes } });
    } catch (e) {
      logError('InscriptionDetailPage.handleReview', e);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(inscriptionId);
    } catch (e) {
      logError('InscriptionDetailPage.handleApprove', e);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) {
      toast.error('Debe proporcionar un motivo de rechazo');
      return;
    }
    try {
      await rejectMutation.mutateAsync({ id: inscriptionId, payload: { rejectionNote } });
      setIsRejecting(false);
    } catch (e) {
      logError('InscriptionDetailPage.handleReject', e);
    }
  };

  return {
    notes,
    setNotes,
    rejectionNote,
    setRejectionNote,
    isRejecting,
    setIsRejecting,
    handleReview,
    handleApprove,
    handleReject,
    isReviewPending: reviewMutation.isPending,
    isApprovePending: approveMutation.isPending,
    isRejectPending: rejectMutation.isPending,
  };
}

/** Tipo del objeto que devuelve el hook, para tiparlo como prop del panel. */
export type InscriptionReviewApi = ReturnType<typeof useInscriptionReview>;
