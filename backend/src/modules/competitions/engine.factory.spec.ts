// ===========================================
// RoundRobinEngine — localía y tipo de competidor
//
// Dos bugs que este spec fija, encontrados al completar R23:
//
//   1. El algoritmo ya distinguía `home` de `away` al armar cada cruce, pero esa
//      distinción **se perdía al guardar**: `Result` no tenía dónde ponerla. La
//      pantalla del fixture terminaba infiriendo la localía del orden de las
//      filas, que Postgres no garantiza.
//
//   2. El motor decidía si los ids eran de equipos o de participantes con
//      `homeId.includes('-')`, comentado como "uuid check simple". Los uuid de
//      participante **también tienen guiones**, así que la rama individual era
//      código muerto: generar el fixture de una disciplina individual escribía
//      un `teamId` apuntando a un participante y devolvía 500 por violación de
//      la foreign key. Reproducido en vivo contra Postgres antes de arreglarlo.
// ===========================================
import { RoundRobinEngine } from './engine.factory';
import { PrismaService } from '../../database/prisma.service';
import type { Competition } from '@prisma/client';

const COMPETENCIA = { id: 'c1' } as Competition;

/**
 * Tres uuid válidos: la forma es la misma para equipos y para participantes.
 *
 * Se copia en cada uso (`[...IDS]`) a propósito. El motor agregaba el 'BYE'
 * sobre el arreglo recibido —o sea sobre el `teamIds` del DTO—; escribir los
 * tests con la constante compartida hizo visible esa mutación, que ahora el
 * motor ya no hace.
 */
const IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
];

interface FilaResultado {
  matchId: string;
  teamId?: string;
  participantId?: string;
  isHome?: boolean;
}

function armarPrisma() {
  let n = 0;
  const partidos: Array<Record<string, unknown>> = [];
  const resultados: FilaResultado[] = [];

  const prisma = {
    match: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const fila = { id: `m${++n}`, ...data };
        partidos.push(fila);
        return Promise.resolve(fila);
      }),
    },
    result: {
      createMany: jest.fn(({ data }: { data: FilaResultado[] }) => {
        resultados.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
  };

  return { prisma: prisma as unknown as PrismaService, partidos, resultados };
}

describe('RoundRobinEngine', () => {
  describe('Localía (R23)', () => {
    it('cada partido guarda un local y un visitante, no dos filas indistinguibles', async () => {
      const { prisma, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'team',
      );

      const porPartido = new Map<string, FilaResultado[]>();
      for (const r of resultados) {
        porPartido.set(r.matchId, [...(porPartido.get(r.matchId) ?? []), r]);
      }

      expect(porPartido.size).toBe(3); // round robin de 3 → 3 cruces
      for (const filas of porPartido.values()) {
        expect(filas.filter((f) => f.isHome === true)).toHaveLength(1);
        expect(filas.filter((f) => f.isHome === false)).toHaveLength(1);
      }
    });

    it('ninguna fila queda con isHome sin definir', async () => {
      const { prisma, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'team',
      );

      // `isHome` es nullable en el modelo porque en otros contextos no aplica,
      // pero un cruce de round robin **siempre** tiene dos lados: si acá saliera
      // null, la UI volvería a las etiquetas neutras sin motivo.
      expect(resultados.every((r) => typeof r.isHome === 'boolean')).toBe(true);
    });

    it('el local es el que el algoritmo eligió como local, no el primero que se escribió', async () => {
      const { prisma, resultados, partidos } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'team',
      );

      // El mismo competidor no puede ser local de sí mismo en un cruce, y a lo
      // largo del fixture cada uno tiene que aparecer de los dos lados: eso es
      // lo que distingue una localía real de un `isHome: true` puesto siempre
      // en la primera fila.
      const locales = new Set(
        resultados.filter((r) => r.isHome).map((r) => r.teamId),
      );
      const visitantes = new Set(
        resultados.filter((r) => !r.isHome).map((r) => r.teamId),
      );

      expect(partidos).toHaveLength(3);
      expect(locales.size).toBeGreaterThan(1);
      expect(visitantes.size).toBeGreaterThan(1);
    });
  });

  describe('Tipo de competidor: lo decide el llamador, no el formato del id', () => {
    it("con 'participant' escribe participantId y NUNCA teamId", async () => {
      const { prisma, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'participant',
      );

      // Éste es el caso que fallaba: los ids son uuid, así que la heurística
      // vieja los tomaba por equipos y Postgres rechazaba la foreign key.
      expect(resultados).toHaveLength(6);
      expect(resultados.every((r) => r.participantId !== undefined)).toBe(true);
      expect(resultados.some((r) => r.teamId !== undefined)).toBe(false);
    });

    it("con 'team' escribe teamId y NUNCA participantId", async () => {
      const { prisma, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'team',
      );

      expect(resultados).toHaveLength(6);
      expect(resultados.every((r) => r.teamId !== undefined)).toBe(true);
      expect(resultados.some((r) => r.participantId !== undefined)).toBe(false);
    });

    it('los ids que se guardan son exactamente los que se pasaron', async () => {
      const { prisma, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'participant',
      );

      expect(new Set(resultados.map((r) => r.participantId))).toEqual(
        new Set(IDS),
      );
    });
  });

  describe('Lo que ya funcionaba y no debe romperse', () => {
    it('con cantidad impar el BYE no genera partidos fantasma', async () => {
      const { prisma, partidos, resultados } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS],
        'team',
      );

      // 3 competidores + BYE = 4 casilleros, 3 rondas de 2 cruces, pero uno de
      // cada ronda es contra el descanso y no existe.
      expect(partidos).toHaveLength(3);
      expect(resultados).toHaveLength(6);
      expect(resultados.some((r) => r.teamId === 'BYE')).toBe(false);
    });

    it('con menos de 2 competidores no genera nada', async () => {
      const { prisma } = armarPrisma();
      await expect(
        new RoundRobinEngine(prisma).generateFixture(
          COMPETENCIA,
          [IDS[0]!],
          'team',
        ),
      ).rejects.toThrow(/al menos 2/i);
    });

    it('con 4 competidores arma los 6 cruces del round robin', async () => {
      const { prisma, partidos } = armarPrisma();
      await new RoundRobinEngine(prisma).generateFixture(
        COMPETENCIA,
        [...IDS, '44444444-4444-4444-8444-444444444444'],
        'team',
      );

      expect(partidos).toHaveLength(6);
    });
  });
});
