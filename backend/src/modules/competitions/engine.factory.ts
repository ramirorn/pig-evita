// ===========================================
// Engine Factory (Strategy Pattern)
// ===========================================
import { Injectable, NotImplementedException } from '@nestjs/common';
import { CompetitionFormat, Competition, Match } from '@prisma/client';
import {
  ClienteFixture,
  Cruce,
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
 * Un formato de competencia: sólo sabe armar los cruces (función pura). No
 * depende de Prisma: la escritura recibe el cliente de quien llama (DIP), que
 * en el service es el de la transacción (F-13).
 */
export interface IFixtureEngine {
  pairings(ids: readonly string[]): Cruce[];
  generateFixture(
    competition: Pick<Competition, 'id'>,
    participantOrTeamIds: string[],
    tipo: TipoDeCompetidor,
    db: ClienteFixture,
  ): Promise<Match[]>;
}

/** Escritura común a todos los formatos (template method sobre `pairings`). */
abstract class FixtureEngine implements IFixtureEngine {
  protected abstract readonly formatName: string;

  abstract pairings(ids: readonly string[]): Cruce[];

  async generateFixture(
    competition: Pick<Competition, 'id'>,
    ids: string[],
    tipo: TipoDeCompetidor,
    db: ClienteFixture,
  ): Promise<Match[]> {
    if (ids.length < 2) {
      throw new Error(
        `Se necesitan al menos 2 participantes/equipos para ${this.formatName}`,
      );
    }
    return escribirCruces(db, competition.id, this.pairings(ids), tipo);
  }
}

/**
 * Todos contra todos. Con cantidad impar, en cada fecha alguien descansa y
 * ese cruce no se escribe. La entrada no se muta.
 */
@Injectable()
export class RoundRobinEngine extends FixtureEngine {
  protected readonly formatName = 'Round Robin';
  pairings(ids: readonly string[]): Cruce[] {
    return crucesTodosContraTodos(ids);
  }
}

/**
 * Eliminación directa (F-14): sólo la primera ronda, con byes si la cantidad
 * no es potencia de 2. Las siguientes las arma `avanzarLlave` al cerrarse la
 * anterior: hasta entonces no se sabe quién las juega.
 */
@Injectable()
export class EliminacionDirectaEngine extends FixtureEngine {
  protected readonly formatName = 'Eliminación Directa';
  pairings(ids: readonly string[]): Cruce[] {
    return primeraRondaEliminacion(ids);
  }
}

/**
 * Fase de grupos (F-14): grupos de 3 o 4 y todos contra todos dentro de cada
 * uno, con el mismo emparejamiento del round robin.
 */
@Injectable()
export class FaseGruposEngine extends FixtureEngine {
  protected readonly formatName = 'Fase de Grupos';
  pairings(ids: readonly string[]): Cruce[] {
    return crucesFaseDeGrupos(ids);
  }
}

/**
 * Un motor por formato. Es un `Record` sobre el enum de Prisma: agregar un
 * formato al esquema no compila hasta registrar su motor (OCP: un formato nuevo
 * es una clase nueva y una entrada acá, sin tocar a los demás).
 */
@Injectable()
export class EngineFactory {
  private readonly engines: Record<CompetitionFormat, IFixtureEngine>;

  constructor(
    roundRobin: RoundRobinEngine,
    eliminacionDirecta: EliminacionDirectaEngine,
    faseGrupos: FaseGruposEngine,
  ) {
    this.engines = {
      [CompetitionFormat.ROUND_ROBIN]: roundRobin,
      [CompetitionFormat.ELIMINACION_DIRECTA]: eliminacionDirecta,
      [CompetitionFormat.FASE_GRUPOS]: faseGrupos,
    };
  }

  getEngine(format: CompetitionFormat): IFixtureEngine {
    const engine = this.engines[format];
    if (!engine) {
      throw new NotImplementedException(
        `El formato ${String(format)} aún no está implementado`,
      );
    }
    return engine;
  }
}
