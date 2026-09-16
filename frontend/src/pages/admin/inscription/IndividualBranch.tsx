// ===========================================
// Rama INDIVIDUAL — un solo participante, con el deporte ya elegido
// ===========================================
import { ArrowLeft } from 'lucide-react';
import { InscriptionStepper } from '../../public/inscription/InscriptionStepper';
import { InscriptionSteps } from '../../public/inscription/InscriptionSteps';
import { useInscriptionWizard } from '../../public/inscription/useInscriptionWizard';

const ETIQUETAS = ['Disciplina', 'Participante', 'Confirmación'] as const;

interface IndividualBranchProps {
  disciplineId: string;
  categoryId: string;
  onVolverASeleccion: () => void;
}

/**
 * Las disciplinas individuales siguen inscribiendo de a una persona: lo único
 * que cambió es que el deporte ya viene elegido del paso 1, así que el
 * asistente de siempre arranca directo en los datos del participante y salta la
 * selección deportiva (`preselection` en `useInscriptionWizard`).
 *
 * Vive en su propio componente —y no en un `if` dentro de la página— porque
 * `useInscriptionWizard` sólo tiene que montarse cuando la disciplina es
 * individual, y un hook no se puede llamar condicionalmente.
 */
export function IndividualBranch({
  disciplineId,
  categoryId,
  onVolverASeleccion,
}: IndividualBranchProps) {
  const wizard = useInscriptionWizard({
    ageSubject: 'La edad del participante',
    logScope: 'DelegateInscriptionPage',
    preselection: { disciplineId, categoryId },
  });

  // El asistente numera 1 (persona), 3 (confirmación) y 4 (credencial), porque
  // su paso 2 es la selección deportiva que acá ya se hizo. La barra muestra
  // tres pasos propios, así que se traduce.
  const pasoVisible = wizard.step === 1 ? 2 : 3;

  return (
    <div className="space-y-6">
      {wizard.step < 4 && (
        <>
          <InscriptionStepper
            step={pasoVisible}
            labels={ETIQUETAS}
            className="max-w-xl mx-auto"
          />
          {wizard.step === 1 && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={onVolverASeleccion}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Cambiar disciplina o categoría
              </button>
            </div>
          )}
        </>
      )}

      <InscriptionSteps wizard={wizard} />
    </div>
  );
}
