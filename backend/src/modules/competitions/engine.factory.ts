// ===========================================
// Engine Factory (Strategy Pattern)
// ===========================================
import { Injectable, NotImplementedException } from '@nestjs/common';
import { CompetitionFormat, Competition, Match } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ClienteFixture,
  TipoDeCompetidor,
  crucesFaseDeGrupos,
  crucesTodosContraTodos,
  escribirCruces,
  primeraRondaEliminacion,
} from './bracket';

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
export type { TipoDeCompetidor } from './bracket';

/**
 * Interfaz base para los motores de fixture.
 *
 * `db` es el cliente de la transacción del service (F-13). Si se omite, el
 * motor escribe con su `PrismaService`.
 */
export interface IFixtureEngine {
  generateFixture(
    competition: Pick<Competition, 'id'>,
    participantOrTeamIds: string[],
    tipo: TipoDeCompetidor,
    db?: ClienteFixture,
  ): Promise<Match[]>;
}

function exigirDos(ids: readonly string[], formato: string) {
  if (ids.length < 2) {
    throw new Error(
      `Se necesitan al menos 2 participantes/equipos para ${formato}`,
    );
  }
}

/**
 * Todos contra todos. Con cantidad impar, en cada fecha alguien descansa y
 * ese cruce no se escribe.
 *
 * La entrada no se muta: el 'BYE' se agregaba sobre el `teamIds` del DTO y un
 * segundo uso del mismo arreglo veía un competidor que nadie mandó.
 */
@Injectable()
export class RoundRobinEngine implements IFixtureEngine {
  constructor(private readonly prisma: PrismaService) {}

  async generateFixture(
    competition: Pick<Competition, 'id'>,
    ids: string[],
    tipo: TipoDeCompetidor,
    db: ClienteFixture = this.prisma,
  ): Promise<Match[]> {
    exigirDos(ids, 'Round Robin');
    return escribirCruces(
      db,
      competition.id,
      crucesTodosContraTodos(ids),
      tipo,
    );
  }
}

/**
 * Eliminación directa (F-14).
 *
 * Escribe sólo la primera ronda, con byes si la cantidad no es potencia de 2.
 * Las rondas siguientes las arma `avanzarLlave` cuando se cierra la anterior:
 * hasta entonces no se sabe quién las juega, y el modelo no tiene partidos con
 * casilleros vacíos.
 */
@Injectable()
export class EliminacionDirectaEngine implements IFixtureEngine {
  constructor(private readonly prisma: PrismaService) {}

  async generateFixture(
    competition: Pick<Competition, 'id'>,
    ids: string[],
    tipo: TipoDeCompetidor,
    db: ClienteFixture = this.prisma,
  ): Promise<Match[]> {
    exigirDos(ids, 'Eliminación Directa');
    return escribirCruces(
      db,
      competition.id,
      primeraRondaEliminacion(ids),
      tipo,
    );
  }
}

/**
 * Fase de grupos (F-14): grupos de 3 o 4 (ver `repartirEnGrupos`) y todos
 * contra todos dentro de cada uno, reusando el mismo emparejamiento del round
 * robin.
 */
@Injectable()
export class FaseGruposEngine implements IFixtureEngine {
  constructor(private readonly prisma: PrismaService) {}

  async generateFixture(
    competition: Pick<Competition, 'id'>,
    ids: string[],
    tipo: TipoDeCompetidor,
    db: ClienteFixture = this.prisma,
  ): Promise<Match[]> {
    exigirDos(ids, 'Fase de Grupos');
    return escribirCruces(db, competition.id, crucesFaseDeGrupos(ids), tipo);
  }
}

@Injectable()
export class EngineFactory {
  constructor(
    private readonly roundRobinEngine: RoundRobinEngine,
    private readonly eliminacionDirectaEngine: EliminacionDirectaEngine,
    private readonly faseGruposEngine: FaseGruposEngine,
  ) {}

  getEngine(format: CompetitionFormat): IFixtureEngine {
    switch (format) {
      case 'ROUND_ROBIN':
        return this.roundRobinEngine;
      case 'ELIMINACION_DIRECTA':
        return this.eliminacionDirectaEngine;
      case 'FASE_GRUPOS':
        return this.faseGruposEngine;
      default:
        throw new NotImplementedException(
          `El formato ${String(format)} aún no está implementado`,
        );
    }
  }
}
