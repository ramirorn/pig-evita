// ===========================================
// React Query Hooks — Encuesta (S20)
// ===========================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  surveyApi,
  type ActiveSurveyFilters,
  type CreateSurveyCampaignPayload,
  type CreateSurveyOptionPayload,
  type CreateSurveyQuestionPayload,
  type SubmitSurveyResponsePayload,
  type SurveyCampaignFilters,
  type SurveyMetricsFilters,
  type UpdateSurveyCampaignPayload,
  type UpdateSurveyOptionPayload,
  type UpdateSurveyQuestionPayload,
} from '@/api/survey.api';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
import { toast } from 'sonner';

export const SURVEY_KEYS = {
  all: ['survey'] as const,
  // --- Público ---
  actives: () => [...SURVEY_KEYS.all, 'active'] as const,
  active: (filters?: ActiveSurveyFilters) =>
    [...SURVEY_KEYS.actives(), { filters }] as const,
  // --- Admin ---
  campaigns: () => [...SURVEY_KEYS.all, 'campaigns'] as const,
  campaignLists: () => [...SURVEY_KEYS.campaigns(), 'list'] as const,
  campaignList: (filters?: SurveyCampaignFilters) =>
    [...SURVEY_KEYS.campaignLists(), { filters }] as const,
  campaignDetails: () => [...SURVEY_KEYS.campaigns(), 'detail'] as const,
  campaignDetail: (id: string) =>
    [...SURVEY_KEYS.campaignDetails(), id] as const,
  // Métricas y flujo cuelgan del detalle a propósito: publicar una campaña o
  // tocarle una pregunta cambia los dos, y así una sola invalidación del
  // detalle los arrastra sin tener que acordarse de cada clave.
  metrics: (id: string, filters?: SurveyMetricsFilters) =>
    [...SURVEY_KEYS.campaignDetail(id), 'metrics', { filters }] as const,
  flow: (id: string) => [...SURVEY_KEYS.campaignDetail(id), 'flow'] as const,
};

// ===========================================
// Público
// ===========================================

/**
 * Cuestionario vigente para una etapa/ventana.
 *
 * `data === null` significa "no hay ninguna encuesta abierta", que es un estado
 * normal del sitio y **no** un error: hay que distinguirlo de `isError`, porque
 * la pantalla le dice cosas distintas a quien responde.
 *
 * `retry: 3` es más que el default global (1) por un motivo de producto: esto
 * lo abre un chico desde la cancha, con la señal yendo y viniendo, y la edición
 * anterior de la encuesta se perdió la mitad de las respuestas justamente por
 * conectividad. El cuestionario es idéntico para todos y el backend lo sirve
 * cacheado, así que reintentar es barato.
 */
export function useActiveSurvey(filters?: ActiveSurveyFilters) {
  return useQuery({
    queryKey: SURVEY_KEYS.active(filters),
    queryFn: () => surveyApi.findActive(filters),
    staleTime: STALE_TIME.CATALOG,
    retry: 3,
  });
}

/**
 * Envío anónimo de una respuesta.
 *
 * ⚠️ **No muestra ningún toast, ni de éxito ni de error**, y es la única
 * mutación del proyecto que no lo hace. Los tres modos de falla piden acciones
 * distintas de quien responde —429 "mandaste muchas, esperá un minuto", error
 * de red "quedó guardado y se manda solo", 400 "el cuestionario cambió"— y el
 * de red además no es terminal: el llamador encola el envío y reintenta. Un
 * `toast.error` genérico acá le diría "no se pudo" a alguien cuya respuesta sí
 * está a salvo. Ver `useSurveyWizard`.
 */
export function useSubmitSurveyResponse() {
  return useMutation({
    mutationFn: (payload: SubmitSurveyResponsePayload) =>
      surveyApi.submitResponse(payload),
    // Sin reintento automático: un POST que se reintenta solo puede duplicar
    // una respuesta que ya entró (el backend no deduplica, por diseño, porque
    // no guarda identidad). El reintento lo decide el llamador, y sólo cuando
    // sabe que la request nunca llegó a salir.
    retry: false,
  });
}

// ===========================================
// Campañas (admin)
// ===========================================

export function useSurveyCampaigns(filters?: SurveyCampaignFilters) {
  return useQuery({
    queryKey: SURVEY_KEYS.campaignList(filters),
    queryFn: () => surveyApi.findAllCampaigns(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useSurveyCampaign(id: string) {
  return useQuery({
    queryKey: SURVEY_KEYS.campaignDetail(id),
    queryFn: () => surveyApi.findCampaign(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateSurveyCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSurveyCampaignPayload) =>
      surveyApi.createCampaign(payload),
    onSuccess: () => {
      toast.success('Campaña creada');
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo crear la campaña'));
    },
  });
}

export function useUpdateSurveyCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateSurveyCampaignPayload;
    }) => surveyApi.updateCampaign(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Campaña actualizada');
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.id),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo actualizar la campaña'));
    },
  });
}

