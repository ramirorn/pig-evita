// ===========================================
// ResultsService — eliminación directa (F-14)
// ===========================================
//
// Cerrar el último partido de una ronda arma la siguiente dentro de la misma
// transacción, con la competencia bloqueada; un empate no puede cerrar un
// cruce de llave y, una vez que la llave avanzó, no se cambia quién pasó.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { PrismaService } from '../../database/prisma.service';

interface Fila {
  id: string;
  matchId: string;
  teamId: string | null;
  participantId: string | null;
  isWinner: boolean | null;
  scoreData: unknown;
  ranking: number | null;
}
interface Partido {
  id: string;
  competitionId: string;
  round: number;
  matchNumber: number;
  status: string;
  finishedAt: Date | null;
}

const COMP = 'comp-1';
const ARBITRO = { sub: 'u1', role: 'ARBITRO' };
const ADMIN = { sub: 'u2', role: 'ADMIN_PROVINCIAL' };

function armar() {
  const partidos = new Map<string, Partido>();
  const filas = new Map<string, Fila>();
  let n = 0;

  const agregar = (
    round: number,
    matchNumber: number,
    jugadores: string[],
    ganador: string | null = null,
  ) => {
    const id = `m${++n}`;
    partidos.set(id, {
      id,
      competitionId: COMP,
      round,
      matchNumber,
      status: ganador ? 'FINALIZADO' : 'PROGRAMADO',
      finishedAt: ganador ? new Date() : null,
    });
    jugadores.forEach((p, i) =>
      filas.set(`${id}-r${i}`, {
        id: `${id}-r${i}`,
        matchId: id,
        teamId: null,
        participantId: p,
        isWinner: ganador ? p === ganador : null,
        scoreData: {},
        ranking: null,
      }),
    );
    return id;
  };

  const conResultados = (p: Partido) => ({
    ...p,
    results: [...filas.values()].filter((f) => f.matchId === p.id),
  });

  const prisma: Record<string, unknown> = {
    $queryRaw: jest.fn(() => Promise.resolve([])),
    match: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) => {
        const p = partidos.get(where.id);
        return Promise.resolve(
          p
            ? {
                ...conResultados(p),
                competition: { id: COMP, format: 'ELIMINACION_DIRECTA' },
              }
            : null,
        );
      }),
      findMany: jest.fn(() =>
        Promise.resolve([...partidos.values()].map(conResultados)),
      ),
      count: jest.fn(({ where }: { where: { round: { gt: number } } }) =>
        Promise.resolve(
          [...partidos.values()].filter((p) => p.round > where.round.gt).length,
        ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Partido>;
        }) => {
          Object.assign(partidos.get(where.id)!, data);
          return Promise.resolve(partidos.get(where.id));
        },
      ),
      create: jest.fn(
        ({ data }: { data: Omit<Partido, 'id' | 'finishedAt'> }) => {
          const id = `m${++n}`;
          const p = { id, finishedAt: null, ...data };
          partidos.set(id, p);
          return Promise.resolve(p);
        },
      ),
    },
    result: {
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Partial<Fila> }) => {
          Object.assign(filas.get(where.id)!, data);
          return Promise.resolve(filas.get(where.id));
        },
      ),
      createMany: jest.fn(({ data }: { data: Fila[] }) => {
        data.forEach((f, i) =>
          filas.set(`${f.matchId}-r${i}`, {
            ...f,
            id: `${f.matchId}-r${i}`,
            teamId: f.teamId ?? null,
            isWinner: f.isWinner ?? null,
            ranking: null,
          }),
        );
        return Promise.resolve({ count: data.length });
      }),
    },
  };
  prisma.$transaction = jest.fn(
    (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(prisma),
  );

  const service = new ResultsService(prisma as unknown as PrismaService);
  return { service, partidos, filas, agregar, prisma };
}

const gana = (matchId: string, ganador: number) => [
  { resultId: `${matchId}-r0`, data: { isWinner: ganador === 0 } },
  { resultId: `${matchId}-r1`, data: { isWinner: ganador === 1 } },
];

describe('ResultsService — eliminación directa', () => {
  it('cerrar el último partido de la ronda arma la siguiente con los ganadores', async () => {
    const { service, partidos, filas, agregar, prisma } = armar();
    const m1 = agregar(1, 1, ['p1', 'p4']);
    agregar(1, 2, ['p2', 'p3'], 'p2');

    await service.updateMatchResults(m1, gana(m1, 0), ARBITRO);

    expect(prisma.$queryRaw).toHaveBeenCalled(); // bloqueo de la competencia
    const final = [...partidos.values()].filter((p) => p.round === 2);
    expect(final).toHaveLength(1);
    expect(final[0].status).toBe('PROGRAMADO');
    const finalistas = [...filas.values()]
      .filter((f) => f.matchId === final[0].id)
      .map((f) => f.participantId);
    expect(finalistas).toEqual(['p1', 'p2']);
  });

  it('con la ronda incompleta no arma nada', async () => {
    const { service, partidos, agregar } = armar();
    const m1 = agregar(1, 1, ['p1', 'p4']);
    agregar(1, 2, ['p2', 'p3']);
    await service.updateMatchResults(m1, gana(m1, 0), ARBITRO);
    expect([...partidos.values()].some((p) => p.round === 2)).toBe(false);
  });

  it('un empate no cierra un cruce de llave (400) y el partido no se finaliza', async () => {
    const { service, partidos, agregar } = armar();
    const m1 = agregar(1, 1, ['p1', 'p4']);
    await expect(
      service.updateMatchResults(
        m1,
        [
          { resultId: `${m1}-r0`, data: { isWinner: false } },
          { resultId: `${m1}-r1`, data: { isWinner: false } },
        ],
        ARBITRO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(partidos.get(m1)!.status).toBe('PROGRAMADO');
  });

  it('un pase directo no admite carga de resultado', async () => {
    const { service, agregar } = armar();
    const bye = agregar(1, 1, ['p1'], 'p1');
    await expect(
      service.updateMatchResults(
        bye,
        [{ resultId: `${bye}-r0`, data: { isWinner: true } }],
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una vez que la llave avanzó no se cambia el ganador (409), aunque corrija un admin', async () => {
    const { service, agregar } = armar();
    const m1 = agregar(1, 1, ['p1', 'p4']);
    agregar(1, 2, ['p2', 'p3'], 'p2');
    await service.updateMatchResults(m1, gana(m1, 0), ARBITRO);

    await expect(
      service.updateMatchResults(m1, gana(m1, 1), ARBITRO),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // corregir sin cambiar el ganador sí se puede
    await expect(
      service.updateMatchResults(m1, gana(m1, 0), ADMIN),
    ).resolves.toBeDefined();
    // (va último: el doble de Prisma no deshace la transacción que falla)
    await expect(
      service.updateMatchResults(m1, gana(m1, 1), ADMIN),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
