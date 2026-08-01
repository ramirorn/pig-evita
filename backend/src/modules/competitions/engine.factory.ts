// ===========================================
// Engine Factory (Strategy Pattern)
// ===========================================
import { Injectable, NotImplementedException } from '@nestjs/common';
import { CompetitionFormat, Competition, Match } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Interfaz base para los motores de fixture
 */
export interface IFixtureEngine {
  generateFixture(
    competition: Competition,
    participantOrTeamIds: string[],
  ): Promise<Match[]>;
}

@Injectable()
export class RoundRobinEngine implements IFixtureEngine {
  constructor(private readonly prisma: PrismaService) {}

  async generateFixture(
    competition: Competition,
    ids: string[],
  ): Promise<Match[]> {
    if (ids.length < 2) {
      throw new Error(
        'Se necesitan al menos 2 participantes/equipos para Round Robin',
      );
    }

    // Agregar un "bye" (descanso) si son impares
    const isOdd = ids.length % 2 !== 0;
    if (isOdd) {
      ids.push('BYE');
    }

    const numTeams = ids.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;
    const matchesToCreate: any[] = [];
    const teamIds = [...ids];

    for (let round = 0; round < numRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = teamIds[match];
        const away = teamIds[numTeams - 1 - match];

        // No creamos partido si uno es BYE (descanso)
        if (home !== 'BYE' && away !== 'BYE') {
          matchesToCreate.push({
            competitionId: competition.id,
            round: round + 1,
            matchNumber: match + 1,
            status: 'PROGRAMADO',
            homeId: home,
            awayId: away,
          });
        }
      }
      // Rotación de matriz
      teamIds.splice(1, 0, teamIds.pop()!);
    }

    // Insertar todos los partidos y crear sus resultados pendientes
    const createdMatches = [];
    for (const matchData of matchesToCreate) {
      const { homeId, awayId, ...rest } = matchData;

      const createdMatch = await this.prisma.match.create({
        data: rest,
      });

      // Crear registros en Result para que sepamos quién juega en este partido
      const isTeam =
        typeof homeId === 'string' &&
        homeId.length > 0 &&
        homeId !== 'BYE' &&
        homeId.includes('-'); // uuid check simple

      const resultData = isTeam
        ? [
            { matchId: createdMatch.id, teamId: homeId, scoreData: {} },
            { matchId: createdMatch.id, teamId: awayId, scoreData: {} },
          ]
        : [
            { matchId: createdMatch.id, participantId: homeId, scoreData: {} },
            { matchId: createdMatch.id, participantId: awayId, scoreData: {} },
          ];

      await this.prisma.result.createMany({ data: resultData as any });

      createdMatches.push(createdMatch);
    }

    return createdMatches;
  }
}

@Injectable()
export class EngineFactory {
  constructor(private readonly roundRobinEngine: RoundRobinEngine) {}

  getEngine(format: CompetitionFormat): IFixtureEngine {
    switch (format) {
      case 'ROUND_ROBIN':
        return this.roundRobinEngine;
      case 'ELIMINACION_DIRECTA':
      case 'FASE_GRUPOS':
      default:
        throw new NotImplementedException(
          `El formato ${format} aún no está implementado`,
        );
    }
  }
}
