// ===========================================
// Metrics API — métricas de la encuesta
// ===========================================
import apiClient from './client';
import type {
  DestacadoDefinicion,
  KpiDefinicion,
  MetricsCatalog,
  MetricsCross,
  MetricsDimension,
  MetricsFiltros,
  MetricsHighlights,
  MetricsKpis,
  MetricsOverview,
  SurveyHighlight,
  SurveyKpi,
} from '@/types';

export interface SurveyKpiPayload {
  campaignId?: string | null;
  nombre: string;
  descripcion?: string | null;
  orden?: number;
  activo?: boolean;
  definicion: KpiDefinicion;
}

export interface SurveyHighlightPayload {
  campaignId?: string | null;
  titulo: string;
  descripcion?: string | null;
  orden?: number;
  activo?: boolean;
  definicion: DestacadoDefinicion;
}

/** Saca los filtros vacíos: `?zona=` no es lo mismo que no filtrar. */
function limpiar(filtros?: MetricsFiltros) {
  if (!filtros) return undefined;
  return Object.fromEntries(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ''),
  );
}

export const metricsApi = {
  async getCatalog(campaignId?: string): Promise<MetricsCatalog> {
    const { data } = await apiClient.get<MetricsCatalog>('/metrics/catalog', {
      params: campaignId ? { campaignId } : undefined,
    });
    return data;
  },

  /** Lectura liviana: la pide el panel cada pocos segundos. */
  async getVersion(campaignId: string): Promise<number> {
    const { data } = await apiClient.get<{ version: number }>(
      `/metrics/survey/${campaignId}/version`,
    );
    return data.version;
  },

  async getOverview(campaignId: string, filtros?: MetricsFiltros): Promise<MetricsOverview> {
    const { data } = await apiClient.get<MetricsOverview>(
      `/metrics/survey/${campaignId}/overview`,
      { params: limpiar(filtros) },
    );
    return data;
  },

  async getCross(
    campaignId: string,
    pregunta: string,
    por: MetricsDimension,
    filtros?: MetricsFiltros,
  ): Promise<MetricsCross> {
    const { data } = await apiClient.get<MetricsCross>(
      `/metrics/survey/${campaignId}/cross`,
      { params: { ...limpiar(filtros), pregunta, por } },
    );
    return data;
  },

  async getKpis(campaignId: string, filtros?: MetricsFiltros): Promise<MetricsKpis> {
    const { data } = await apiClient.get<MetricsKpis>(
      `/metrics/survey/${campaignId}/kpis`,
      { params: limpiar(filtros) },
    );
    return data;
  },

  async listKpis(campaignId?: string): Promise<SurveyKpi[]> {
    const { data } = await apiClient.get<SurveyKpi[]>('/metrics/kpis', {
      params: campaignId ? { campaignId } : undefined,
    });
    return data;
  },

  async createKpi(payload: SurveyKpiPayload): Promise<SurveyKpi> {
    const { data } = await apiClient.post<SurveyKpi>('/metrics/kpis', payload);
    return data;
  },

  async updateKpi(id: string, payload: Partial<SurveyKpiPayload>): Promise<SurveyKpi> {
    const { data } = await apiClient.patch<SurveyKpi>(`/metrics/kpis/${id}`, payload);
    return data;
  },

  async removeKpi(id: string): Promise<void> {
    await apiClient.delete(`/metrics/kpis/${id}`);
  },

  async getHighlights(campaignId: string, filtros?: MetricsFiltros): Promise<MetricsHighlights> {
    const { data } = await apiClient.get<MetricsHighlights>(
      `/metrics/survey/${campaignId}/highlights`,
      { params: limpiar(filtros) },
    );
    return data;
  },

  async listHighlights(campaignId?: string): Promise<SurveyHighlight[]> {
    const { data } = await apiClient.get<SurveyHighlight[]>('/metrics/highlights', {
      params: campaignId ? { campaignId } : undefined,
    });
    return data;
  },

  async createHighlight(payload: SurveyHighlightPayload): Promise<SurveyHighlight> {
    const { data } = await apiClient.post<SurveyHighlight>('/metrics/highlights', payload);
    return data;
  },

  async updateHighlight(
    id: string,
    payload: Partial<SurveyHighlightPayload>,
  ): Promise<SurveyHighlight> {
    const { data } = await apiClient.patch<SurveyHighlight>(`/metrics/highlights/${id}`, payload);
    return data;
  },

  async removeHighlight(id: string): Promise<void> {
    await apiClient.delete(`/metrics/highlights/${id}`);
  },
};
