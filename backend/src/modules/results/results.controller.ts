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
import type { CargadorDeResultados } from './results.service';
import { MatchResultDto } from './dto';
import {
  Roles,
  Public,
  PublicReadThrottle,
  CurrentUser,
} from '../../common/decorators';
import { ACCIONES } from '../../common/constants';

@ApiTags('Results')
@Controller('results')
@ApiBearerAuth('access-token')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Patch('match/:matchId')
  @Roles(...ACCIONES.RESULT_LOAD)
  @ApiOperation({ summary: 'Cargar/Actualizar resultados de un partido' })
  @ApiResponse({
    status: 200,
    description: 'Resultados guardados y partido finalizado',
  })
  @ApiResponse({
    status: 400,
    description: 'Lista vacía o resultado que no pertenece al partido',
  })
  @ApiResponse({
    status: 403,
    description:
      'El partido ya estaba finalizado: sólo ADMIN_PROVINCIAL o SUPER_ADMIN corrigen (CA-C3.4)',
  })
  async updateMatchResults(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() results: MatchResultDto[],
    @CurrentUser() usuario: CargadorDeResultados,
  ) {
    return this.resultsService.updateMatchResults(matchId, results, usuario);
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
