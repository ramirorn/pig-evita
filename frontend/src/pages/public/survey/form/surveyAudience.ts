// ===========================================
// surveyAudience — qué preguntas se muestran, y qué respuestas sobreviven
// ===========================================
import {
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
  type SurveyQuestionWithOptions,
} from '@/types';

/**
 * Respuestas elegidas, indexadas por pregunta.
 *
 * Un `Record` y no un arreglo porque la operación que más se hace es "¿qué
 * eligió en esta pregunta?" mientras se pinta el cuestionario.
 */
export type RespuestasPorPregunta = Record<string, string[]>;

/**
 * Preguntas que le corresponden a quien compite en una disciplina de este tipo.
 *
 * `GET /survey/active` devuelve **las tres audiencias juntas** —cuando se pide
 * el cuestionario todavía no se sabe qué disciplina va a elegir la persona—,
 * así que el filtro es responsabilidad de esta pantalla. El servidor lo vuelve
 * a verificar al recibir el envío: acá se filtra para que el formulario tenga
 * sentido, no como control.
 *
 * Mientras no haya disciplina elegida (`null`) sólo se pueden mostrar las de
 * `TODOS`: mostrar las ramificadas antes de saber la rama sería adivinar.
 *
 * Se filtra además por `activa` y se respeta el `orden` del backend.
 */
export function preguntasVisibles(
  preguntas: readonly SurveyQuestionWithOptions[],
  disciplineType: DisciplineType | null,
): SurveyQuestionWithOptions[] {
  return preguntas
    .filter((pregunta) => {
      if (!pregunta.activa) return false;
      if (pregunta.audiencia === SurveyAudience.TODOS) return true;
      if (disciplineType === null) return false;
      return pregunta.audiencia === audienciaDe(disciplineType);
    })
    .slice()
    .sort((a, b) => a.orden - b.orden);
}

/** La audiencia que le toca a un tipo de disciplina. */
function audienciaDe(disciplineType: DisciplineType): SurveyAudience {
  return disciplineType === DisciplineType.EQUIPO
    ? SurveyAudience.EQUIPO
    : SurveyAudience.INDIVIDUAL;
}

/**
 * Descarta las respuestas de preguntas que ya no se muestran.
 *
 * ⚠️ **Es la función que cierra el bug de la rama equivocada.** Alguien elige
 * Atletismo, contesta las dos preguntas de deportes individuales, vuelve atrás
 * y cambia a Handball: sin esta poda, esas dos respuestas siguen en el estado y
 * viajan en el envío. El backend las rechaza —revalida la audiencia contra el
 * `disciplineType`— y el chico se come un 400 que no sabe cómo arreglar,
 * después de haber completado toda la encuesta.
 *
 * Poda también las opciones que ya no existen en la pregunta: el borrador puede
 * venir de una sesión de ayer y el panel pudo haber editado el cuestionario.
 *
 * Devuelve un objeto nuevo; no toca el que recibe.
 */
export function podarRespuestas(
  respuestas: RespuestasPorPregunta,
  visibles: readonly SurveyQuestionWithOptions[],
): RespuestasPorPregunta {
  const podadas: RespuestasPorPregunta = {};

  for (const pregunta of visibles) {
    const elegidas = respuestas[pregunta.id];
    if (!elegidas || elegidas.length === 0) continue;

    const idsValidos = new Set(pregunta.options.map((opcion) => opcion.id));
    const sobreviven = elegidas.filter((id) => idsValidos.has(id));
    if (sobreviven.length === 0) continue;

    // Una `UNICA` con dos opciones guardadas es un borrador de cuando la
    // pregunta era `MULTIPLE`: se queda con la primera que siga existiendo.
    podadas[pregunta.id] =
      pregunta.kind === SurveyQuestionKind.UNICA
        ? sobreviven.slice(0, 1)
        : sobreviven;
  }

  return podadas;
}

/**
 * Aplica la elección de una opción según el tipo de pregunta.
 *
 * `UNICA` reemplaza; `MULTIPLE` alterna. Devuelve el arreglo nuevo de opciones
 * elegidas para esa pregunta.
 */
export function alternarOpcion(
  elegidas: readonly string[],
  optionId: string,
  kind: SurveyQuestionKind,
): string[] {
  if (kind === SurveyQuestionKind.UNICA) {
    return elegidas[0] === optionId ? [] : [optionId];
  }

  return elegidas.includes(optionId)
    ? elegidas.filter((id) => id !== optionId)
    : [...elegidas, optionId];
}

/**
 * Preguntas obligatorias que todavía no tienen respuesta.
 *
 * Se evalúa sobre las **visibles**: una obligatoria de la rama que no
 * corresponde no bloquea nada.
 */
export function obligatoriasSinResponder(
  visibles: readonly SurveyQuestionWithOptions[],
  respuestas: RespuestasPorPregunta,
): SurveyQuestionWithOptions[] {
  return visibles.filter(
    (pregunta) =>
      pregunta.obligatoria && (respuestas[pregunta.id]?.length ?? 0) === 0,
  );
}

/** Pasa el estado de la pantalla a la forma que espera el endpoint. */
export function aRespuestasPayload(
  visibles: readonly SurveyQuestionWithOptions[],
  respuestas: RespuestasPorPregunta,
): Array<{ questionId: string; optionIds: string[] }> {
  return visibles
    .map((pregunta) => ({
      questionId: pregunta.id,
      optionIds: respuestas[pregunta.id] ?? [],
    }))
    .filter((respuesta) => respuesta.optionIds.length > 0);
}
