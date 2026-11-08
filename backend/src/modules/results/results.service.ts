// ===========================================
// Results Service
// ===========================================
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DISCIPLINE_IN_COMPETITION } from '../../common/prisma-selects';
import { Role } from '../../common/constants';
import { avanzarLlave } from '../competitions/bracket';
import { MatchResultDto } from './dto';
import {
  FilaDeTabla,
  PUNTOS_POR,
  compararFilas,
  desenlaces,
  gruposDelFixture,
  marcadores,
} from './standings';

/**
 * Quién puede corregir un resultado ya cargado (CA-C3.4, F-11).
 *
 * Vive acá y no en `ACCIONES` porque no es un permiso de ruta: el `PATCH` es
 * el mismo para cargar y para corregir, y lo que cambia es el estado del
 * partido. La ruta sigue protegida por `ACCIONES.RESULT_LOAD`; esto se evalúa
 * después, contra el partido.
 */
export const RESULT_CORRECT: readonly string[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
];

interface ResultadoConGanador {
  teamId: string | null;
  participantId: string | null;
  isWinner: boolean | null;
}

/** El único resultado con `isWinner`, o `null` si no hay uno solo. */
function ganadorUnico(rs: ReadonlyArray<ResultadoConGanador>): string | null {
  const ganan = rs.filter((r) => r.isWinner === true);
  return ganan.length === 1
    ? (ganan[0].teamId ?? ganan[0].participantId)
    : null;
}

