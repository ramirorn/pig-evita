// ===========================================
// InscriptionStepper — barra de progreso del asistente
// ===========================================
import { Check } from 'lucide-react';
import type { WizardStep } from './useInscriptionWizard';

/**
 * Los tres pasos visibles. El paso 4 (credencial) no aparece: cuando se llega,
 * la barra ya no se muestra.
 */
const STEPS = [
  { number: 1, label: 'Participante' },
  { number: 2, label: 'Disciplina' },
  { number: 3, label: 'Confirmación' },
] as const;

const PROGRESS_WIDTH: Record<WizardStep, string> = {
  1: '0%',
  2: '50%',
  3: '100%',
  4: '100%',
};

export function InscriptionStepper({ step }: { step: WizardStep }) {
  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-100 w-full z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-secondary-500 transition-all duration-300 z-0"
          style={{ width: PROGRESS_WIDTH[step] }}
        />

        {STEPS.map(({ number, label }) => {
          // El último paso se pinta sólo cuando se está parado en él: no hay un
          // "paso 4" que lo deje en estado completado.
          const isLast = number === STEPS.length;
          const isReached = isLast ? step === number : step >= number;
          const isCompleted = !isLast && step > number;

          return (
            <div key={number} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isReached
                    ? 'bg-primary-800 text-white ring-4 ring-primary-50'
                    : 'bg-white border-2 border-primary-200 text-primary-400'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4 text-accent-400" /> : number}
              </div>
              <span className="text-[11px] font-semibold text-primary-700 mt-2">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
