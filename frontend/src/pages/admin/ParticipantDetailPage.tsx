// ===========================================
// Participant Detail Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { useParticipant } from '@/hooks/useParticipants';
import { SEX_LABELS, ROUTES } from '@/lib/constants';
import { formatCalendarDate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { DetailHeader } from './components/DetailHeader';
import { DetailLoading, DetailNotFound } from './components/DetailState';
import { FactList } from './components/FactList';
import { ParticipantDocumentsCard } from './participants/ParticipantDocumentsCard';

export function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: participant, isLoading } = useParticipant(id || '');

  if (isLoading) return <DetailLoading label="Cargando el participante…" />;

  if (!participant) {
    return (
      <DetailNotFound
        title="No encontramos al participante"
        hint="Puede que se haya eliminado o que el enlace esté incompleto."
        backLabel="Volver al padrón"
        onBack={() => navigate(ROUTES.PARTICIPANTS)}
      />
    );
  }

  const nombre = `${participant.lastName}, ${participant.firstName}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Participantes', path: ROUTES.PARTICIPANTS },
          { label: nombre },
        ]}
      />

      <DetailHeader
        title={nombre}
        meta={
          <span className="tabular-nums">
            DNI {participant.dni} · {SEX_LABELS[participant.sex]}
          </span>
        }
        backLabel="Volver al padrón"
        onBack={() => navigate(ROUTES.PARTICIPANTS)}
      />

      <div className="grid gap-6 md:grid-cols-3">
        <section aria-labelledby="participante-datos" className="card p-5 md:col-span-1 space-y-4 self-start">
          <h2 id="participante-datos" className="type-h2 text-primary-900">
            Datos personales
          </h2>
          <FactList
            className="sm:grid-cols-1"
            facts={[
              { label: 'Fecha de nacimiento', value: formatCalendarDate(participant.birthDate) },
              {
                label: 'Ubicación',
                value: (
                  <>
                    {participant.locality}, {participant.department}
                    {participant.address && (
                      <span className="mt-0.5 block text-xs font-normal text-primary-600">
                        {participant.address}
                      </span>
                    )}
                  </>
                ),
              },
              { label: 'Email', value: participant.email || 'Sin cargar' },
              { label: 'Teléfono', value: participant.phone || 'Sin cargar' },
            ]}
          />
        </section>

        <div className="md:col-span-2 space-y-6">
          <section aria-labelledby="participante-historial" className="card">
            <div className="p-4 border-b border-primary-100">
              <h2 id="participante-historial" className="type-h2 text-primary-900">
                Historial deportivo
              </h2>
            </div>
            <div className="p-8 text-center text-primary-600 text-sm">
              <p>El participante aún no pertenece a ningún equipo en la edición actual.</p>
            </div>
          </section>

          <ParticipantDocumentsCard participantId={participant.id} />
        </div>
      </div>
    </div>
  );
}
