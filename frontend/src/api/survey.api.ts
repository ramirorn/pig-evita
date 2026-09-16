// ===========================================
// Survey API (S20)
// ===========================================
import apiClient from './client';
import type {
  CompetitionStage,
  DisciplineType,
  PaginatedResponse,
  Sex,
  SurveyAudience,
  SurveyCampaign,
  SurveyCampaignStatus,
  SurveyCampaignWithQuestions,
  SurveyFlowResult,
  SurveyMetricsResult,
  SurveyOption,
  SurveyQuestion,
  SurveyQuestionKind,
  SurveySubmitResult,
  SurveyWindow,
} from '@/types';

// ===========================================
// Público
// ===========================================

export interface ActiveSurveyFilters {
  /** Etapa en la que compite quien responde. Vacío = cualquiera. */
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
}

export interface SurveyAnswerPayload {
  questionId: string;
  /** Exactamente una si la pregunta es `UNICA`; una o más si es `MULTIPLE`. */
  optionIds: string[];
}

/**
 * Envío anónimo.
 *
 * ⚠️ No hay —ni puede haber— `participantId`, `dni`, `email` ni nada que
 * identifique a quien responde: contestan menores de edad sobre su salud
 * mental. Los cortes que sí viajan (disciplina, localidad, categoría, sexo) son
 * demográficos gruesos, y el endpoint de métricas los suprime cuando la muestra
 * es chica. La `ventana` no se manda: la decide la campaña.
 */
export interface SubmitSurveyResponsePayload {
  campaignId: string;
  etapa: CompetitionStage;
  /**
   * Sale de la disciplina elegida, no se le pregunta a quien responde: decide
   * qué preguntas de audiencia `INDIVIDUAL`/`EQUIPO` son válidas, y el servidor
   * rechaza el envío si no coinciden.
   */
  disciplineType: DisciplineType;
  disciplineId?: string;
  localityId?: string;
  categoryId?: string;
  sexo?: Sex;
  respuestas: SurveyAnswerPayload[];
}

// ===========================================
// Admin
// ===========================================

export interface SurveyCampaignFilters {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'anio' | 'titulo' | 'status';
  sortOrder?: 'asc' | 'desc';
  /** Búsqueda server-side sobre el título. */
  search?: string;
  anio?: number;
  status?: SurveyCampaignStatus;
  ventana?: SurveyWindow;
  etapa?: CompetitionStage;
}

export interface CreateSurveyCampaignPayload {
  titulo: string;
  descripcion?: string;
  anio: number;
  ventana: SurveyWindow;
  /** Vacío = la campaña sirve para cualquier etapa. */
  etapa?: CompetitionStage;
  abreEn?: string;
  cierraEn?: string;
}

/**
 * `status` no está a propósito: publicar y cerrar son endpoints propios que
 * validan las transiciones (no se activa una campaña sin preguntas, no se
 * reabre una cerrada). Un `PATCH { status }` las salteaba.
 */
export type UpdateSurveyCampaignPayload = Partial<CreateSurveyCampaignPayload>;

export interface CreateSurveyOptionPayload {
  texto: string;
  /**
   * Slug snake_case, sin acentos (`no_se_que_es`). **No cambiarlo al reescribir
   * el texto**: es la clave con la que se agregan las métricas históricas.
   */
  valor: string;
  orden?: number;
}

export type UpdateSurveyOptionPayload = Partial<CreateSurveyOptionPayload>;

export interface CreateSurveyQuestionPayload {
  texto: string;
  ayuda?: string;
  kind?: SurveyQuestionKind;
  audiencia?: SurveyAudience;
  obligatoria?: boolean;
  activa?: boolean;
  orden?: number;
  /** Opciones creadas junto con la pregunta: es el camino normal del panel. */
  opciones?: CreateSurveyOptionPayload[];
}

/** La edición de pregunta no acepta `opciones`: cada opción tiene su endpoint. */
export type UpdateSurveyQuestionPayload = Partial<
  Omit<CreateSurveyQuestionPayload, 'opciones'>
>;

export interface SurveyMetricsFilters {
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
  disciplineId?: string;
  disciplineType?: DisciplineType;
  localityId?: string;
}

