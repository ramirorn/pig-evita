// ===========================================
// Inscription Detail & Review Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { useInscription } from '@/hooks/useInscriptions';
import { ROUTES } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { InscriptionStatusBadge } from '@/components/shared/InscriptionStatusBadge';
import { DetailHeader } from './components/DetailHeader';
import { DetailLoading, DetailNotFound } from './components/DetailState';
import { FactList } from './components/FactList';
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

  if (isLoading) return <DetailLoading label="Cargando la inscripción…" />;

  if (!inscription) {
    return (
      <DetailNotFound
        title="No encontramos la inscripción"
        hint="Puede que se haya eliminado o que el enlace esté incompleto."
        backLabel="Volver a inscripciones"
        onBack={() => navigate(ROUTES.INSCRIPTIONS)}
      />
    );
  }

  const participante = inscription.participant;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumbs
        items={[
          { label: 'Inscripciones', path: ROUTES.INSCRIPTIONS },
          { label: `Inscripción #${inscription.qrCode}` },
        ]}
      />

      <DetailHeader
        title={`Inscripción #${inscription.qrCode}`}
        status={<InscriptionStatusBadge status={inscription.status} />}
        meta={
          <>
            Enviada el <span className="tabular-nums">{formatDateTime(inscription.createdAt)}</span>
            {inscription.createdBy && (
              <>
                {' · '}Inscripto por{' '}
                <span className="font-medium text-primary-800">
                  {inscription.createdBy.firstName} {inscription.createdBy.lastName}
                </span>
              </>
            )}
          </>
        }
        backLabel="Volver a inscripciones"
        onBack={() => navigate(ROUTES.INSCRIPTIONS)}
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* En celular el panel de revisión va primero: es lo que se viene a hacer. */}
        <div className="order-1 md:order-2 md:self-start">
          <InscriptionReviewPanel inscription={inscription} review={review} />
        </div>

        <div className="order-2 md:order-1 md:col-span-2 space-y-6">
          <section aria-labelledby="inscripcion-solicitante" className="card p-5 space-y-4">
            <h2 id="inscripcion-solicitante" className="type-h2 text-primary-900">
              Datos del solicitante
            </h2>
            <FactList
              facts={[
                {
                  label: 'Nombre completo',
                  value: participante ? `${participante.lastName}, ${participante.firstName}` : '—',
                },
                { label: 'DNI', value: participante?.dni ?? '—' },
                {
                  label: 'Ubicación',
                  value: participante ? `${participante.locality}, ${participante.department}` : '—',
                },
                {
                  label: 'Contacto',
                  value: participante?.email || participante?.phone || 'Sin contacto cargado',
                },
              ]}
            />
          </section>

          <section aria-labelledby="inscripcion-competencia" className="card p-5 space-y-4">
            <h2 id="inscripcion-competencia" className="type-h2 text-primary-900">
              Detalle de la competencia
            </h2>
            <FactList
              facts={[
                { label: 'Categoría', value: inscription.category?.name ?? '—' },
                {
                  label: 'Equipo',
                  value: inscription.team ? inscription.team.name : 'Inscripción individual',
                },
              ]}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
