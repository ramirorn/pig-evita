// ===========================================
// Participant Detail Page
// ===========================================
import { useParams, useNavigate } from 'react-router';
import { Users, ArrowLeft, Loader2, Calendar, MapPin, Mail, Phone } from 'lucide-react';
import { useParticipant } from '@/hooks/useParticipants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SEX_LABELS, ROUTES } from '@/lib/constants';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

export function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: participant, isLoading } = useParticipant(id || '');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary-800">Participante no encontrado</h2>
        <Button variant="link" onClick={() => navigate(ROUTES.PARTICIPANTS)}>Volver al padrón</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumbs
        items={[
          { label: 'Participantes', path: ROUTES.PARTICIPANTS },
          { label: `${participant.lastName}, ${participant.firstName}` },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(ROUTES.PARTICIPANTS)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary-800">
            {participant.lastName}, {participant.firstName}
          </h1>
          <div className="flex gap-2 text-sm text-primary-500 mt-1">
            <span>DNI: {participant.dni}</span>
            <span>•</span>
            <span>{SEX_LABELS[participant.sex]}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold text-primary-900 border-b border-primary-100 pb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              Datos Personales
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-primary-400 mt-0.5" />
                <div>
                  <p className="text-primary-500 text-xs">Fecha de Nacimiento</p>
                  <p className="font-medium text-primary-900">{new Date(participant.birthDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary-400 mt-0.5" />
                <div>
                  <p className="text-primary-500 text-xs">Ubicación</p>
                  <p className="font-medium text-primary-900">{participant.locality}, {participant.department}</p>
                  {participant.address && <p className="text-primary-600 text-xs mt-0.5">{participant.address}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-primary-400 mt-0.5" />
                <div>
                  <p className="text-primary-500 text-xs">Email</p>
                  <p className="font-medium text-primary-900">{participant.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-primary-400 mt-0.5" />
                <div>
                  <p className="text-primary-500 text-xs">Teléfono</p>
                  <p className="font-medium text-primary-900">{participant.phone || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="card">
            <div className="p-4 border-b border-primary-100">
              <h3 className="font-semibold text-primary-900">Historial Deportivo</h3>
            </div>
            <div className="p-8 text-center text-primary-500 text-sm">
              <p>El participante aún no pertenece a ningún equipo en la edición actual.</p>
            </div>
          </div>

          <div className="card">
            <div className="p-4 border-b border-primary-100 flex justify-between items-center">
              <h3 className="font-semibold text-primary-900">Documentación</h3>
              <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                Pendiente
              </Badge>
            </div>
            <div className="p-8 text-center text-primary-500 text-sm">
              <p>El módulo de documentos se encuentra en construcción.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
