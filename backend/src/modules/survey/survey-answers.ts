// ===========================================
// Validación de un envío de la encuesta
// ===========================================
//
// Reglas puras: no tocan la base ni lanzan excepciones de Nest. Devuelven el
// mensaje del rechazo (o `null`) y el service decide la respuesta. El endpoint
// es público, así que todo lo que llega se verifica contra la campaña guardada
// aunque el formulario ya lo haya chequeado.
import {
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
} from '@prisma/client';

/** Lo que hace falta de una pregunta para validar las respuestas. */
export interface AnswerableQuestion {
  id: string;
  texto: string;
  activa: boolean;
  obligatoria: boolean;
  audiencia: SurveyAudience;
  kind: SurveyQuestionKind;
  options: Array<{ id: string }>;
}

/** Una respuesta tal como llega en el envío. */
export interface SubmittedAnswer {
  questionId: string;
  optionIds: string[];
}

/** `TODOS` va siempre; el resto tiene que coincidir con el tipo de disciplina. */
export function isAudienceCompatible(
  audience: SurveyAudience,
  disciplineType: DisciplineType,
): boolean {
  if (audience === SurveyAudience.TODOS) return true;
  return audience === SurveyAudience.INDIVIDUAL
    ? disciplineType === DisciplineType.INDIVIDUAL
    : disciplineType === DisciplineType.EQUIPO;
}

/**
 * Rechazo de un envío, o `null` si es válido: cada pregunta es de la campaña y
 * está activa, no se repite, corresponde al tipo de disciplina, sus opciones
 * son suyas y no se repiten, una pregunta de opción única trae una sola, y no
 * falta ninguna obligatoria que le toque a esta persona.
 */
export function answersError(
  questions: readonly AnswerableQuestion[],
  answers: readonly SubmittedAnswer[],
  disciplineType: DisciplineType,
): string | null {
  const active = questions.filter((q) => q.activa);
  const byId = new Map(active.map((q) => [q.id, q]));
  const seen = new Set<string>();

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) {
      return 'Una de las preguntas enviadas no pertenece a esta encuesta o ya no está activa';
    }

    if (seen.has(question.id)) {
      return `La pregunta "${question.texto}" vino repetida en el envío`;
    }
    seen.add(question.id);

    if (!isAudienceCompatible(question.audiencia, disciplineType)) {
      return `La pregunta "${question.texto}" no corresponde a una disciplina ${disciplineType.toLowerCase()}`;
    }

    if (new Set(answer.optionIds).size !== answer.optionIds.length) {
      return `Se eligió dos veces la misma opción en "${question.texto}"`;
    }

    const validOptions = new Set(question.options.map((o) => o.id));
    if (answer.optionIds.some((id) => !validOptions.has(id))) {
      return `Una de las opciones elegidas no pertenece a la pregunta "${question.texto}"`;
    }

    if (
      question.kind === SurveyQuestionKind.UNICA &&
      answer.optionIds.length !== 1
    ) {
      return `La pregunta "${question.texto}" admite una sola opción`;
    }
  }

  const missing = active.find(
    (q) =>
      q.obligatoria &&
      isAudienceCompatible(q.audiencia, disciplineType) &&
      q.options.length > 0 &&
      !seen.has(q.id),
  );
  if (missing) {
    return `Falta responder la pregunta obligatoria "${missing.texto}"`;
  }

  return null;
}
