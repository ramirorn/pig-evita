// ===========================================
// News API
// ===========================================
import apiClient from './client';
import type { News, PaginatedResponse } from '@/types';

export interface NewsFilters {
  page?: number;
  limit?: number;
  isPublished?: boolean;
  /**
   * Búsqueda server-side sobre título y bajada (`NewsFilterDto` → `search`, con
   * `mode: 'insensitive'` en Prisma). El listado público filtraba en el cliente
   * sobre las primeras 50 noticias: la 51 no aparecía nunca (R29).
   */
  search?: string;
  /**
   * Origen: `true` las que vienen del portal oficial (S19), `false` las propias.
   *
   * Es la única distinción real entre noticias — el modelo no tiene categorías
   * temáticas—, y por eso es lo que filtran los chips del listado público.
   */
  isExternal?: boolean;
}

export interface CreateNewsPayload {
  title: string;
  content: string;
  excerpt?: string;
  imageKey?: string;
  isPublished?: boolean;
}

export type UpdateNewsPayload = Partial<CreateNewsPayload>;

/**
 * Reporte de una corrida del sync con el portal oficial (S19).
 *
 * Trae los números y no sólo un "listo" a propósito: si la corrida no encontró
 * nada, la pantalla tiene que poder decir **por qué** —cuántos IDs miró,
 * cuántas notas eran de otra sección, cuántos errores de red hubo—. Un éxito
 * sin números es el modo de falla que la tarea viene a cerrar.
 */
export interface ReporteSyncNoticias {
  estado: 'ok' | 'alerta';
  motivo: 'manual' | 'programada';
  desdeId: number;
  hastaId: number;
  paginasLeidas: number;
  notasEncontradas: number;
  clasificadas: number;
  creadas: number;
  actualizadas: number;
  descartadasPorSeccion: number;
  erroresDeRed: number;
  markupInesperado: number;
  alertas: string[];
  duracionMs: number;
}

export const newsApi = {
  async findAll(filters?: NewsFilters): Promise<PaginatedResponse<News>> {
    const { data } = await apiClient.get<PaginatedResponse<News>>('/news', { params: filters });
    return data;
  },

  async findBySlug(slug: string): Promise<News> {
    const { data } = await apiClient.get<News>(`/news/slug/${slug}`);
    return data;
  },

  async findOne(id: string): Promise<News> {
    const { data } = await apiClient.get<News>(`/news/${id}`);
    return data;
  },

  async create(payload: CreateNewsPayload): Promise<News> {
    const { data } = await apiClient.post<News>('/news', payload);
    return data;
  },

  async update(id: string, payload: UpdateNewsPayload): Promise<News> {
    const { data } = await apiClient.patch<News>(`/news/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/news/${id}`);
  },

  /**
   * Fuerza la sincronización con formosa.gob.ar. Requiere la acción `NEWS_SYNC`.
   *
   * Puede tardar: recorre IDs del portal con una pausa entre requests para no
   * castigar un sitio ajeno. El backend responde 503 si el portal no contesta o
   * si cambió el markup, en vez de informar "0 noticias nuevas".
   */
  async sync(): Promise<ReporteSyncNoticias> {
    const { data } = await apiClient.post<ReporteSyncNoticias>('/news/sync');
    return data;
  },
};
