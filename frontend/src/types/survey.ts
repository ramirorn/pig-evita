// ===========================================
// Encuesta de salud mental (S20)
// ===========================================
import { CompetitionStage } from './enums';

// ============ ENCUESTA DE SALUD MENTAL (S20) ============
//
// Réplica manual del contrato de `backend/src/modules/survey/` (AGENTS §4: el
// backend es la fuente de verdad y acá no hay generación automática).

/** Momento de la competencia en el que se responde. */
export enum SurveyWindow {
  PRE = 'PRE',
  DURANTE = 'DURANTE',
  POST = 'POST',
}

/** Ciclo de vida de una campaña. Las transiciones son endpoints propios. */
export enum SurveyCampaignStatus {
  BORRADOR = 'BORRADOR',
  ACTIVA = 'ACTIVA',
  CERRADA = 'CERRADA',
}

/** `UNICA` admite exactamente una opción; `MULTIPLE`, una o más. */
export enum SurveyQuestionKind {
  UNICA = 'UNICA',
  MULTIPLE = 'MULTIPLE',
}

/**
 * A quién se le muestra una pregunta.
 *
 * `INDIVIDUAL` y `EQUIPO` se contrastan contra el `DisciplineType` de la
 * disciplina que eligió quien responde. El endpoint público devuelve **las tres
 * audiencias juntas** —cuando se pide el cuestionario todavía no se sabe qué
 * disciplina va a elegir—, así que el filtrado ocurre en pantalla y el servidor
 * lo revalida al recibir el envío.
 */
export enum SurveyAudience {
  TODOS = 'TODOS',
  INDIVIDUAL = 'INDIVIDUAL',
  EQUIPO = 'EQUIPO',
}

export interface SurveyOption {
  id: string;
  questionId: string;
  orden: number;
  texto: string;
  /**
   * Slug estable en snake_case. Es la clave con la que se agregan las métricas:
   * el `texto` se puede reescribir, `valor` no.
   */
  valor: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  campaignId: string;
  orden: number;
  texto: string;
  ayuda?: string | null;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  obligatoria: boolean;
  activa: boolean;
  createdAt: string;
  updatedAt: string;
  /** Presente en `GET /survey/active` y en el detalle de campaña. */
  options?: SurveyOption[];
}

/** Pregunta tal como llega en un cuestionario: siempre con sus opciones. */
export type SurveyQuestionWithOptions = SurveyQuestion & {
  options: SurveyOption[];
};

export interface SurveyCampaign {
  id: string;
  titulo: string;
  descripcion?: string | null;
  anio: number;
  status: SurveyCampaignStatus;
  ventana: SurveyWindow;
  /** `null` = la campaña sirve para cualquier etapa. */
  etapa?: CompetitionStage | null;
  abreEn?: string | null;
  cierraEn?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: SurveyQuestion[];
  /**
   * Sólo en el **listado** (`questions` + `responses`) y en el detalle
   * (`responses`). Mismo patrón que `Discipline._count`. `responses` viene de
   * a 5 (como en Métricas): los números exactos viven sólo en Métricas.
   */
  _count?: {
    questions?: number;
    responses?: number;
  };
  /** Listado y detalle: si la campaña ya recibió alguna respuesta. */
  tieneRespuestas?: boolean;
  /**
   * Sólo en el detalle: ids de las opciones que alguien ya eligió, sin cuántas
   * veces. Lo usa el editor para no ofrecer borrar una opción con respuestas.
   */
  opcionesElegidas?: string[];
}

/** Campaña con su cuestionario completo (detalle admin y `GET /survey/active`). */
export type SurveyCampaignWithQuestions = SurveyCampaign & {
  questions: SurveyQuestionWithOptions[];
};

/**
 * Acuse del envío público.
 *
 * ⚠️ **No trae `id` y no es un olvido.** Un identificador de respuesta en manos
 * del cliente es un recibo que ata un dispositivo a una fila que existe
 * justamente para no estar atada a nadie. Por eso la pantalla de cierre no
 * puede —ni debe— ofrecer "ver mis respuestas".
 */
export interface SurveySubmitResult {
  registrada: true;
  enviadaEn: string;
}

/** Motivo único de supresión por k-anonimato. */
export const MOTIVO_SUPRESION_ENCUESTA = 'MUESTRA_INSUFICIENTE';
export type MotivoSupresionEncuesta = typeof MOTIVO_SUPRESION_ENCUESTA;

/**
 * Corte de métricas que no se publica porque tiene menos respuestas que el
 * umbral de k-anonimato.
 *
 * `conteo: null` y no `0`: el corte existe y tiene respuestas, lo que no se
 * publica es cuántas. La UI tiene que decir **que está suprimido y por qué**;
 * pintarlo como cero miente e invita a sumar los cortes para despejarlo.
 */
export interface CorteSuprimido {
  suprimido: true;
  motivo: MotivoSupresionEncuesta;
  conteo: null;
}

export interface CorteVisible {
  suprimido: false;
  conteo: number;
}

export type CorteEncuesta = CorteVisible | CorteSuprimido;
