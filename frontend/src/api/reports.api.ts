// ===========================================
// Reports API
// ===========================================
import apiClient from './client';

export type ReportFormat = 'csv' | 'xlsx';

export const reportsApi = {
  /** Export participants CSV or Excel */
  async exportParticipants(categoryId?: string, format: ReportFormat = 'csv'): Promise<Blob> {
    const { data } = await apiClient.get('/reports/participants', {
      params: { categoryId: categoryId || undefined, format },
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export inscriptions CSV or Excel */
  async exportInscriptions(
    filters?: { disciplineId?: string; categoryId?: string; status?: string },
    format: ReportFormat = 'csv'
  ): Promise<Blob> {
    const { data } = await apiClient.get('/reports/inscriptions', {
      params: { ...filters, format },
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export teams CSV or Excel */
  async exportTeams(disciplineId?: string, format: ReportFormat = 'csv'): Promise<Blob> {
    const { data } = await apiClient.get('/reports/teams', {
      params: { disciplineId: disciplineId || undefined, format },
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export results CSV or Excel */
  async exportResults(competitionId?: string, format: ReportFormat = 'csv'): Promise<Blob> {
    const { data } = await apiClient.get('/reports/results', {
      params: { competitionId: competitionId || undefined, format },
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