/** Quién está cargando: sólo hace falta el rol (y el id para el log). */
export interface CargadorDeResultados {
  sub?: string;
  role: string;
}

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carga o corrige los resultados de un partido y lo deja `FINALIZADO`.
   *
   * - F-10: una lista vacía, un `resultId` que no es de este partido o uno
   *   repetido responden 400 y el partido no cambia (antes se ignoraban en
   *   silencio y el partido quedaba finalizado igual).
   * - F-11: si el partido ya estaba `FINALIZADO`, es una corrección y sólo la
   *   hace `RESULT_CORRECT`. Queda auditada por el `AuditInterceptor`, como
   *   toda escritura: acción UPDATE sobre `results`, con el id del partido y
   *   el cuerpo enviado; la fila de la carga original guarda los valores
   *   previos.
   * - Eliminación directa: el partido necesita exactamente un ganador, y al
   *   cerrarse la ronda se arma la siguiente (`avanzarLlave`).
   */
  async updateMatchResults(
    matchId: string,
    resultsToUpdate: MatchResultDto[],
    usuario: CargadorDeResultados,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        results: true,
        competition: { select: { id: true, format: true } },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    this.validarCarga(match.results, resultsToUpdate);

    const esCorreccion = match.status === 'FINALIZADO';
    if (esCorreccion && !RESULT_CORRECT.includes(usuario.role)) {
      throw new ForbiddenException(
        'El partido ya tiene resultado cargado: sólo un ADMIN_PROVINCIAL o superior puede corregirlo',
      );
    }

    // `competition` siempre viene en la consulta real; el `?.` cubre los
    // dobles de Prisma de los tests que no la incluyen.
    const competitionId = match.competition?.id ?? match.competitionId;
    const esLlave = match.competition?.format === 'ELIMINACION_DIRECTA';
    if (esLlave && match.results.length < 2) {
      throw new BadRequestException(
        'Es un pase directo (bye): no tiene resultado para cargar',
      );
    }

    // Se toma antes de escribir: es contra quién pasó de ronda que se compara.
    const ganadorPrevio = ganadorUnico(match.results);

    await this.prisma.$transaction(async (tx) => {
      if (esLlave) {
        // Serializa los cierres de partidos de la misma llave: ver `avanzarLlave`.
        await tx.$queryRaw`SELECT id FROM competitions WHERE id = ${competitionId}::uuid FOR UPDATE`;
      }

      const finales = new Map(match.results.map((r) => [r.id, r]));
      for (const result of resultsToUpdate) {
        const existingResult = finales.get(result.resultId)!;
        const updated = await tx.result.update({
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
        finales.set(updated.id, updated);
      }

      if (esLlave) {
        await this.validarLlave(tx, match, ganadorPrevio, [
          ...finales.values(),
        ]);
      }

      await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'FINALIZADO',
          // Una corrección no cambia cuándo terminó el partido.
          finishedAt: match.finishedAt ?? new Date(),
        },
      });

      if (esLlave) {
        await avanzarLlave(tx, competitionId);
      }
    });

    if (esCorreccion) {
      this.logger.warn(
        `Results of match ${matchId} corrected by ${usuario.sub ?? 'unknown'} (${usuario.role})`,
      );
    } else {
      this.logger.log(`Results updated for match ${matchId}`);
    }

    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: { results: true },
    });
  }

  /** F-10: todo `resultId` tiene que ser de este partido, sin repetir. */
  private validarCarga(
    propios: ReadonlyArray<{ id: string }>,
    resultsToUpdate: unknown,
  ) {
    if (!Array.isArray(resultsToUpdate) || resultsToUpdate.length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un resultado del partido',
      );
    }

    const idsPropios = new Set(propios.map((r) => r.id));
    const vistos = new Set<string>();
    for (const item of resultsToUpdate as Array<Partial<MatchResultDto>>) {
      const id = item?.resultId;
      if (typeof id !== 'string' || !idsPropios.has(id)) {
        throw new BadRequestException(
          `El resultado ${String(id)} no pertenece a este partido`,
        );
      }
      if (vistos.has(id)) {
        throw new BadRequestException(`El resultado ${id} está repetido`);
      }
      if (!item.data || typeof item.data !== 'object') {
        throw new BadRequestException(`Faltan los datos del resultado ${id}`);
      }
      vistos.add(id);
    }
  }

  /**
   * Eliminación directa: exactamente un ganador, y una vez que la llave avanzó
   * no se puede cambiar quién pasó de ronda (la ronda siguiente ya se jugó o
   * se está jugando con él).
   */
  private async validarLlave(
    tx: Prisma.TransactionClient,
    match: { competitionId: string; round: number },
    ganadorPrevio: string | null,
    finales: ReadonlyArray<ResultadoConGanador>,
  ) {
    const ganador = ganadorUnico(finales);
    if (!ganador) {
      throw new BadRequestException(
        'En eliminación directa el partido tiene que tener exactamente un ganador',
      );
    }

    const rondasPosteriores = await tx.match.count({
      where: { competitionId: match.competitionId, round: { gt: match.round } },
    });
    if (rondasPosteriores > 0 && ganadorPrevio !== ganador) {
      throw new ConflictException(
        'La llave ya avanzó a la ronda siguiente: no se puede cambiar el ganador de este partido',
      );
    }
  }

  /**
   * Tabla de posiciones de una competencia (F-12).
   *
   * Victoria 3, empate 1, derrota 0. Un partido sin `isWinner` se decide por el
   * marcador según el `resultType` de la disciplina (en TIEMPO y POSICIONES
   * gana el número más chico); si no hay marcador legible o es igual, es
   * empate. Los pases directos de una llave (un solo competidor) no cuentan.
   * En FASE_GRUPOS cada fila lleva su `group` y la posición es dentro del
   * grupo.
   */
  async getRankings(competitionId: string): Promise<FilaDeTabla[]> {
    const competition = await this.prisma.competition.findUnique({
      where: { id: competitionId },
      // La tabla de posiciones sólo necesita, por cada resultado, a quién
      // corresponde y cómo le fue. Traer `team` y `participant` completos
      // cargaba toda la ficha del participante (DNI, contacto, domicilio) para
      // terminar usando su nombre.
      select: {
        id: true,
        format: true,
        matches: {
          where: { status: 'FINALIZADO' },
          select: {
            id: true,
            results: {
              select: {
                teamId: true,
                participantId: true,
                isWinner: true,
                scoreData: true,
                ranking: true,
                team: { select: { id: true, name: true } },
                participant: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
        discipline: { select: DISCIPLINE_IN_COMPETITION },
      },
    });

    if (!competition) {
      throw new NotFoundException('Competencia no encontrada');
    }

    const tipo = competition.discipline?.resultType;
    const filas = new Map<string, FilaDeTabla>();

    for (const match of competition.matches) {
      const resultados = match.results.filter(
        (r) => r.teamId || r.participantId,
      );
      if (resultados.length < 2) continue; // bye: nadie jugó

      const desenlace = desenlaces(resultados, tipo);
      const valores = marcadores(resultados, tipo);

      resultados.forEach((result, i) => {
        const id = (result.teamId ?? result.participantId)!;
        let fila = filas.get(id);
        if (!fila) {
          fila = {
            position: 0,
            id,
            name:
              result.team?.name ??
              `${result.participant?.firstName ?? ''} ${result.participant?.lastName ?? ''}`.trim(),
            teamId: result.teamId ?? null,
            participantId: result.participantId ?? null,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            points: 0,
            scoreFor: 0,
            scoreAgainst: 0,
          };
          filas.set(id, fila);
        }

        fila.played += 1;
        fila.points += PUNTOS_POR[desenlace[i]];
        if (desenlace[i] === 'GANO') fila.won += 1;
        else if (desenlace[i] === 'EMPATO') fila.drawn += 1;
        else fila.lost += 1;

        if (valores) {
          fila.scoreFor += valores[i];
          if (valores.length === 2) fila.scoreAgainst += valores[1 - i];
        }
      });
    }

    const tabla = [...filas.values()];

    if (competition.format === 'FASE_GRUPOS') {
      // El grupo sale del fixture completo, no sólo de lo jugado: con media
      // fecha jugada, un grupo de 4 todavía no está conectado.
      const fixture = await this.prisma.match.findMany({
        where: { competitionId },
        select: {
          results: { select: { teamId: true, participantId: true } },
        },
        orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      });
      const grupos = gruposDelFixture(fixture);
      for (const fila of tabla) fila.group = grupos.get(fila.id);
    }

    const orden = compararFilas(tipo);
    tabla.sort(
      (a, b) => (a.group ?? '').localeCompare(b.group ?? '') || orden(a, b),
    );

    const posicionPorGrupo = new Map<string, number>();
    for (const fila of tabla) {
      const clave = fila.group ?? '';
      const posicion = (posicionPorGrupo.get(clave) ?? 0) + 1;
      posicionPorGrupo.set(clave, posicion);
      fila.position = posicion;
    }

    return tabla;
  }
}
