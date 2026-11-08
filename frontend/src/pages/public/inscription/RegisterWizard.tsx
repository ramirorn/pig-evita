// ===========================================
// RegisterWizard — cuerpo de la pestaña "Nueva Inscripción"
// ===========================================
import { InscriptionStepper } from './InscriptionStepper';
import { InscriptionSteps } from './InscriptionSteps';
import type { InscriptionWizard } from './useInscriptionWizard';

/**
 * El encabezado público de la inscripción más los pasos del asistente. Los
 * pasos en sí viven en `InscriptionSteps` porque son los mismos que usa el
 * panel de delegados; acá queda sólo lo que es propio de la cara pública.
 */
export function RegisterWizard({ wizard }: { wizard: InscriptionWizard }) {
  const { step } = wizard;

  return (
    <div>
      {step < 4 && (
        <div className="mb-8 text-center">
          <h1 className="type-h1 text-primary-800 mb-2">
            Inscripción a los Juegos Evita
          </h1>
          <p className="text-primary-600 max-w-lg mx-auto text-sm">
            Completá tus datos para obtener tu credencial oficial y participar en las etapas de competencia provincial.
          </p>

          <InscriptionStepper step={step} />
        </div>
      )}

      {/* Con la credencial emitida el encabezado grande se va; la página igual
          necesita su único h1. */}
      {step >= 4 && <h1 className="sr-only">Inscripción a los Juegos Evita</h1>}

      <InscriptionSteps wizard={wizard} />
    </div>
  );
}
