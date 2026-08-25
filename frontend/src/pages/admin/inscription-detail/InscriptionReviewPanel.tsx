// ===========================================
// InscriptionReviewPanel — acciones de revisión de la inscripción
// ===========================================
import { ClipboardCheck, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { InscriptionStatus, type Inscription } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { InscriptionReviewApi } from './useInscriptionReview';
import { usePermisos } from '@/hooks/usePermisos';

interface InscriptionReviewPanelProps {
  inscription: Inscription;
  /**
   * Todo el objeto que devuelve `useInscriptionReview`, en un solo prop.
   *
   * El panel usa prácticamente la API entera (los tres handlers, los tres
   * flags de `isPending` y los tres pares de estado), así que desarmarla en
   * props sueltas serían doce props que además tendrían que reordenarse cada
   * vez que se toque el flujo. Mismo criterio que `CalendarEventFormApi`.
   */
  review: InscriptionReviewApi;
}

/**
 * El panel es puramente presentacional: no pide ni muta nada por su cuenta,
 * sólo elige qué mostrar según el estado de la inscripción. Los cuatro estados
 * son excluyentes entre sí y cada uno pinta una rama distinta — por eso el
 * bloque completo sale de la página como una unidad.
 */
export function InscriptionReviewPanel({ inscription, review }: InscriptionReviewPanelProps) {
  // R22 — aprobar es el único acto de este panel que ADMIN_ZONAL no puede
  // hacer: `INSCRIPTION_APPROVE` es sólo de la línea provincial. Revisar y
  // rechazar sí los tiene, así que el panel se muestra igual, sin ese botón.
  const { puede } = usePermisos();
  const puedeAprobar = puede('INSCRIPTION_APPROVE');

  return (
    <div className="card p-6 bg-primary-50/50">
      <h3 className="font-semibold text-primary-900 flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-primary-500" />
        Panel de Revisión
      </h3>

      {inscription.status === InscriptionStatus.APROBADA && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg border border-green-200 flex flex-col items-center text-center gap-2">
          <CheckCircle className="w-8 h-8 text-green-500" />
          <p className="font-medium">Inscripción Aprobada</p>
          <p className="text-xs text-green-600">El participante está habilitado para competir.</p>
        </div>
      )}

      {inscription.status === InscriptionStatus.RECHAZADA && (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200 flex flex-col items-center text-center gap-2 mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
          <p className="font-medium">Inscripción Rechazada</p>
          <p className="text-xs text-red-600">Motivo: {inscription.rejectionNote}</p>
        </div>
      )}

      {(inscription.status === InscriptionStatus.PENDIENTE || inscription.status === InscriptionStatus.REVISADA) && (
        <div className="space-y-4">
          {inscription.status === InscriptionStatus.PENDIENTE ? (
            <div className="space-y-3">
              <Textarea 
                placeholder="Notas internas de revisión (opcional)..." 
                value={review.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => review.setNotes(e.target.value)}
                className="min-h-[100px]"
              />
              <Button 
                className="w-full" 
                variant="outline"
                onClick={review.handleReview}
                disabled={review.isReviewPending}
              >
                {review.isReviewPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Marcar como Revisada
              </Button>
            </div>
          ) : (
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200 text-sm">
              <p className="font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Revisada</p>
              {inscription.notes && <p className="mt-1 opacity-80 text-xs">Notas: {inscription.notes}</p>}
            </div>
          )}

          {review.isRejecting ? (
            <div className="space-y-3 animate-fade-in pt-4 border-t border-primary-200">
              <Textarea 
                placeholder="Especifique el motivo de rechazo..." 
                value={review.rejectionNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => review.setRejectionNote(e.target.value)}
                className="border-red-300 focus-visible:ring-red-500"
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => review.setIsRejecting(false)} className="flex-1">Cancelar</Button>
                <Button variant="destructive" onClick={review.handleReject} disabled={review.isRejectPending} className="flex-1">
                  {review.isRejectPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar Rechazo
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`grid gap-2 pt-4 border-t border-primary-200 ${
                puedeAprobar ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              <Button 
                variant="destructive" 
                onClick={() => review.setIsRejecting(true)}
              >
                Rechazar
              </Button>
              {puedeAprobar && (
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  onClick={review.handleApprove}
                  disabled={review.isApprovePending}
                >
                  {review.isApprovePending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Aprobar
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
