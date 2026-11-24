// ===========================================
// Encuesta — preguntas e indicadores que pidió la Secretaría
// ===========================================
//
// Lo comparten `seed.ts` (cuestionario borrador de una base nueva) y
// `seed-survey-responses.ts` (demo de métricas sobre una base existente).
//
// Salen de la reunión con la Secretaría de Deportes: además de lo psicológico,
// la encuesta tiene que mostrar **salud** ("si te lesionaste, dónde te
// atendieron", "había traumatólogo, había placa") y **educación** ("qué vas a
// seguir después del secundario"), para llevar esos números a otros
// ministerios y comparar interior con capital.
//
// ⚠️ Los `valor` son únicos en todo el cuestionario, no sólo dentro de su
// pregunta: los KPIs matchean por `valor`, y un "si" o un "no" genéricos se
// confundirían con los de otra pregunta.
import { SurveyAudience, SurveyQuestionKind } from '@prisma/client';

export const VALORES = {
  NO_ME_LESIONE: 'no_me_lesione',
  LESION_ATENDIDO_EN_SEDE: 'lesion_atendido_en_sede',
  LESION_DERIVADO: 'lesion_derivado',
  LESION_SIN_ATENCION: 'lesion_sin_atencion',
  HABIA_ATENCION_MEDICA: 'habia_atencion_medica',
  NO_HABIA_ATENCION_MEDICA: 'no_habia_atencion_medica',
  NO_SE_ATENCION_MEDICA: 'no_se_atencion_medica',
  SEGUIR_ESTUDIANDO: 'seguir_estudiando',
  ESTUDIAR_Y_TRABAJAR: 'estudiar_y_trabajar',
  SOLO_TRABAJAR: 'solo_trabajar',
  NO_SE_ESTUDIOS: 'no_se_estudios',
  NEC_TRANSPORTE: 'nec_transporte',
  NEC_INDUMENTARIA: 'nec_indumentaria',
  NEC_ENTRENADOR: 'nec_entrenador',
  NEC_LUGAR_ENTRENAR: 'nec_lugar_entrenar',
  NEC_ATENCION_MEDICA: 'nec_atencion_medica',
  NEC_BECA_ESTUDIO: 'nec_beca_estudio',
  NEC_ALIMENTACION: 'nec_alimentacion',
} as const;

export interface PreguntaSemilla {
  orden: number;
  audiencia: SurveyAudience;
  kind: SurveyQuestionKind;
  texto: string;
  opciones: { texto: string; valor: string }[];
}

/**
 * Ordinales 9 a 12: van después del bloque psicológico del borrador. La 12
 * (necesidades) sostiene el destacado "Lo que más necesitan los deportistas
 * es:"; sin una pregunta así el panel no tiene de dónde afirmarlo.
 */
export const PREGUNTAS_SALUD_Y_EDUCACION: PreguntaSemilla[] = [
  {
    orden: 9,
    audiencia: SurveyAudience.TODOS,
    kind: SurveyQuestionKind.UNICA,
    texto: '¿Te lesionaste durante los Juegos?',
    opciones: [
      { texto: 'No me lesioné', valor: VALORES.NO_ME_LESIONE },
      {
        texto: 'Sí, y me atendieron en la sede',
        valor: VALORES.LESION_ATENDIDO_EN_SEDE,
      },
      {
        texto: 'Sí, y me llevaron a un hospital o centro de salud',
        valor: VALORES.LESION_DERIVADO,
      },
      { texto: 'Sí, y nadie me atendió', valor: VALORES.LESION_SIN_ATENCION },
    ],
  },
  {
    orden: 10,
    audiencia: SurveyAudience.TODOS,
    kind: SurveyQuestionKind.UNICA,
    texto: 'Donde compitieron, ¿había médico, traumatólogo o radiografías?',
    opciones: [
      { texto: 'Sí, había', valor: VALORES.HABIA_ATENCION_MEDICA },
      { texto: 'No había', valor: VALORES.NO_HABIA_ATENCION_MEDICA },
      { texto: 'No lo sé', valor: VALORES.NO_SE_ATENCION_MEDICA },
    ],
  },
  {
    orden: 11,
    audiencia: SurveyAudience.TODOS,
    kind: SurveyQuestionKind.UNICA,
    texto: 'Cuando termines el secundario, ¿qué pensás hacer?',
    opciones: [
      { texto: 'Seguir estudiando', valor: VALORES.SEGUIR_ESTUDIANDO },
      { texto: 'Estudiar y trabajar', valor: VALORES.ESTUDIAR_Y_TRABAJAR },
      { texto: 'Sólo trabajar', valor: VALORES.SOLO_TRABAJAR },
      { texto: 'Todavía no lo sé', valor: VALORES.NO_SE_ESTUDIOS },
    ],
  },
  {
    orden: 12,
    audiencia: SurveyAudience.TODOS,
    kind: SurveyQuestionKind.MULTIPLE,
    texto: '¿Qué es lo que más necesitás para seguir haciendo deporte?',
    opciones: [
      { texto: 'Transporte para ir a entrenar', valor: VALORES.NEC_TRANSPORTE },
      { texto: 'Ropa o calzado deportivo', valor: VALORES.NEC_INDUMENTARIA },
      { texto: 'Un entrenador o profe', valor: VALORES.NEC_ENTRENADOR },
      {
        texto: 'Un lugar donde entrenar cerca',
        valor: VALORES.NEC_LUGAR_ENTRENAR,
      },
      { texto: 'Atención médica', valor: VALORES.NEC_ATENCION_MEDICA },
      {
        texto: 'Una beca para estudiar',
        valor: VALORES.NEC_BECA_ESTUDIO,
      },
      {
        texto: 'Comida durante los entrenamientos',
        valor: VALORES.NEC_ALIMENTACION,
      },
    ],
  },
];

