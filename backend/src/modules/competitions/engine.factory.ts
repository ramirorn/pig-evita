// ===========================================
// Engine Factory (Strategy Pattern)
// ===========================================
import { Injectable, NotImplementedException } from '@nestjs/common';
import { CompetitionFormat, Competition, Match, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Qué representan los ids que recibe el motor.
 *
 * Lo decide quien llama —que sabe si el DTO trajo `teamIds` o
 * `participantIds`— y no el motor. Antes se adivinaba con
 * `homeId.includes('-')`, un "chequeo simple de uuid" que **los ids de
 * participante también cumplen**: la rama individual era código muerto y
 * generar el fixture de una disciplina individual escribía un `teamId`
 * apuntando a un participante, o sea un 500 por violación de la foreign key.
 */
export type TipoDeCompetidor = 'team' | 'participant';

/**
 * Interfaz base para los motores de fixture
 */
export interface IFixtureEngine {
  generateFixture(
    competition: Competition,
    participantOrTeamIds: string[],
    tipo: TipoDeCompetidor,
  ): Promise<Match[]>;
}

@Injectable()
export class RoundRobinEngine implements IFixtureEngine {
  constructor(private readonly prisma: PrismaService) {}

  async generateFixture(
    competition: Competition,
    ids: string[],
    tipo: TipoDeCompetidor,
  ): Promise<Match[]> {
    if (ids.length < 2) {
      throw new Error(
        'Se necesitan al menos 2 participantes/equipos para Round Robin',
      );
    }

    // Agregar un "bye" (descanso) si son impares.
    //
    // Sobre una **copia**: el `push` iba contra el arreglo del llamador, que es
    // el `teamIds` del DTO. Mutar la entrada hacía que un segundo uso del mismo
    // arreglo viera un competidor 'BYE' que nadie mandó.
    const competidores = [...ids];
    if (competidores.length % 2 !== 0) {
      competidores.push('BYE');
    }

    const numTeams = competidores.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;
    const matchesToCreate: any[] = [];
    const teamIds = [...competidores];

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

      // Crear registros en Result para que sepamos quién juega en este partido.
      //
      // `isHome` se persiste acá (R23) porque **es acá donde el dato existe**:
      // el algoritmo ya distingue `home` de `away` al armar el cruce, y hasta
      // ahora esa distinción se perdía al guardar. La pantalla del fixture
      // terminaba infiriendo la localía del orden de las filas, que Postgres no
      // garantiza.
      const campoId = tipo === 'team' ? 'teamId' : 'participantId';

      await this.prisma.result.createMany({
        data: [
          { matchId: createdMatch.id, [campoId]: homeId, scoreData: {}, isHome: true },
          { matchId: createdMatch.id, [campoId]: awayId, scoreData: {}, isHome: false },
        ] as Prisma.ResultCreateManyInput[],
      });

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
