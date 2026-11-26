import { ALCANCE_PROVINCIAL, ScopeService } from '../../../common/scope';
import type { PrismaService } from '../../../database/prisma.service';
import { inscriptionsReport } from './inscriptions.report';
import { participantsReport } from './participants.report';
import { ReportContext } from './report-context';
import { resultsReport } from './results.report';

async function firstBatch(
  lotes: () => AsyncGenerator<unknown[][]>,
): Promise<unknown[][]> {
  const { value } = await lotes().next();
  return value ?? [];
}

function contextWith(prisma: Record<string, unknown>): ReportContext {
  return {
    prisma: prisma as unknown as PrismaService,
    scope: new ScopeService(prisma as unknown as PrismaService),
  };
}

describe('definiciones de reportes', () => {
  it('resultados: pide los resultados con el local primero y lo escribe en la columna Local', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'm1',
        round: 1,
        matchNumber: 1,
        status: 'FINALIZADO',
        competition: {
          name: 'Liga',
          stage: 'PROVINCIAL',
          discipline: { name: 'Fútbol' },
          category: { name: 'Sub-14' },
        },
        venue: null,
        results: [
          {
            scoreData: { goals: 3 },
            isWinner: true,
            team: { name: 'San Martín' },
            participant: null,
          },
          {
            scoreData: { goals: 1 },
            isWinner: false,
            team: { name: 'Belgrano' },
            participant: null,
          },
        ],
      },
    ]);
    const espec = resultsReport(
      contextWith({ match: { findMany } }),
      ALCANCE_PROVINCIAL,
    );

    const [fila] = await firstBatch(espec.lotes);

    const args = findMany.mock.calls[0][0] as {
      select: { results: { orderBy: unknown } };
    };
    // Sin este orden Postgres no garantiza cuál fila viene primero.
    expect(args.select.results.orderBy).toEqual([
      { isHome: 'desc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(fila.slice(7, 12)).toEqual([
      'San Martín',
      '3',
      'Belgrano',
      '1',
      'San Martín',
    ]);
  });

  it('participantes e inscripciones: la proyección no trae el domicilio', () => {
    const participant = { findMany: jest.fn().mockResolvedValue([]) };
    const inscription = { findMany: jest.fn().mockResolvedValue([]) };
    const ctx = contextWith({ participant, inscription });

    void participantsReport(ctx, ALCANCE_PROVINCIAL).lotes().next();
    void inscriptionsReport(ctx, ALCANCE_PROVINCIAL).lotes().next();

    const participantArgs = participant.findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    const inscriptionArgs = inscription.findMany.mock.calls[0][0] as {
      select: { participant: { select: Record<string, unknown> } };
    };
    expect(participantArgs.select).not.toHaveProperty('address');
    expect(participantArgs.select).toHaveProperty('id', true);
    expect(inscriptionArgs.select.participant.select).not.toHaveProperty(
      'address',
    );
  });
});
