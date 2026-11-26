import {
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
} from '@prisma/client';
import {
  AnswerableQuestion,
  answersError,
  isAudienceCompatible,
} from './survey-answers';

const question = (
  id: string,
  over: Partial<AnswerableQuestion> = {},
): AnswerableQuestion => ({
  id,
  texto: `Pregunta ${id}`,
  activa: true,
  obligatoria: false,
  audiencia: SurveyAudience.TODOS,
  kind: SurveyQuestionKind.UNICA,
  options: [{ id: `${id}-a` }, { id: `${id}-b` }],
  ...over,
});

const { INDIVIDUAL, EQUIPO } = DisciplineType;

describe('isAudienceCompatible', () => {
  it('TODOS aplica a cualquier disciplina', () => {
    expect(isAudienceCompatible(SurveyAudience.TODOS, INDIVIDUAL)).toBe(true);
    expect(isAudienceCompatible(SurveyAudience.TODOS, EQUIPO)).toBe(true);
  });

  it('INDIVIDUAL y EQUIPO sólo a su tipo', () => {
    expect(isAudienceCompatible(SurveyAudience.INDIVIDUAL, INDIVIDUAL)).toBe(
      true,
    );
    expect(isAudienceCompatible(SurveyAudience.INDIVIDUAL, EQUIPO)).toBe(false);
    expect(isAudienceCompatible(SurveyAudience.EQUIPO, EQUIPO)).toBe(true);
    expect(isAudienceCompatible(SurveyAudience.EQUIPO, INDIVIDUAL)).toBe(false);
  });
});

describe('answersError', () => {
  it('null para un envío válido', () => {
    expect(
      answersError(
        [question('q1')],
        [{ questionId: 'q1', optionIds: ['q1-a'] }],
        EQUIPO,
      ),
    ).toBeNull();
  });

  it('pregunta ajena o inactiva', () => {
    const msg =
      'Una de las preguntas enviadas no pertenece a esta encuesta o ya no está activa';
    expect(
      answersError(
        [question('q1')],
        [{ questionId: 'otra', optionIds: [] }],
        EQUIPO,
      ),
    ).toBe(msg);
    expect(
      answersError(
        [question('q1', { activa: false })],
        [{ questionId: 'q1', optionIds: ['q1-a'] }],
        EQUIPO,
      ),
    ).toBe(msg);
  });

  it('pregunta repetida', () => {
    expect(
      answersError(
        [question('q1')],
        [
          { questionId: 'q1', optionIds: ['q1-a'] },
          { questionId: 'q1', optionIds: ['q1-b'] },
        ],
        EQUIPO,
      ),
    ).toBe('La pregunta "Pregunta q1" vino repetida en el envío');
  });

  it('audiencia que no corresponde al tipo de disciplina', () => {
    expect(
      answersError(
        [question('q1', { audiencia: SurveyAudience.EQUIPO })],
        [{ questionId: 'q1', optionIds: ['q1-a'] }],
        INDIVIDUAL,
      ),
    ).toBe(
      'La pregunta "Pregunta q1" no corresponde a una disciplina individual',
    );
  });

  it('opción repetida, ajena o de más en una pregunta de opción única', () => {
    const q = [question('q1')];
    expect(
      answersError(
        q,
        [{ questionId: 'q1', optionIds: ['q1-a', 'q1-a'] }],
        EQUIPO,
      ),
    ).toMatch(/dos veces la misma opción/);
    expect(
      answersError(q, [{ questionId: 'q1', optionIds: ['x'] }], EQUIPO),
    ).toMatch(/no pertenece a la pregunta/);
    expect(
      answersError(
        q,
        [{ questionId: 'q1', optionIds: ['q1-a', 'q1-b'] }],
        EQUIPO,
      ),
    ).toBe('La pregunta "Pregunta q1" admite una sola opción');
  });

  it('una pregunta múltiple admite varias opciones', () => {
    expect(
      answersError(
        [question('q1', { kind: SurveyQuestionKind.MULTIPLE })],
        [{ questionId: 'q1', optionIds: ['q1-a', 'q1-b'] }],
        EQUIPO,
      ),
    ).toBeNull();
  });

  it('falta una obligatoria que le toca a esta persona', () => {
    expect(
      answersError([question('q1', { obligatoria: true })], [], EQUIPO),
    ).toBe('Falta responder la pregunta obligatoria "Pregunta q1"');
  });

  it('una obligatoria de otra audiencia o sin opciones no se exige', () => {
    expect(
      answersError(
        [
          question('q1', {
            obligatoria: true,
            audiencia: SurveyAudience.EQUIPO,
          }),
          question('q2', { obligatoria: true, options: [] }),
        ],
        [],
        INDIVIDUAL,
      ),
    ).toBeNull();
  });
});
