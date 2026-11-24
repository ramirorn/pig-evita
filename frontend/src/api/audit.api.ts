// ===========================================
// Audit API
// ===========================================
import apiClient from './client';
import type { PaginatedResponse } from '@/types';

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

/**
 * Fila de `GET /audit` tal como la arma `AuditService.findAll`.
 *
 * Se define acá y no se usa el `AuditLog` compartido porque aquel tipa `user`
 * como un `User` completo; el backend sólo selecciona estos cuatro campos y
 * manda `null` cuando el evento no tiene autor.
 */
export interface AuditLogRow {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export const auditApi = {
  async findAll(filters?: AuditFilters): Promise<PaginatedResponse<AuditLogRow>> {
    const { data } = await apiClient.get<PaginatedResponse<AuditLogRow>>('/audit', { params: filters });
    return data;
  },
};
