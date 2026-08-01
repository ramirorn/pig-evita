// ===========================================
// Results Service
// ===========================================
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MatchResultDto } from './dto';

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Actualiza los resultados de un partido (usualmente los 2 competidores al mismo tiempo)
   */
  async updateMatchResults(matchId: string, resultsToUpdate: MatchResultDto[]) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { results: true },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    const updatedResults = [];

    // Usamos una transacción para asegurar consistencia
    await this.prisma.$transaction(async (prisma) => {
      for (const result of resultsToUpdate) {
        // Verificar que el resultado pertenezca a este partido
        const existingResult = match.results.find(
          (r) => r.id === result.resultId,
        );
        if (!existingResult) continue;

        const updated = await prisma.result.update({
          where: { id: result.resultId },
          data: {
            scoreData: result.data.scoreData
              ? (result.data.scoreData as Prisma.InputJsonValue)
              : (existingResult.scoreData as Prisma.InputJsonValue),
            ranking:
              result.data.ranking !== undefined
                ? result.data.ranking
                : existingResult.ranking,
            isWinner:
              result.data.isWinner !== undefined
                ? result.data.isWinner
                : existingResult.isWinner,
          },
        });

        updatedResults.push(updated);
      }

      // Actualizar el estado del partido a FINALIZADO
      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'FINALIZADO',
          finishedAt: new Date(),
        },
      });
    });

    this.logger.log(`Results updated for match ${matchId}`);

    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: { results: true },
    });
  }

  /**
   * Obtiene la tabla de posiciones de una competencia
   */
  async getRankings(competitionId: string) {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        matches: {
          where: { status: 'FINALIZADO' },
          include: {
            results: {
              include: { team: true, participant: true },
            },
          },
        },
        discipline: true,
      },
    });

    if (!competition) {
      throw new NotFoundException('Competencia no encontrada');
    }

    // Aquí iría la lógica compleja de ranking según el tipo de resultado (GOLES, SETS, etc.)
    // Por simplicidad en este sprint, agruparemos las victorias y calcularemos puntos básicos.

    const rankings = new Map<string, any>();

    for (const match of competition.matches) {
      for (const result of match.results) {
        const entityId = result.teamId || result.participantId;
        const name =
          result.team?.name ||
          `${result.participant?.firstName} ${result.participant?.lastName}`;

        if (!entityId) continue;

        if (!rankings.has(entityId)) {
          rankings.set(entityId, {
            id: entityId,
            name,
            played: 0,
            won: 0,
            lost: 0,
            points: 0,
            scoreDataAcc: {}, // Acumulador de goles, tiempos, etc
          });
        }

        const stats = rankings.get(entityId);
        stats.played += 1;

        if (result.isWinner) {
          stats.won += 1;
          stats.points += 3; // Lógica estándar (modificable por config de competencia)
        } else {
          stats.lost += 1;
        }
      }
    }

    // Convertir a array y ordenar por puntos (descendente)
    return Array.from(rankings.values()).sort((a, b) => b.points - a.points);
  }
}
