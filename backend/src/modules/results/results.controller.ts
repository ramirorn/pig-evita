// ===========================================
// Results Controller
// ===========================================
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { MatchResultDto } from './dto';
import { Roles, Public, PublicReadThrottle } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Results')
@Controller('results')
@ApiBearerAuth('access-token')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Patch('match/:matchId')
  @Roles(...ADMIN_ROLES, Role.ARBITRO)
  @ApiOperation({ summary: 'Cargar/Actualizar resultados de un partido' })
  @ApiResponse({
    status: 200,
    description: 'Resultados guardados y partido finalizado',
  })
  async updateMatchResults(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() results: MatchResultDto[],
  ) {
    return this.resultsService.updateMatchResults(matchId, results);
  }

  @Get('rankings/competition/:competitionId')
  @Public() // Las tablas de posiciones son públicas
  @PublicReadThrottle()
  @ApiOperation({
    summary: 'Obtener tabla de posiciones/ranking de una competencia',
  })
  @ApiResponse({ status: 200, description: 'Tabla de posiciones' })
  async getRankings(
    @Param('competitionId', ParseUUIDPipe) competitionId: string,
  ) {
    return this.resultsService.getRankings(competitionId);
  }
}
