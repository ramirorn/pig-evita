// ===========================================
// Reports Controller
// ===========================================
import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService, EspecificacionReporte } from './reports.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Reports')
@Controller('reports')
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Prepara los headers y arranca el streaming (T23).
   *
   * El contrato HTTP es idéntico al de la versión que mandaba un Buffer: mismo
   * `Content-Type`, mismo `Content-Disposition`, mismo BOM en el CSV. Lo único
   * que cambia es que la respuesta sale `chunked` en lugar de con
   * `Content-Length`, porque el tamaño no se conoce hasta terminar de generarla.
   *
   * `Cache-Control: no-store` porque son datos personales de menores de edad y
   * no queremos copias en discos intermedios. El `no-transform` es funcional:
   * `compression()` (T18) lo respeta y no intenta gzipear el .xlsx —que ya es un
   * zip, así que comprimirlo de nuevo sólo quema CPU—. El CSV sí se comprime:
   * es texto muy repetitivo y `compression` streamea sin bufferizar todo.
   */
  private enviar(
    res: Response,
    espec: EspecificacionReporte,
    esExcel: boolean,
    nombreBase: string,
  ): Promise<void> {
    res.status(200);

    if (esExcel) {
      res.setHeader('Content-Type', MIME_XLSX);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombreBase}.xlsx"`,
      );
      res.setHeader('Cache-Control', 'no-store, no-transform');
      return this.reportsService.escribirExcel(res, espec);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombreBase}.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return this.reportsService.escribirCsv(res, espec);
  }

  private esExcel(format?: string): boolean {
    return format === 'xlsx' || format === 'excel';
  }

  @Get('participants')
  @Roles(...ACCIONES.REPORT_EXPORT)
  @ApiOperation({ summary: 'Exportar lista de participantes a CSV o Excel' })
  @ApiQuery({ name: 'disciplineId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'locality', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'] })
  async exportParticipants(
    @Query('disciplineId') disciplineId: string,
    @Query('categoryId') categoryId: string,
    @Query('locality') locality: string,
    @Query('department') department: string,
    @Query('format') format: string,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    // R05 — el reporte nunca devuelve 403 por pedir un departamento ajeno: sale
    // recortado al alcance y lo declara en la primera fila del archivo.
    const espec = this.reportsService.especificacionParticipants(
      await this.scope.alcanceDe(actor),
      {
        disciplineId,
        categoryId,
        locality,
        department,
      },
    );
    return this.enviar(
      res,
      espec,
      this.esExcel(format),
      'padron_participantes',
    );
  }

  @Get('inscriptions')
  @Roles(...ACCIONES.REPORT_EXPORT)
  @ApiOperation({ summary: 'Exportar inscripciones a CSV o Excel' })
  @ApiQuery({ name: 'disciplineId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'] })
  async exportInscriptions(
    @Query('disciplineId') disciplineId: string,
    @Query('categoryId') categoryId: string,
    @Query('status') status: string,
    @Query('format') format: string,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const espec = this.reportsService.especificacionInscriptions(
      await this.scope.alcanceDe(actor),
      disciplineId,
      categoryId,
      status,
    );
    return this.enviar(res, espec, this.esExcel(format), 'inscripciones');
  }

  @Get('teams')
  @Roles(...ACCIONES.REPORT_EXPORT)
  @ApiOperation({ summary: 'Exportar lista de equipos a CSV o Excel' })
  @ApiQuery({ name: 'disciplineId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'locality', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'] })
  async exportTeams(
    @Query('disciplineId') disciplineId: string,
    @Query('categoryId') categoryId: string,
    @Query('locality') locality: string,
    @Query('department') department: string,
    @Query('format') format: string,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const espec = this.reportsService.especificacionTeams(
      await this.scope.alcanceDe(actor),
      {
        disciplineId,
        categoryId,
        locality,
        department,
      },
    );
    return this.enviar(res, espec, this.esExcel(format), 'equipos');
  }

  @Get('results')
  @Roles(...ACCIONES.REPORT_EXPORT)
  @ApiOperation({ summary: 'Exportar resultados y partidos a CSV o Excel' })
  @ApiQuery({ name: 'competitionId', required: false })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'xlsx'] })
  async exportResults(
    @Query('competitionId') competitionId: string,
    @Query('format') format: string,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const espec = this.reportsService.especificacionResults(
      await this.scope.alcanceDe(actor),
      competitionId,
    );
    return this.enviar(res, espec, this.esExcel(format), 'resultados');
  }
}
