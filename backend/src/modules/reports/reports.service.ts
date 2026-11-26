// ===========================================
// Reports Service — fachada de los reportes (T23 / Q5, Q23)
// ===========================================
//
// L14 — este archivo tenía 978 líneas con cuatro responsabilidades: paginar,
// definir cada reporte, escribir CSV/Excel y formatear celdas. Quedó partido:
//
//   - `definitions/*.report.ts`: un archivo por reporte (OCP: un reporte nuevo
//     es un archivo nuevo, no se toca este).
//   - `report-writer.ts`: escritura en streaming a CSV y Excel.
//   - `report-format.ts`: etiquetas, puntajes y neutralización de fórmulas.
//   - `common/prisma/batch-pagination.ts`: paginación por cursor u offset.
//
// La API pública no cambió: controller y tests siguen llamando a estos métodos.
import { Injectable } from '@nestjs/common';
import { InscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Alcance, ScopeService } from '../../common/scope';
import { inscriptionsReport } from './definitions/inscriptions.report';
import { participantsReport } from './definitions/participants.report';
import { ReportContext } from './definitions/report-context';
import { resultsReport } from './definitions/results.report';
import { teamsReport } from './definitions/teams.report';
import { ReportWriter } from './report-writer';
import type {
  DestinoReporte,
  EspecificacionReporte,
  ParticipantReportFilters,
  TeamReportFilters,
} from './report.types';

// Reexportados: los tests y el script de backfill los importan desde acá.
export { TAMANIO_LOTE } from './definitions/report-context';
export {
  ETIQUETAS_EXPORTACION,
  etiquetaExportacion,
  neutralizarFormulaCsv,
  puntajeExportado,
} from './report-format';
export type {
  DestinoReporte,
  EspecificacionReporte,
  ParticipantReportFilters,
  TeamReportFilters,
} from './report.types';

@Injectable()
export class ReportsService {
  private readonly writer = new ReportWriter();
  private readonly ctx: ReportContext;

  constructor(prisma: PrismaService, scope: ScopeService) {
    this.ctx = { prisma, scope };
  }

  especificacionParticipants(
    alcance: Alcance,
    filters?: ParticipantReportFilters,
  ): EspecificacionReporte {
    return participantsReport(this.ctx, alcance, filters);
  }

  especificacionInscriptions(
    alcance: Alcance,
    disciplineId?: string,
    categoryId?: string,
    status?: InscriptionStatus,
  ): EspecificacionReporte {
    return inscriptionsReport(
      this.ctx,
      alcance,
      disciplineId,
      categoryId,
      status,
    );
  }

  especificacionTeams(
    alcance: Alcance,
    filters?: TeamReportFilters,
  ): EspecificacionReporte {
    return teamsReport(this.ctx, alcance, filters);
  }

  especificacionResults(
    alcance: Alcance,
    competitionId?: string,
  ): EspecificacionReporte {
    return resultsReport(this.ctx, alcance, competitionId);
  }

  escribirCsv(
    destino: DestinoReporte,
    espec: EspecificacionReporte,
  ): Promise<void> {
    return this.writer.escribirCsv(destino, espec);
  }

  escribirExcel(
    destino: DestinoReporte,
    espec: EspecificacionReporte,
  ): Promise<void> {
    return this.writer.escribirExcel(destino, espec);
  }
}
