// ===========================================
// Audit API
// ===========================================
import apiClient from './client';
import type { AuditLog, PaginatedResponse } from '@/types';

export interface AuditFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
}

export const auditApi = {
  async findAll(filters?: AuditFilters): Promise<PaginatedResponse<AuditLog>> {
    const { data } = await apiClient.get<PaginatedResponse<AuditLog>>('/audit', { params: filters });
    return data;
  },
};
