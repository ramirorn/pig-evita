// ===========================================
// Inscription Detail & Review Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { ClipboardCheck, ArrowLeft, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { 
  useInscription, 
  useReviewInscription, 
  useApproveInscription, 
  useRejectInscription 
} from '@/hooks/useInscriptions';
import { InscriptionStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

export function InscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: inscription, isLoading } = useInscription(id || '');
  const reviewMutation = useReviewInscription();
  const approveMutation = useApproveInscription();
  const rejectMutation = useRejectInscription();

  const [notes, setNotes] = useState('');
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!inscription) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary-800">Inscripción no encontrada</h2>
        <Button variant="link" onClick={() => navigate(ROUTES.INSCRIPTIONS)}>Volver al listado</Button>
      </div>
    );
  }

  const handleReview = async () => {
    try {
      await reviewMutation.mutateAsync({ id: inscription.id, payload: { notes } });
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(inscription.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) {
      toast.error('Debe proporcionar un motivo de rechazo');
      return;
    }
    try {
      await rejectMutation.mutateAsync({ id: inscription.id, payload: { rejectionNote } });
      setIsRejecting(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <Breadcrumbs
        items={[
          { label: 'Inscripciones', path: ROUTES.INSCRIPTIONS },
          { label: `Inscripción #${inscription.qrCode}` },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(ROUTES.INSCRIPTIONS)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary-800">
              Inscripción #{inscription.qrCode}
            </h1>
            <Badge variant="outline" className={
              inscription.status === InscriptionStatus.APROBADA ? 'text-green-600 bg-green-50 border-green-200' :
              inscription.status === InscriptionStatus.RECHAZADA ? 'text-red-600 bg-red-50 border-red-200' :
              inscription.status === InscriptionStatus.REVISADA ? 'text-blue-600 bg-blue-50 border-blue-200' :
              'text-orange-600 bg-orange-50 border-orange-200'
            }>
              {inscription.status}
            </Badge>
          </div>
          <p className="text-sm text-primary-500 mt-1">
            Enviada el {new Date(inscription.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Detalles de la inscripción */}
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-primary-900 border-b border-primary-100 pb-3 mb-4 text-lg">
              Datos del Solicitante
            </h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <p className="text-primary-500 text-xs">Nombre Completo</p>
                <p className="font-medium text-primary-900">{inscription.participant?.lastName}, {inscription.participant?.firstName}</p>
              </div>
              <div>
                <p className="text-primary-500 text-xs">DNI</p>
                <p className="font-medium text-primary-900">{inscription.participant?.dni}</p>
              </div>
              <div>
                <p className="text-primary-500 text-xs">Ubicación</p>
                <p className="font-medium text-primary-900">{inscription.participant?.locality}, {inscription.participant?.department}</p>
              </div>
              <div>
                <p className="text-primary-500 text-xs">Contacto</p>
                <p className="font-medium text-primary-900">{inscription.participant?.email || inscription.participant?.phone || 'Sin contacto'}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-primary-900 border-b border-primary-100 pb-3 mb-4 text-lg">
              Detalle de Competencia
            </h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <p className="text-primary-500 text-xs">Categoría</p>
                <p className="font-medium text-primary-900">{inscription.category?.name}</p>
              </div>
              <div>
                <p className="text-primary-500 text-xs">Equipo</p>
                {inscription.team ? (
                  <p className="font-medium text-primary-900">{inscription.team.name}</p>
                ) : (
                  <p className="text-primary-500 italic">Inscripción Individual</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Acciones y Revisión */}
        <div className="space-y-6">
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
                      value={notes}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={handleReview}
                      disabled={reviewMutation.isPending}
                    >
                      {reviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Marcar como Revisada
                    </Button>
                  </div>
                ) : (
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200 text-sm">
                    <p className="font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Revisada</p>
                    {inscription.notes && <p className="mt-1 opacity-80 text-xs">Notas: {inscription.notes}</p>}
                  </div>
                )}

                {isRejecting ? (
                  <div className="space-y-3 animate-fade-in pt-4 border-t border-primary-200">
                    <Textarea 
                      placeholder="Especifique el motivo de rechazo..." 
                      value={rejectionNote}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionNote(e.target.value)}
                      className="border-red-300 focus-visible:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setIsRejecting(false)} className="flex-1">Cancelar</Button>
                      <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending} className="flex-1">
                        {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Rechazo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-primary-200">
                    <Button 
                      variant="destructive" 
                      onClick={() => setIsRejecting(true)}
                    >
                      Rechazar
                    </Button>
                    <Button 
                      className="bg-green-600 hover:bg-green-700" 
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Aprobar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
