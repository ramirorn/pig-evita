// ===========================================
// Llave de eliminación directa y fase de grupos (F-14)
// ===========================================
//
// Funciones puras de emparejamiento + la escritura de partidos que comparten
// los tres motores. Viven aparte de `engine.factory.ts` porque la llave
// también la avanza `ResultsService` cuando se cierra una ronda, y ese módulo
// no tiene por qué inyectar los motores para eso.
import { Prisma, Match } from '@prisma/client';

/** Qué representan los ids: lo decide quien llama (ver `engine.factory.ts`). */
export type TipoDeCompetidor = 'team' | 'participant';

/**
 * Cliente con el que se escribe el fixture.
 *
 * Es el `tx` de la transacción que abre `CompetitionsService.generateFixture`
 * (F-13: si algo falla a mitad de camino no queda un fixture a medias), o el
 * `PrismaService` cuando un motor se usa suelto, como en los tests unitarios.
 */
export type ClienteFixture = Pick<Prisma.TransactionClient, 'match' | 'result'>;

/**
 * Un cruce a escribir. `awayId === null` es un **bye**: el competidor pasa de
 * ronda sin jugar.
 */
export interface Cruce {
  round: number;
  matchNumber: number;
  homeId: string;
  awayId: string | null;
}

/** Nota interna (no sale en `MATCH_PUBLIC`) que marca un pase directo. */
export const NOTA_BYE = 'Pasa directo (bye)';

/**
 * Todos contra todos por el método del círculo.
 *
 * Con cantidad impar se agrega un descanso (`null`) que no genera partido. La
 * entrada no se muta: es el arreglo del DTO.
 */
export function crucesTodosContraTodos(
  ids: readonly string[],
): Array<Omit<Cruce, 'awayId'> & { awayId: string }> {
  const casilleros: Array<string | null> = [...ids];
  if (casilleros.length % 2 !== 0) casilleros.push(null);

  const total = casilleros.length;
  const cruces: Array<Omit<Cruce, 'awayId'> & { awayId: string }> = [];

  for (let ronda = 0; ronda < total - 1; ronda++) {
    for (let i = 0; i < total / 2; i++) {
      const home = casilleros[i];
      const away = casilleros[total - 1 - i];
      // Contra el descanso no hay partido.
      if (home !== null && away !== null) {
        cruces.push({
          round: ronda + 1,
          matchNumber: i + 1,
          homeId: home,
          awayId: away,
        });
      }
    }
    // Rotación: el primero queda fijo y el resto gira.
    casilleros.splice(1, 0, casilleros.pop()!);
  }

  return cruces;
}

/**
 * Orden de siembra de una llave de `tamano` casilleros (potencia de 2).
 *
 * `[1, 8, 4, 5, 2, 7, 3, 6]` para 8: el 1 y el 2 quedan en mitades opuestas y
 * sólo pueden cruzarse en la final. Los casilleros por encima de la cantidad
 * real de competidores son byes, y por construcción le tocan a los mejores
 * sembrados: nunca hay un bye contra otro bye.
 */
export function ordenDeSiembra(tamano: number): number[] {
  let orden = [1];
  while (orden.length < tamano) {
    const largo = orden.length * 2;
    orden = orden.flatMap((s) => [s, largo + 1 - s]);
  }
  return orden;
}

/**
 * Primera ronda de la eliminación directa.
 *
 * Los ids se toman como siembra en el orden recibido (el primero es el
 * cabeza de serie 1). Si la cantidad no es potencia de 2 se completa la llave
 * con byes: esos cruces se escriben con un solo competidor y ya finalizados,
 * así la ronda siguiente se arma sólo con datos de la base, sin guardar en
 * ningún otro lado quién pasó directo.
 */
export function primeraRondaEliminacion(ids: readonly string[]): Cruce[] {
  let tamano = 1;
  while (tamano < ids.length) tamano *= 2;

  const orden = ordenDeSiembra(tamano);
  const cruces: Cruce[] = [];
  for (let i = 0; i < orden.length; i += 2) {
    const a = ids[orden[i] - 1] ?? null;
    const b = ids[orden[i + 1] - 1] ?? null;
    const home = a ?? b;
    if (home === null) continue; // imposible con >= 2 competidores
    cruces.push({
      round: 1,
      matchNumber: i / 2 + 1,
      homeId: home,
      awayId: a !== null ? b : null,
    });
  }
  return cruces;
}

/**
 * Reparte los ids en grupos de 3 o 4.
 *
 * Cantidad de grupos: `ceil(n / 4)`; si con eso algún grupo quedara de menos
 * de 3, se usan `floor(n / 3)` (mínimo 1). Así 4 → 1×4, 5 → 1×5, 6 → 2×3,
 * 8 → 2×4, 12 → 3×4, 13 → 4+3+3+3. El reparto es alternado (A, B, C, A, B…)
 * sobre el orden recibido, para que los primeros sembrados caigan en grupos
 * distintos.
 */
export function repartirEnGrupos(ids: readonly string[]): string[][] {
  const n = ids.length;
  let grupos = Math.max(1, Math.ceil(n / 4));
  if (Math.floor(n / grupos) < 3) grupos = Math.max(1, Math.floor(n / 3));

  const salida: string[][] = Array.from({ length: grupos }, () => []);
  ids.forEach((id, i) => salida[i % grupos].push(id));
  return salida;
}

/**
 * Cruces de la fase de grupos: todos contra todos dentro de cada grupo.
 *
 * La fecha `r` junta la fecha `r` de todos los grupos, con `matchNumber`
 * correlativo dentro de la fecha (grupo A primero). El grupo de cada partido no
 * se persiste: se deduce de quién jugó con quién (ver
 * `ResultsService.getRankings`), porque cada grupo es un todos contra todos
 * cerrado y no comparte competidores con otro.
 */