export function useDeleteSurveyCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => surveyApi.removeCampaign(id),
    onSuccess: () => {
      toast.success('Campaña eliminada');
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
    },
    onError: (error: unknown) => {
      // El backend responde 409 si la campaña ya tiene respuestas: ese mensaje
      // explica por qué no se puede y hay que dejarlo pasar tal cual.
      toast.error(getFriendlyError(error, 'No se pudo eliminar la campaña'));
    },
  });
}

/**
 * BORRADOR → ACTIVA.
 *
 * Invalida además el cuestionario público: recién publicada, la encuesta tiene
 * que aparecer en `/encuesta/responder` sin esperar los 10 minutos de frescura
 * de catálogo.
 */
export function usePublishSurveyCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => surveyApi.publishCampaign(id),
    onSuccess: (_, id) => {
      toast.success('Campaña publicada: ya recibe respuestas');
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.actives() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo publicar la campaña'));
    },
  });
}

export function useCloseSurveyCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => surveyApi.closeCampaign(id),
    onSuccess: (_, id) => {
      toast.success('Campaña cerrada: ya no recibe respuestas');
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.actives() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo cerrar la campaña'));
    },
  });
}

// ===========================================
// Preguntas y opciones (admin)
// ===========================================
//
// Todas invalidan el **detalle** de la campaña, que es de donde sale el
// cuestionario que se edita, y el listado, porque `_count.questions` cambia.

export function useCreateSurveyQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      payload,
    }: {
      campaignId: string;
      payload: CreateSurveyQuestionPayload;
    }) => surveyApi.createQuestion(campaignId, payload),
    onSuccess: (_, variables) => {
      toast.success('Pregunta agregada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo agregar la pregunta'));
    },
  });
}

export function useUpdateSurveyQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      questionId,
      payload,
    }: {
      campaignId: string;
      questionId: string;
      payload: UpdateSurveyQuestionPayload;
    }) => surveyApi.updateQuestion(campaignId, questionId, payload),
    onSuccess: (_, variables) => {
      toast.success('Pregunta actualizada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo actualizar la pregunta'));
    },
  });
}

export function useDeleteSurveyQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      questionId,
    }: {
      campaignId: string;
      questionId: string;
    }) => surveyApi.removeQuestion(campaignId, questionId),
    onSuccess: (_, variables) => {
      toast.success('Pregunta eliminada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
      queryClient.invalidateQueries({ queryKey: SURVEY_KEYS.campaignLists() });
    },
    onError: (error: unknown) => {
      // 409 cuando la pregunta ya tiene respuestas: borrarla destruiría el
      // desglose histórico, y el mensaje del backend lo explica.
      toast.error(getFriendlyError(error, 'No se pudo eliminar la pregunta'));
    },
  });
}

export function useCreateSurveyOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      questionId,
      payload,
    }: {
      campaignId: string;
      questionId: string;
      payload: CreateSurveyOptionPayload;
    }) => surveyApi.createOption(campaignId, questionId, payload),
    onSuccess: (_, variables) => {
      toast.success('Opción agregada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo agregar la opción'));
    },
  });
}

export function useUpdateSurveyOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      questionId,
      optionId,
      payload,
    }: {
      campaignId: string;
      questionId: string;
      optionId: string;
      payload: UpdateSurveyOptionPayload;
    }) => surveyApi.updateOption(campaignId, questionId, optionId, payload),
    onSuccess: (_, variables) => {
      toast.success('Opción actualizada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo actualizar la opción'));
    },
  });
}

export function useDeleteSurveyOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      questionId,
      optionId,
    }: {
      campaignId: string;
      questionId: string;
      optionId: string;
    }) => surveyApi.removeOption(campaignId, questionId, optionId),
    onSuccess: (_, variables) => {
      toast.success('Opción eliminada');
      queryClient.invalidateQueries({
        queryKey: SURVEY_KEYS.campaignDetail(variables.campaignId),
      });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo eliminar la opción'));
    },
  });
}

// ===========================================
// Métricas (admin)
// ===========================================

/**
 * Agregados de una campaña, con el corte que pidan los filtros.
 *
 * ⚠️ La respuesta puede venir con `suprimido: true`, `motivo:
 * 'MUESTRA_INSUFICIENTE'` y `preguntas: []`. **Eso no es un vacío ni un error**:
 * el corte tiene menos respuestas que `umbral` y no se publica para que un
 * filtro fino sobre una muestra chica no reidentifique a un chico. La pantalla
 * tiene que decir que está suprimido y por qué, nunca pintarlo como cero.
 */
export function useSurveyMetrics(id: string, filters?: SurveyMetricsFilters) {
  return useQuery({
    queryKey: SURVEY_KEYS.metrics(id, filters),
    queryFn: () => surveyApi.getMetrics(id, filters),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

/**
 * Conteos por etapa/ventana, disciplina y disciplina × localidad.
 *
 * Cada fila es un `CorteEncuesta`: las suprimidas traen `conteo: null`. Hay que
 * mostrarlas igual —la fila existe— marcadas como suprimidas.
 */
export function useSurveyFlow(id: string) {
  return useQuery({
    queryKey: SURVEY_KEYS.flow(id),
    queryFn: () => surveyApi.getFlow(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}