export const surveyApi = {
  // ---------- Público ----------

  /**
   * Cuestionario vigente, o `null` si no hay ninguno abierto.
   *
   * `null` es un estado normal del sitio —todavía no se publicó la campaña— y
   * no un error: el backend nunca responde 404 acá, así que el consumidor
   * distingue "no hay encuesta" de "no se pudo pedir la encuesta".
   */
  async findActive(
    filters?: ActiveSurveyFilters,
  ): Promise<SurveyCampaignWithQuestions | null> {
    const { data } = await apiClient.get<SurveyCampaignWithQuestions | null>(
      '/survey/active',
      { params: filters },
    );
    return data;
  },

  async submitResponse(
    payload: SubmitSurveyResponsePayload,
  ): Promise<SurveySubmitResult> {
    const { data } = await apiClient.post<SurveySubmitResult>(
      '/survey/responses',
      payload,
    );
    return data;
  },

  // ---------- Campañas (admin) ----------

  async findAllCampaigns(
    filters?: SurveyCampaignFilters,
  ): Promise<PaginatedResponse<SurveyCampaign>> {
    const { data } = await apiClient.get<PaginatedResponse<SurveyCampaign>>(
      '/survey/campaigns',
      { params: filters },
    );
    return data;
  },

  async findCampaign(id: string): Promise<SurveyCampaignWithQuestions> {
    const { data } = await apiClient.get<SurveyCampaignWithQuestions>(
      `/survey/campaigns/${id}`,
    );
    return data;
  },

  async createCampaign(
    payload: CreateSurveyCampaignPayload,
  ): Promise<SurveyCampaign> {
    const { data } = await apiClient.post<SurveyCampaign>(
      '/survey/campaigns',
      payload,
    );
    return data;
  },

  async updateCampaign(
    id: string,
    payload: UpdateSurveyCampaignPayload,
  ): Promise<SurveyCampaign> {
    const { data } = await apiClient.patch<SurveyCampaign>(
      `/survey/campaigns/${id}`,
      payload,
    );
    return data;
  },

  /** Sólo si la campaña no tiene respuestas cargadas (el backend lo verifica). */
  async removeCampaign(id: string): Promise<void> {
    await apiClient.delete(`/survey/campaigns/${id}`);
  },

  async publishCampaign(id: string): Promise<SurveyCampaign> {
    const { data } = await apiClient.post<SurveyCampaign>(
      `/survey/campaigns/${id}/publish`,
    );
    return data;
  },

  async closeCampaign(id: string): Promise<SurveyCampaign> {
    const { data } = await apiClient.post<SurveyCampaign>(
      `/survey/campaigns/${id}/close`,
    );
    return data;
  },

  // ---------- Preguntas y opciones (admin) ----------

  async createQuestion(
    campaignId: string,
    payload: CreateSurveyQuestionPayload,
  ): Promise<SurveyQuestion> {
    const { data } = await apiClient.post<SurveyQuestion>(
      `/survey/campaigns/${campaignId}/questions`,
      payload,
    );
    return data;
  },

  async updateQuestion(
    campaignId: string,
    questionId: string,
    payload: UpdateSurveyQuestionPayload,
  ): Promise<SurveyQuestion> {
    const { data } = await apiClient.patch<SurveyQuestion>(
      `/survey/campaigns/${campaignId}/questions/${questionId}`,
      payload,
    );
    return data;
  },

  async removeQuestion(campaignId: string, questionId: string): Promise<void> {
    await apiClient.delete(
      `/survey/campaigns/${campaignId}/questions/${questionId}`,
    );
  },

  async createOption(
    campaignId: string,
    questionId: string,
    payload: CreateSurveyOptionPayload,
  ): Promise<SurveyOption> {
    const { data } = await apiClient.post<SurveyOption>(
      `/survey/campaigns/${campaignId}/questions/${questionId}/options`,
      payload,
    );
    return data;
  },

  /**
   * La ruta lleva la pregunta además de la opción
   * (`.../questions/:questionId/options/:optionId`), tal como la declara
   * `survey.controller.ts`: la opción se identifica **dentro** de su pregunta.
   */
  async updateOption(
    campaignId: string,
    questionId: string,
    optionId: string,
    payload: UpdateSurveyOptionPayload,
  ): Promise<SurveyOption> {
    const { data } = await apiClient.patch<SurveyOption>(
      `/survey/campaigns/${campaignId}/questions/${questionId}/options/${optionId}`,
      payload,
    );
    return data;
  },

  async removeOption(
    campaignId: string,
    questionId: string,
    optionId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/survey/campaigns/${campaignId}/questions/${questionId}/options/${optionId}`,
    );
  },

  // ---------- Métricas (admin) ----------

  /**
   * Agregados por pregunta y opción.
   *
   * Puede volver con `suprimido: true` y `preguntas: []` cuando el corte tiene
   * menos respuestas que `umbral`. No es un error ni un vacío: es una decisión
   * de privacidad que la pantalla tiene que explicar.
   */
  async getMetrics(
    id: string,
    filters?: SurveyMetricsFilters,
  ): Promise<SurveyMetricsResult> {
    const { data } = await apiClient.get<SurveyMetricsResult>(
      `/survey/campaigns/${id}/metrics`,
      { params: filters },
    );
    return data;
  },

  async getFlow(id: string): Promise<SurveyFlowResult> {
    const { data } = await apiClient.get<SurveyFlowResult>(
      `/survey/campaigns/${id}/flow`,
    );
    return data;
  },
};
