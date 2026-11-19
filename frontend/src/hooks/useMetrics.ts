// ===========================================
// React Query Hooks — Métricas de la encuesta
// ===========================================
//
// "En vivo" sin WebSockets: `useMetricsVersion` pregunta cada 10 s la versión
// de la campaña (una lectura de Redis en el backend). Las consultas pesadas
// llevan esa versión en su clave, así que sólo se vuelven a pedir cuando entró
// una respuesta nueva o cambió el cuestionario; mientras nada cambia, el panel
// no hace más que esa lectura liviana.
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  metricsApi,
  type SurveyHighlightPayload,
  type SurveyKpiPayload,
} from '@/api/metrics.api';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
import type { MetricsDimension, MetricsFiltros } from '@/types';
import { useQueryScope } from './useQueryScope';

/** Cada cuánto se consulta la versión de la campaña. */
export const INTERVALO_VERSION_MS = 10_000;

export const METRICS_KEYS = {
  all: (scope: string) => ['metrics', scope] as const,
  catalog: (scope: string, campaignId?: string) =>
    [...METRICS_KEYS.all(scope), 'catalog', campaignId ?? 'activa'] as const,
  campaign: (scope: string, campaignId: string) =>
    [...METRICS_KEYS.all(scope), 'campaign', campaignId] as const,
  version: (scope: string, campaignId: string) =>
    [...METRICS_KEYS.campaign(scope, campaignId), 'version'] as const,
  overview: (scope: string, campaignId: string, version: number, filtros?: MetricsFiltros) =>
    [...METRICS_KEYS.campaign(scope, campaignId), 'overview', version, { filtros }] as const,
  cross: (
    scope: string,
    campaignId: string,
    version: number,
    pregunta: string,
    por: MetricsDimension,
    filtros?: MetricsFiltros,
  ) =>
    [...METRICS_KEYS.campaign(scope, campaignId), 'cross', version, pregunta, por, { filtros }] as const,
  kpis: (scope: string, campaignId: string, version: number, filtros?: MetricsFiltros) =>
    [...METRICS_KEYS.campaign(scope, campaignId), 'kpis', version, { filtros }] as const,
  kpiDefinitions: (scope: string, campaignId?: string) =>
    [...METRICS_KEYS.all(scope), 'kpi-definitions', campaignId ?? 'todas'] as const,
  highlights: (scope: string, campaignId: string, version: number, filtros?: MetricsFiltros) =>
    [...METRICS_KEYS.campaign(scope, campaignId), 'highlights', version, { filtros }] as const,
  highlightDefinitions: (scope: string, campaignId?: string) =>
    [...METRICS_KEYS.all(scope), 'highlight-definitions', campaignId ?? 'todas'] as const,
};

export function useMetricsCatalog(campaignId?: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.catalog(scope, campaignId),
    queryFn: () => metricsApi.getCatalog(campaignId),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

/**
 * Versión de la campaña, consultada cada `INTERVALO_VERSION_MS`. Con la pestaña
 * en segundo plano no se consulta: al volver, el foco la refresca.
 */
export function useMetricsVersion(campaignId: string | null | undefined) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.version(scope, campaignId ?? ''),
    queryFn: () => metricsApi.getVersion(campaignId!),
    enabled: !!campaignId,
    refetchInterval: INTERVALO_VERSION_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

// `keepPreviousData`: mientras llega la versión nueva el gráfico sigue
// mostrando la anterior en vez de parpadear a "Cargando…" cada 10 segundos.

export function useMetricsOverview(
  campaignId: string | null | undefined,
  version: number | undefined,
  filtros?: MetricsFiltros,
) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.overview(scope, campaignId ?? '', version ?? -1, filtros),
    queryFn: () => metricsApi.getOverview(campaignId!, filtros),
    enabled: !!campaignId && version !== undefined,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

export function useMetricsCross(
  campaignId: string | null | undefined,
  version: number | undefined,
  pregunta: string | undefined,
  por: MetricsDimension | undefined,
  filtros?: MetricsFiltros,
) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.cross(
      scope,
      campaignId ?? '',
      version ?? -1,
      pregunta ?? '',
      por ?? 'zona',
      filtros,
    ),
    queryFn: () => metricsApi.getCross(campaignId!, pregunta!, por!, filtros),
    enabled: !!campaignId && version !== undefined && !!pregunta && !!por,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

export function useMetricsKpis(
  campaignId: string | null | undefined,
  version: number | undefined,
  filtros?: MetricsFiltros,
) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.kpis(scope, campaignId ?? '', version ?? -1, filtros),
    queryFn: () => metricsApi.getKpis(campaignId!, filtros),
    enabled: !!campaignId && version !== undefined,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

export function useMetricsHighlights(
  campaignId: string | null | undefined,
  version: number | undefined,
  filtros?: MetricsFiltros,
) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.highlights(scope, campaignId ?? '', version ?? -1, filtros),
    queryFn: () => metricsApi.getHighlights(campaignId!, filtros),
    enabled: !!campaignId && version !== undefined,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

export function useHighlightDefinitions(campaignId?: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.highlightDefinitions(scope, campaignId),
    queryFn: () => metricsApi.listHighlights(campaignId),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useKpiDefinitions(campaignId?: string) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: METRICS_KEYS.kpiDefinitions(scope, campaignId),
    queryFn: () => metricsApi.listKpis(campaignId),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

/**
 * Crear, editar o borrar un KPI cambia lo que muestran las tarjetas: se
 * invalida todo `metrics` del usuario (definiciones, versión y resultados).
 */
function useInvalidarMetricas() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () => queryClient.invalidateQueries({ queryKey: METRICS_KEYS.all(scope) });
}

export function useCreateKpi() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: (payload: SurveyKpiPayload) => metricsApi.createKpi(payload),
    onSuccess: () => {
      toast.success('Indicador creado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo crear el indicador')),
  });
}

export function useUpdateKpi() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SurveyKpiPayload> }) =>
      metricsApi.updateKpi(id, payload),
    onSuccess: () => {
      toast.success('Indicador actualizado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo actualizar el indicador')),
  });
}

export function useDeleteKpi() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: (id: string) => metricsApi.removeKpi(id),
    onSuccess: () => {
      toast.success('Indicador borrado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo borrar el indicador')),
  });
}

export function useCreateHighlight() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: (payload: SurveyHighlightPayload) => metricsApi.createHighlight(payload),
    onSuccess: () => {
      toast.success('Destacado creado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo crear el destacado')),
  });
}

export function useUpdateHighlight() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SurveyHighlightPayload> }) =>
      metricsApi.updateHighlight(id, payload),
    onSuccess: () => {
      toast.success('Destacado actualizado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo actualizar el destacado')),
  });
}

export function useDeleteHighlight() {
  const invalidar = useInvalidarMetricas();
  return useMutation({
    mutationFn: (id: string) => metricsApi.removeHighlight(id),
    onSuccess: () => {
      toast.success('Destacado borrado');
      void invalidar();
    },
    onError: (error) => toast.error(getFriendlyError(error, 'No se pudo borrar el destacado')),
  });
}