const LESIONADOS = [
  VALORES.LESION_ATENDIDO_EN_SEDE,
  VALORES.LESION_DERIVADO,
  VALORES.LESION_SIN_ATENCION,
];

/**
 * Indicadores reutilizables (sin campaña): se evalúan sobre la campaña que se
 * esté mirando. Se identifican por `nombre` para que el seed sea idempotente.
 */
export const KPIS_SEMILLA = [
  {
    nombre: 'Lesionados que recibieron atención',
    descripcion:
      'De quienes se lesionaron, cuántos fueron atendidos en la sede o derivados a un centro de salud.',
    orden: 0,
    definicion: {
      numerador: [
        { valores: [VALORES.LESION_ATENDIDO_EN_SEDE, VALORES.LESION_DERIVADO] },
      ],
      denominador: [{ valores: LESIONADOS }],
      formato: 'porcentaje',
    },
  },
  {
    nombre: 'Lesionados sin atención',
    descripcion:
      'De quienes se lesionaron, cuántos dicen que nadie los atendió. Es el número para llevar a Salud.',
    orden: 1,
    definicion: {
      numerador: [{ valores: [VALORES.LESION_SIN_ATENCION] }],
      denominador: [{ valores: LESIONADOS }],
      formato: 'porcentaje',
    },
  },
  {
    nombre: 'Sedes sin atención médica',
    descripcion:
      'Participantes que compitieron donde no había médico, traumatólogo ni radiografías.',
    orden: 2,
    definicion: {
      numerador: [{ valores: [VALORES.NO_HABIA_ATENCION_MEDICA] }],
      denominador: 'contestaron',
      formato: 'porcentaje',
    },
  },
  {
    nombre: 'Intención de seguir estudiando',
    descripcion:
      'Participantes que piensan seguir estudiando al terminar el secundario (solo o junto con un trabajo).',
    orden: 3,
    definicion: {
      numerador: [
        { valores: [VALORES.SEGUIR_ESTUDIANDO, VALORES.ESTUDIAR_Y_TRABAJAR] },
      ],
      denominador: 'contestaron',
      formato: 'porcentaje',
    },
  },
] as const;

/**
 * Destacados reutilizables del panel. Se identifican por `titulo` para que el
 * seed sea idempotente y no pise lo que se edite desde el panel.
 */
export const DESTACADOS_SEMILLA = [
  {
    titulo: 'Lo que más necesitan los deportistas es:',
    descripcion:
      'Las necesidades que más eligieron quienes respondieron la encuesta.',
    orden: 0,
    definicion: {
      opciones: [
        VALORES.NEC_TRANSPORTE,
        VALORES.NEC_INDUMENTARIA,
        VALORES.NEC_ENTRENADOR,
        VALORES.NEC_LUGAR_ENTRENAR,
        VALORES.NEC_ATENCION_MEDICA,
        VALORES.NEC_BECA_ESTUDIO,
        VALORES.NEC_ALIMENTACION,
      ],
      top: 3,
    },
  },
] as const;
