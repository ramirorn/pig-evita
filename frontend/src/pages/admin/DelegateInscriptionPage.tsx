// ===========================================
// Delegate Inscription Page — Admin Panel
// Inscripción de participantes por delegados
// ===========================================
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';

import { InscriptionStepper } from '../public/inscription/InscriptionStepper';
import { InscriptionSteps } from '../public/inscription/InscriptionSteps';
import { useInscriptionWizard } from '../public/inscription/useInscriptionWizard';

/**
 * La inscripción del panel de delegados es el mismo asistente que la pública:
 * mismo estado, mismas validaciones, mismos cuatro pasos. Antes estaba
 * duplicado línea por línea acá adentro —incluidos los 60 de la barra de
 * progreso— y las dos copias ya habían empezado a divergir.
 *
 * Lo único propio de esta pantalla es el encabezado del panel y que le habla al
 * delegado sobre un tercero, no al participante sobre sí mismo (`ageSubject`).
 */
export function DelegateInscriptionPage() {
  const { user } = useAuth();
  const wizard = useInscriptionWizard({
    ageSubject: 'La edad del participante',
    logScope: 'DelegateInscriptionPage',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva Inscripción"
        description={`Inscribí participantes como delegado. Responsable: ${user?.firstName} ${user?.lastName}`}
        icon={<UserPlus className="w-5 h-5 text-white" />}
      />

      {/* El paso 4 es la credencial emitida: ahí la barra de progreso sobra. */}
      {wizard.step < 4 && (
        <InscriptionStepper step={wizard.step} className="max-w-xl mx-auto" />
      )}

      <InscriptionSteps wizard={wizard} />
    </div>
  );
}
