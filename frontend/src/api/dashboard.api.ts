// ===========================================
// Dashboard API
// ===========================================
import apiClient from './client';
import type { DashboardStats } from '@/types';

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await apiClient.get<DashboardStats>('/dashboard/stats');
    return data;
  },
};
