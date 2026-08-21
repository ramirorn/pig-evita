// ===========================================
// Inscription Detail & Review Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useInscription } from '@/hooks/useInscriptions';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { InscriptionStatusBadge } from '@/components/shared/InscriptionStatusBadge';
import { InscriptionReviewPanel } from './inscription-detail/InscriptionReviewPanel';
import { useInscriptionReview } from './inscription-detail/useInscriptionReview';

export function InscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: inscription, isLoading } = useInscription(id || '');

  // Se llama antes de los early returns para no romper el orden de hooks, y se
  // le pasa el id del registro ya cargado (no el de la URL): los handlers sólo
  // son alcanzables desde el panel, que se pinta cuando `inscription` existe.
  const review = useInscriptionReview(inscription?.id ?? '');

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
            <InscriptionStatusBadge status={inscription.status} />
          </div>
          <p className="text-sm text-primary-500 mt-1">
            Enviada el {new Date(inscription.createdAt).toLocaleString()}
            {inscription.createdBy && (
              <span className="ml-2">
                · Inscripto por: <span className="font-medium text-primary-700">{inscription.createdBy.firstName} {inscription.createdBy.lastName}</span>
              </span>
            )}
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
          <InscriptionReviewPanel inscription={inscription} review={review} />
        </div>
      </div>
    </div>
  );
}
