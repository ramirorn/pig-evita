// ===========================================
// Reports Controller
// ===========================================
import {
  Controller,
  Get,
  Res,
  Query,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Reports')
@Controller('reports')
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('participants')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Exportar lista de participantes a CSV' })
  @ApiQuery({ name: 'categoryId', required: false })
  async exportParticipants(
    @Query('categoryId') categoryId: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateParticipantsCsv(categoryId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="padron_participantes.csv"');
    return res.status(200).send('\uFEFF' + csv);
  }

  @Get('inscriptions')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Exportar inscripciones a CSV' })
  @ApiQuery({ name: 'disciplineId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async exportInscriptions(
    @Query('disciplineId') disciplineId: string,
    @Query('categoryId') categoryId: string,
    @Query('status') status: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateInscriptionsCsv(disciplineId, categoryId, status);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inscripciones.csv"');
    return res.status(200).send('\uFEFF' + csv);
  }

  @Get('teams')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Exportar lista de equipos a CSV' })
  @ApiQuery({ name: 'disciplineId', required: false })
  async exportTeams(
    @Query('disciplineId') disciplineId: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateTeamsCsv(disciplineId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="equipos.csv"');
    return res.status(200).send('\uFEFF' + csv);
  }

  @Get('results')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Exportar resultados y partidos a CSV' })
  @ApiQuery({ name: 'competitionId', required: false })
  async exportResults(
    @Query('competitionId') competitionId: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateResultsCsv(competitionId);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados.csv"');
    return res.status(200).send('\uFEFF' + csv);
  }
}

