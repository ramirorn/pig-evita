// ===========================================
// Inscriptions API
// ===========================================
import apiClient from './client';
import type {
  Inscription,
  PaginatedResponse,
  PublicInscription,
  TeamInscriptionResult,
} from '@/types';

export interface InscriptionFilters {
  page?: number;
  limit?: number;
  status?: string;
  categoryId?: string;
  participantId?: string;
  /**
   * Búsqueda del lado del servidor: el backend la aplica sobre nombre, apellido
   * y DNI del participante, y sobre el código QR
   * (`inscriptions.service.ts → findAll`). Estaba soportada desde siempre pero
   * faltaba acá, así que el buscador de la pantalla no llegaba a enviarla.
   */
  search?: string;
}

export interface CreateInscriptionPayload {
  // Participant data (created or matched by DNI)
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  phone?: string;
  email?: string;
  locality: string;
  department: string;
  address?: string;
  // Inscription data
  categoryId: string;
  teamId?: string;
}

/** Un integrante dentro del alta de plantel completo. */
export interface TeamInscriptionMemberPayload {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  phone?: string;
  email?: string;
  locality: string;
  department: string;
  address?: string;
  isSubstitute: boolean;
  position?: string;
  shirtNumber?: number;
  isCaptain?: boolean;
}

/**
 * Alta de un plantel entero en una sola operación.
 *
 * El endpoint es transaccional del lado del backend: si un solo integrante
 * falla, no se crea ninguno. Por eso la pantalla nunca tiene que reconciliar
 * un alta a medias — pero sí tiene que conservar la lista cargada para que se
 * pueda corregir el que falló y reintentar.
 */
export interface CreateTeamInscriptionPayload {
  disciplineId: string;
  categoryId: string;
  teamName: string;
  locality: string;
  department: string;
  members: TeamInscriptionMemberPayload[];
}

export interface ReviewInscriptionPayload {
  notes?: string;
}

export interface RejectInscriptionPayload {
  rejectionNote: string;
}

export const inscriptionsApi = {
  /** Authenticated: Create inscription (delegado/admin) */
  async create(payload: CreateInscriptionPayload): Promise<Inscription> {
    const { data } = await apiClient.post<Inscription>('/inscriptions', payload);
    return data;
  },

  /** Authenticated: Create a whole team roster at once (delegado/admin) */
  async createTeam(payload: CreateTeamInscriptionPayload): Promise<TeamInscriptionResult> {
    const { data } = await apiClient.post<TeamInscriptionResult>('/inscriptions/team', payload);
    return data;
  },

  /** Public: Find inscription by QR code (no auth). Devuelve datos mínimos, sin PII. */
  async findByQr(qrCode: string): Promise<PublicInscription> {
    const { data } = await apiClient.get<PublicInscription>(`/inscriptions/qr/${qrCode}`);
    return data;
  },

  /** Admin: List inscriptions with filters */
  async findAll(filters?: InscriptionFilters): Promise<PaginatedResponse<Inscription>> {
    const { data } = await apiClient.get<PaginatedResponse<Inscription>>('/inscriptions', { params: filters });
    return data;
  },

  /** Admin: Get inscription detail */
  async findOne(id: string): Promise<Inscription> {
    const { data } = await apiClient.get<Inscription>(`/inscriptions/${id}`);
    return data;
  },

  /** Admin: Review inscription (PENDIENTE → REVISADA) */
  async review(id: string, payload: ReviewInscriptionPayload): Promise<Inscription> {
    const { data } = await apiClient.patch<Inscription>(`/inscriptions/${id}/review`, payload);
    return data;
  },

  /** Admin: Approve inscription (REVISADA → APROBADA) */
  async approve(id: string): Promise<Inscription> {
    const { data } = await apiClient.patch<Inscription>(`/inscriptions/${id}/approve`);
    return data;
  },

  /** Admin: Reject inscription */
  async reject(id: string, payload: RejectInscriptionPayload): Promise<Inscription> {
    const { data } = await apiClient.patch<Inscription>(`/inscriptions/${id}/reject`, payload);
    return data;
  },
};
