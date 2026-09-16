// ===========================================
// SurveyAudienceBalance — cuántas preguntas ve cada chico (S20)
// ===========================================
import { Scale } from 'lucide-react';
import type { SurveyQuestionWithOptions } from '@/types';
import { balanceAudiencias } from './surveyRules';

interface SurveyAudienceBalanceProps {
  questions: readonly SurveyQuestionWithOptions[];
}

/**
 * El cuestionario no es uno solo: es uno por rama. Quien compite en atletismo y
 * quien compite en vóley ven las preguntas comunes más las de su propia rama, y
 * el diseño previsto es 6 comunes + 2 por rama = 8 preguntas por deportista.
 *
 * Esta cuenta existe porque el desbalance no se nota mirando la lista: hay que
 * contar a mano cuántas son de cada audiencia. Sin esto, agregar dos preguntas
 * "de equipo" y ninguna "individual" pasa inadvertido hasta que se comparan dos
 * celulares en la cancha.
 */
export function SurveyAudienceBalance({ questions }: SurveyAudienceBalanceProps) {
  const balance = balanceAudiencias(questions);

  if (questions.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary-100 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary-900">
        <Scale className="h-4 w-4 text-primary-500" aria-hidden="true" />
        Cuántas preguntas ve cada chico
      </h3>

      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-primary-50/70 px-3 py-2">
          <dt className="text-xs font-medium text-primary-600">Las ven todos</dt>
          <dd className="text-lg font-bold text-primary-900 tabular-nums">{balance.todos}</dd>
        </div>
        <div className="rounded-lg bg-primary-50/70 px-3 py-2">
          <dt className="text-xs font-medium text-primary-600">
            Deportes individuales
          </dt>
          <dd className="text-lg font-bold text-primary-900 tabular-nums">
            {balance.totalIndividual}
            <span className="ml-1 text-xs font-medium text-primary-500">
              ({balance.todos} + {balance.individual} propias)
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-primary-50/70 px-3 py-2">
          <dt className="text-xs font-medium text-primary-600">Deportes de equipo</dt>
          <dd className="text-lg font-bold text-primary-900 tabular-nums">
            {balance.totalEquipo}
            <span className="ml-1 text-xs font-medium text-primary-500">
              ({balance.todos} + {balance.equipo} propias)
            </span>
          </dd>
        </div>
      </dl>

      {balance.desbalanceado && (
        <p className="mt-3 rounded-lg border border-accent-300 bg-accent-50 px-3 py-2 text-xs leading-relaxed text-accent-800">
          Las dos ramas no contestan la misma cantidad de preguntas
          ({balance.totalIndividual} contra {balance.totalEquipo}). No es un
          error —la encuesta funciona igual—, pero después cuesta comparar los
          resultados entre ramas.
        </p>
      )}
    </div>
  );
}
