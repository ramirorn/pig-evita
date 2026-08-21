// ===========================================
// useReportExport — descarga de reportes en CSV / Excel
// ===========================================
import { useState } from 'react';
import { toast } from 'sonner';
import { reportsApi, downloadBlob, type ReportFormat } from '@/api/reports.api';
import { logError } from '@/lib/logger';
import type { ReportId } from './reportCards';
import { toReportQuery, type ReportFilters } from './reportFilters';

/**
 * Pide el reporte al backend, lo baja como archivo y va contando el toast.
 *
 * Vive fuera de la página porque no tiene nada de layout: es elegir el endpoint
 * según el reporte, armar el nombre del archivo y manejar el estado de "hay una
 * descarga en curso" —que deshabilita los ocho botones a la vez para no disparar
 * dos exportaciones simultáneas.
 */
export function useReportExport(filters: ReportFilters) {
  // `${id}-${format}` de la descarga en curso, o null. Distingue cuál de los dos
  // botones de la tarjeta muestra el spinner.
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleExport = async (
    type: ReportId,
    format: ReportFormat,
    baseFilename: string,
    label: string,
  ) => {
    const actionKey = `${type}-${format}`;
    const extension = format === 'xlsx' ? 'xlsx' : 'csv';
    const filename = `${baseFilename}.${extension}`;
    const formatLabel = format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV';

    const toastId = toast.loading(
      `Generando reporte de ${label} en formato ${formatLabel}...`
    );

    try {
      setLoadingAction(actionKey);

      const query = toReportQuery(filters);

      let blob: Blob;
      if (type === 'participantes') {
        blob = await reportsApi.exportParticipants(query, format);
      } else if (type === 'inscripciones') {
        // Este endpoint sólo acepta disciplina y categoría: departamento y
        // localidad no se le mandan aunque estén cargados en los filtros.
        blob = await reportsApi.exportInscriptions(
          {
            disciplineId: query.disciplineId,
            categoryId: query.categoryId,
          },
          format
        );
      } else if (type === 'equipos') {
        blob = await reportsApi.exportTeams(query, format);
      } else {
        // El fixture es global: no se filtra por nada.
        blob = await reportsApi.exportResults(undefined, format);
      }

      downloadBlob(blob, filename);
      toast.success(
        `Reporte de ${label} (${formatLabel}) descargado exitosamente`,
        { id: toastId }
      );
    } catch (error) {
      logError('ReportsPage.handleExport', error);
      toast.error(`Error al generar el reporte de ${label}`, { id: toastId });
    } finally {
      setLoadingAction(null);
    }
  };

  return { loadingAction, isExporting: loadingAction !== null, handleExport };
}
