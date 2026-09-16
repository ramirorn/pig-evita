// ===========================================
// Encuesta — formas de respuesta (S20)
// ===========================================
//
// Los tipos de este archivo son el contrato que el frontend replica en
// `frontend/src/types/` (AGENTS §4: el backend es la fuente de verdad). Todo lo
// que sale de los endpoints de métricas pasa por acá, incluido el sobre de
// supresión, para que ningún corte suprimido pueda devolverse por accidente con
// un `conteo` adentro.
import {
  CompetitionStage,
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
  SurveyWindow,
} from '@prisma/client';
import { MOTIVO_SUPRESION } from './survey.constants';

/**
 * Corte suprimido por k-anonimato.
 *
 * `conteo: null` y no `0`: el corte existe y tiene respuestas, lo que no se
 * publica es cuántas. Un cero mentiría y además invitaría a sumar los cortes
 * para despejar el faltante.
 */
export interface CorteSuprimido {
  suprimido: true;
  motivo: typeof MOTIVO_SUPRESION;
  conteo: null;
}

/** Corte publicable. */
export interface CorteVisible {
  suprimido: false;
  conteo: number;
}

export type Corte = CorteVisible | CorteSuprimido;

export interface SurveyOptionMetric {
  optionId: string;
  valor: string;
  texto: string;
  orden: number;
  conteo: number;
  /** Porcentaje sobre el total de respuestas de la pregunta, redondeado a 1 decimal. */
  porcentaje: number;
}

export interface SurveyQuestionMetric {
  questionId: string;
  orden: number;
  texto: string;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  activa: boolean;
  /** Respuestas que contestaron esta pregunta (no el total de la campaña). */
  totalRespuestas: number;
  opciones: SurveyOptionMetric[];
}

export interface SurveyMetricsFiltros {
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
  disciplineId?: string;
  disciplineType?: DisciplineType;
  localityId?: string;
}

export interface SurveyMetricsResult {
  campaignId: string;
  titulo: string;
  filtros: SurveyMetricsFiltros;
  /** Umbral de k-anonimato vigente, para que la UI pueda explicarlo. */
  umbral: number;
  totalRespuestas: number;
  suprimido: boolean;
  motivo: typeof MOTIVO_SUPRESION | null;
  /** Vacío cuando el corte está suprimido. */
  preguntas: SurveyQuestionMetric[];
}

export type SurveyFlowEtapaVentana = {
  etapa: CompetitionStage;
  ventana: SurveyWindow;
} & Corte;

export type SurveyFlowDisciplina = {
  disciplineId: string | null;
  disciplina: string | null;
  disciplineType: DisciplineType;
} & Corte;

export type SurveyFlowDisciplinaLocalidad = {
  localityId: string | null;
  localidad: string | null;
  disciplineId: string | null;
  disciplina: string | null;
} & Corte;

export interface SurveyFlowResult {
  campaignId: string;
  titulo: string;
  umbral: number;
  totalRespuestas: number;
  porEtapaVentana: SurveyFlowEtapaVentana[];
  porDisciplina: SurveyFlowDisciplina[];
  porDisciplinaYLocalidad: SurveyFlowDisciplinaLocalidad[];
}

/**
 * Acuse del envío público.
 *
 * No devuelve el `id` de la respuesta a propósito: un id en manos del cliente
 * es un recibo que alguien podría guardar (en localStorage, en un log de
 * analytics) y que volvería a atar un dispositivo a una fila que existe
 * justamente para no estar atada a nadie.
 */
export interface SurveySubmitResult {
  registrada: true;
  enviadaEn: Date;
}
