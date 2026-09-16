// ===========================================
// InscriptionStepper — barra de progreso del asistente
// ===========================================
import { Check } from 'lucide-react';

/**
 * Los tres pasos por defecto. El cuarto (la credencial) no aparece: cuando se
 * llega, la barra ya no se muestra.
 */
const STEPS_POR_DEFECTO = ['Participante', 'Disciplina', 'Confirmación'];

interface InscriptionStepperProps {
  /** 1-indexado. Cualquier valor por encima del último paso pinta la barra llena. */
  step: number;
  /**
   * Etiquetas de los pasos visibles.
   *
   * El alta de plantel recorre otros pasos que la inscripción de una sola
   * persona ("Disciplina → Plantel → Confirmación" en vez de "Participante →
   * Disciplina → Confirmación"), y la barra tiene que decir la verdad sobre
   * dónde está parado el que la mira.
   */
  labels?: readonly string[];
  /**
   * Clases del contenedor. La inscripción pública lo cuelga de un encabezado y
   * necesita el `mt-8`; el panel de delegados lo pega al `PageHeader`, que ya
   * trae su propia separación.
   */
  className?: string;
}

export function InscriptionStepper({
  step,
  labels = STEPS_POR_DEFECTO,
  className = 'max-w-xl mx-auto mt-8',
}: InscriptionStepperProps) {
  const total = labels.length;
  // El ancho es un porcentaje calculado, no una clase: interpolar
  // `w-[${n}%]` en Tailwind no genera nada (regla D1 de `plan-ui-publica.md`).
  const avance = total > 1 ? Math.min(Math.max(step - 1, 0), total - 1) / (total - 1) : 1;

  return (
    <div className={className}>
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-100 w-full z-0" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-secondary-500 transition-all duration-300 z-0"
          style={{ width: `${avance * 100}%` }}
        />

        {labels.map((label, indice) => {
          const number = indice + 1;
          // El último paso se pinta sólo cuando se está parado en él: no hay un
          // "paso 4" que lo deje en estado completado.
          const isLast = number === total;
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
