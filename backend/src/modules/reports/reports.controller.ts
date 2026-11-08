// ===========================================
// Reports Controller
// ===========================================
import { Controller, Get, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { InscriptionStatus } from '@prisma/client';
import { ReportsService, EspecificacionReporte } from './reports.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

// -------------------------------------------------
// Filtros de exportación (F-20)
// -------------------------------------------------
//
// Los filtros llegaban como `@Query('x')` sueltos, sin validar: un
// `disciplineId=zz` viajaba crudo al `where` de Prisma y el reporte respondía
// 500. Con un DTO por endpoint el ValidationPipe global los rechaza con 400
// antes de tocar la base (y `forbidNonWhitelisted` rechaza los que no existen).
//
// Viven en este archivo (y no en `dto/`) porque `backend/.gitignore` ignora
// las carpetas `reports/` (pensado para los reportes generados en disco): un
// archivo nuevo dentro de `src/modules/reports/` no entraría al repositorio.

/** `excel` se sigue aceptando como sinónimo histórico de `xlsx`. */
export const FORMATOS_REPORTE = ['csv', 'xlsx', 'excel'] as const;

class ReportFormatQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], default: 'csv' })
  @IsOptional()
  @IsIn(FORMATOS_REPORTE, {
    message: 'El formato debe ser "csv" o "xlsx"',
  })
  format?: string;
}

/** Filtros comunes de los padrones (participantes y equipos). */
export class PadronReportQueryDto extends ReportFormatQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por disciplina' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por localidad' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  department?: string;
}

export class InscriptionsReportQueryDto extends ReportFormatQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por disciplina' })
  @IsOptional()
  @IsUUID()
  disciplineId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado',
    enum: InscriptionStatus,
  })
  @IsOptional()
  @IsEnum(InscriptionStatus, {
    message: 'El estado debe ser PENDIENTE, REVISADA, APROBADA o RECHAZADA',
  })
  status?: InscriptionStatus;
}

export class ResultsReportQueryDto extends ReportFormatQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por competencia' })
  @IsOptional()
  @IsUUID()
  competitionId?: string;
}

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
  async exportParticipants(
    @Query() query: PadronReportQueryDto,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const { disciplineId, categoryId, locality, department, format } = query;
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
  async exportInscriptions(
    @Query() query: InscriptionsReportQueryDto,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const { disciplineId, categoryId, status, format } = query;
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
  async exportTeams(
    @Query() query: PadronReportQueryDto,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const { disciplineId, categoryId, locality, department, format } = query;
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
  async exportResults(
    @Query() query: ResultsReportQueryDto,
    @Res() res: Response,
    @CurrentUser() actor: JwtPayload,
  ) {
    const { competitionId, format } = query;
    const espec = this.reportsService.especificacionResults(
      await this.scope.alcanceDe(actor),
      competitionId,
    );
    return this.enviar(res, espec, this.esExcel(format), 'resultados');
  }
}
