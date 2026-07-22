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
  async exportParticipants(
    @Query('categoryId') categoryId: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateParticipantsCsv(categoryId);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="participantes.csv"');
    return res.status(200).send(csv);
  }

  @Get('teams')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @ApiOperation({ summary: 'Exportar lista de equipos a CSV' })
  async exportTeams(
    @Query('disciplineId') disciplineId: string,
    @Res() res: Response
  ) {
    const csv = await this.reportsService.generateTeamsCsv(disciplineId);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="equipos.csv"');
    return res.status(200).send(csv);
  }
}
