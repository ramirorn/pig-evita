// ===========================================
// Stats API — estadísticas públicas del torneo
// ===========================================
import apiClient from './client';
import { localityStatsSchema, type LocalityStats } from '@/schemas/localityStats';

export const statsApi = {
  /**
   * `GET /stats/localities` — participación y resultados por localidad.
   *
   * Público. El interceptor de `client.ts` ya desenvuelve `{ success, data }`;
   * acá se valida la forma con Zod antes de que llegue al mapa. Un contrato
   * roto sale como error de la query (y la pantalla ofrece reintentar), no como
   * un render a medias.
   */
  async getLocalities(): Promise<LocalityStats> {
    const { data } = await apiClient.get<unknown>('/stats/localities');
    return localityStatsSchema.parse(data);
  },
};
