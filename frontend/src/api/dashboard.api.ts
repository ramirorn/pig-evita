// ===========================================
// Dashboard API
// ===========================================
import apiClient from './client';
import type { DashboardStats } from '@/types';

export const dashboardApi = {
  /**
   * `GET /dashboard/stats` — todas las métricas del panel en una sola llamada.
   *
   * Reemplaza las 8 requests que el dashboard hacía para leer 8 contadores
   * (hallazgo Q3). El interceptor de `client.ts` ya desenvuelve el sobre
   * `{ success, data }`, así que acá `data` es directamente el `DashboardStats`.
   */
  async getStats(): Promise<DashboardStats> {
    const { data } = await apiClient.get<DashboardStats>('/dashboard/stats');
    return data;
  },
};
