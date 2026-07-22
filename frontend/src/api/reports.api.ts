// ===========================================
// Reports API
// ===========================================
import apiClient from './client';

export const reportsApi = {
  /** Export participants CSV */
  async exportParticipantsCsv(categoryId: string): Promise<Blob> {
    const { data } = await apiClient.get('/reports/participants', {
      params: { categoryId },
      responseType: 'blob',
    });
    return data as Blob;
  },

  /** Export teams CSV */
  async exportTeamsCsv(disciplineId: string): Promise<Blob> {
    const { data } = await apiClient.get('/reports/teams', {
      params: { disciplineId },
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
