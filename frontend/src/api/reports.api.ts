// ===========================================
// Reports API
// ===========================================
import apiClient from './client';

export const reportsApi = {
  /** Export participants CSV */
  async exportParticipantsCsv(categoryId?: string): Promise<Blob> {
    const { data } = await apiClient.get('/reports/participants', {
      params: categoryId ? { categoryId } : undefined,
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export inscriptions CSV */
  async exportInscriptionsCsv(filters?: { disciplineId?: string; categoryId?: string; status?: string }): Promise<Blob> {
    const { data } = await apiClient.get('/reports/inscriptions', {
      params: filters,
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export teams CSV */
  async exportTeamsCsv(disciplineId?: string): Promise<Blob> {
    const { data } = await apiClient.get('/reports/teams', {
      params: disciplineId ? { disciplineId } : undefined,
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export results CSV */
  async exportResultsCsv(competitionId?: string): Promise<Blob> {
    const { data } = await apiClient.get('/reports/results', {
      params: competitionId ? { competitionId } : undefined,
      responseType: 'blob',
    });
    return data as Blob;
  },
};

/** Helper: trigger browser file download */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
