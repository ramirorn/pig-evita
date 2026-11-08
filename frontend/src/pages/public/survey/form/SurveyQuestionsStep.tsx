// ===========================================
// SurveyQuestionsStep — paso 2: el cuestionario
// ===========================================
import { useState } from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { SurveyQuestionCard } from './SurveyQuestionCard';
import type { SurveyWizard } from './useSurveyWizard';

interface SurveyQuestionsStepProps {
  wizard: SurveyWizard;
}

/**
 * Todas las preguntas en una sola página, no una por pantalla.
 *
 * Con mala conexión, una pregunta por pantalla obliga a que el navegador
 * sobreviva ocho transiciones; acá el cuestionario ya está descargado entero y
 * lo único que viaja es el envío final. Además se ve cuánto falta, que es lo
 * que sostiene a alguien que está dudando si terminarla.
 *
 * Sólo se listan las preguntas que le corresponden a la disciplina elegida: la
 * campaña trae las de las tres audiencias y el filtro es de esta pantalla (ver
 * `surveyAudience.ts`).
 */
export function SurveyQuestionsStep({ wizard }: SurveyQuestionsStepProps) {
  const { visibles, respuestas, faltantes, contestadas, enviando } = wizard;

  // Las faltantes se resaltan recién después de que intentó mandar: marcar en
  // rojo lo que todavía no llegó a contestar es regañar por adelantado.
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const idsFaltantes = new Set(faltantes.map((pregunta) => pregunta.id));

  const alEnviar = async () => {
    setIntentoEnvio(true);
    await wizard.confirmarEnvio();

    // La primera obligatoria sin contestar, a la vista. Sin esto, el toast dice
    // que falta una pregunta y la persona tiene que buscarla a ojo.
    const primeraFaltante = faltantes[0];
    if (primeraFaltante) {
      document
        .getElementById(`pregunta-${primeraFaltante.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-14">
      <button
        type="button"
        onClick={wizard.volverAContexto}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary-700 transition-colors duration-120 hover:text-primary-900 active:text-primary-950"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Cambiar de deporte
      </button>

      <p
        className="mt-6 text-sm font-bold text-primary-700 tabular-nums"
        aria-live="polite"
      >
        Contestaste {contestadas} de {visibles.length}
      </p>

      <div
        role="progressbar"
        aria-label="Avance de la encuesta"
        aria-valuemin={0}
        aria-valuemax={visibles.length}
        aria-valuenow={contestadas}
        className="mt-2 h-2 overflow-hidden rounded-full bg-primary-100"
      >
        <div
          className="h-full rounded-full bg-secondary-600 transition-[width] duration-320 ease-out-soft motion-reduce:transition-none"
          style={{ width: `${visibles.length > 0 ? (contestadas / visibles.length) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-4 space-y-5">
        {visibles.map((pregunta, indice) => (
          <SurveyQuestionCard
            key={pregunta.id}
            pregunta={pregunta}
            numero={indice + 1}
            total={visibles.length}
            elegidas={respuestas[pregunta.id] ?? []}
            onElegir={(optionId) =>
              wizard.responder(pregunta.id, optionId, pregunta.kind)
            }
            resaltarFalta={intentoEnvio && idsFaltantes.has(pregunta.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => void alEnviar()}
        disabled={enviando}
        className="group mt-10 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-800 px-8 py-4 text-base font-bold text-white transition-[background-color,box-shadow,transform] duration-200 ease-out-soft hover:bg-primary-900 hover:shadow-lg active:scale-[0.98] active:duration-120 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {enviando ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Mandando…
          </>
        ) : (
          <>
            Mandar mis respuestas
            <Send className="h-5 w-5" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="mt-4 text-center text-sm leading-relaxed text-primary-600">
        Si se corta la señal justo cuando las mandás, tus respuestas quedan
        guardadas en este teléfono y se envían solas más tarde.
      </p>
    </div>
  );
}