export function crucesFaseDeGrupos(ids: readonly string[]): Cruce[] {
  const porFecha = new Map<number, Cruce[]>();
  for (const grupo of repartirEnGrupos(ids)) {
    for (const cruce of crucesTodosContraTodos(grupo)) {
      porFecha.set(cruce.round, [...(porFecha.get(cruce.round) ?? []), cruce]);
    }
  }

  const cruces: Cruce[] = [];
  for (const fecha of [...porFecha.keys()].sort((a, b) => a - b)) {
    porFecha
      .get(fecha)!
      .forEach((cruce, i) => cruces.push({ ...cruce, matchNumber: i + 1 }));
  }
  return cruces;
}

/**
 * Escribe los cruces y sus `Result` pendientes.
 *
 * `isHome` se persiste acá (R23) porque es acá donde el dato existe: el
 * algoritmo ya distingue local de visitante al armar el cruce. Un bye se
 * escribe con un único resultado ganador (`isHome` null: no hay rival) y el
 * partido ya `FINALIZADO`.
 */
export async function escribirCruces(
  db: ClienteFixture,
  competitionId: string,
  cruces: readonly Cruce[],
  tipo: TipoDeCompetidor,
): Promise<Match[]> {
  const campoId = tipo === 'team' ? 'teamId' : 'participantId';
  const creados: Match[] = [];

  for (const cruce of cruces) {
    const esBye = cruce.awayId === null;
    const partido = await db.match.create({
      data: {
        competitionId,
        round: cruce.round,
        matchNumber: cruce.matchNumber,
        status: esBye ? 'FINALIZADO' : 'PROGRAMADO',
        ...(esBye ? { finishedAt: new Date(), notes: NOTA_BYE } : {}),
      },
    });

    const filas = esBye
      ? [
          {
            matchId: partido.id,
            [campoId]: cruce.homeId,
            scoreData: {},
            isWinner: true,
            isHome: null,
          },
        ]
      : [
          {
            matchId: partido.id,
            [campoId]: cruce.homeId,
            scoreData: {},
            isHome: true,
          },
          {
            matchId: partido.id,
            [campoId]: cruce.awayId,
            scoreData: {},
            isHome: false,
          },
        ];

    await db.result.createMany({
      data: filas as Prisma.ResultCreateManyInput[],
    });
    creados.push(partido);
  }

  return creados;
}

/** Lo mínimo que hace falta de un partido para avanzar la llave. */
export interface PartidoDeLlave {
  round: number;
  matchNumber: number;
  status: string;
  results: Array<{
    teamId: string | null;
    participantId: string | null;
    isWinner: boolean | null;
  }>;
}

/**
 * Cruces de la ronda siguiente de una eliminación directa, o `null` si todavía
 * no corresponde armarla.
 *
 * Corresponde cuando la última ronda escrita está completa (todos sus partidos
 * `FINALIZADO`, cada uno con exactamente un ganador) y no era la final. El
 * ganador del partido 2k-1 enfrenta al del 2k, en el orden de `matchNumber`:
 * es lo que mantiene la siembra de `ordenDeSiembra`.
 */
export function siguienteRondaEliminacion(
  partidos: readonly PartidoDeLlave[],
): { cruces: Cruce[]; tipo: TipoDeCompetidor } | null {
  if (partidos.length === 0) return null;

  const ultima = Math.max(...partidos.map((p) => p.round));
  const ronda = partidos
    .filter((p) => p.round === ultima)
    .sort((a, b) => a.matchNumber - b.matchNumber);

  if (ronda.length < 2) return null; // era la final
  if (ronda.some((p) => p.status !== 'FINALIZADO')) return null;

  const ganadores: string[] = [];
  let tipo: TipoDeCompetidor = 'participant';
  for (const partido of ronda) {
    const ganan = partido.results.filter((r) => r.isWinner === true);
    if (ganan.length !== 1) return null;
    const id = ganan[0].teamId ?? ganan[0].participantId;
    if (!id) return null;
    if (ganan[0].teamId) tipo = 'team';
    ganadores.push(id);
  }

  const cruces: Cruce[] = [];
  for (let i = 0; i + 1 < ganadores.length; i += 2) {
    cruces.push({
      round: ultima + 1,
      matchNumber: i / 2 + 1,
      homeId: ganadores[i],
      awayId: ganadores[i + 1],
    });
  }
  return { cruces, tipo };
}

/**
 * Si la última ronda de la llave quedó completa, escribe la siguiente.
 *
 * La llama `ResultsService` dentro de la misma transacción que finaliza el
 * partido, con la fila de la competencia ya bloqueada (`FOR UPDATE`): sin ese
 * bloqueo, dos árbitros que cierran los dos últimos partidos de una ronda al
 * mismo tiempo no se verían entre sí y la llave quedaría trabada, o la ronda
 * siguiente se escribiría dos veces.
 */
export async function avanzarLlave(
  db: ClienteFixture,
  competitionId: string,
): Promise<Match[]> {
  const partidos = await db.match.findMany({
    where: { competitionId },
    select: {
      round: true,
      matchNumber: true,
      status: true,
      results: {
        select: { teamId: true, participantId: true, isWinner: true },
      },
    },
  });

  const siguiente = siguienteRondaEliminacion(partidos);
  if (!siguiente) return [];
  return escribirCruces(db, competitionId, siguiente.cruces, siguiente.tipo);
}
