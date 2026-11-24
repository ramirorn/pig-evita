// ===========================================
// Dobles de Prisma: escrituras en lote y presupuesto de consultas (Fase 0)
// ===========================================
//
// El refactor reemplaza bucles de `create` por `createMany`. Si el doble
// aceptara un lote con un DNI repetido, el test del service pasaría con un
// comportamiento que Postgres rechaza. Este spec fija que el doble se comporta
// como la base: el lote es atómico salvo con `skipDuplicates`.
import { Prisma } from '@prisma/client';
import { tabla } from './mocks/prisma-territorial';
import {
  contarConsultas,
  medirConsultas,
  reiniciarConteo,
} from './mocks/query-budget';

const participantes = () =>
  tabla('participant', [{ id: 'p1', dni: '40000001', department: 'Formosa' }]);

describe('Doble de Prisma — escrituras en lote', () => {
  it('createMany inserta todo el lote y devuelve el conteo', async () => {
    const t = participantes();
    const r = await t.createMany({
      data: [{ dni: '40000002' }, { dni: '40000003' }],
    });
    expect(r).toEqual({ count: 2 });
    expect(t._filas).toHaveLength(3);
  });

  it('un DNI que ya existe rechaza el lote entero con P2002', async () => {
    const t = participantes();
    await expect(
      t.createMany({ data: [{ dni: '40000002' }, { dni: '40000001' }] }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(t._filas).toHaveLength(1);
  });

  it('un DNI repetido dentro del mismo lote también lo rechaza', async () => {
    const t = participantes();
    const error = await t
      .createMany({ data: [{ dni: '40000009' }, { dni: '40000009' }] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(t._filas).toHaveLength(1);
  });

  it('skipDuplicates saltea sólo las filas que chocan', async () => {
    const t = participantes();
    const r = await t.createMany({
      data: [{ dni: '40000001' }, { dni: '40000002' }],
      skipDuplicates: true,
    });
    expect(r).toEqual({ count: 1 });
    expect(t._filas.map((f) => f.dni)).toEqual(['40000001', '40000002']);
  });

  it('createManyAndReturn devuelve las filas proyectadas', async () => {
    const t = participantes();
    const filas = await t.createManyAndReturn({
      data: [{ dni: '40000002', department: 'Pirané' }],
      select: { id: true, dni: true },
    });
    expect(filas).toEqual([{ id: expect.any(String), dni: '40000002' }]);
  });
});

describe('Presupuesto de consultas', () => {
  it('cuenta las operaciones de todos los modelos e ignora $transaction', async () => {
    const prisma = {
      participant: participantes(),
      team: tabla('team', []),
      $transaction: jest.fn(),
    };

    const consultas = await medirConsultas(prisma, async () => {
      await prisma.participant.findMany({});
      await prisma.participant.count({});
      await prisma.team.createMany({ data: [{ name: 'A' }] });
      prisma.$transaction();
    });

    expect(consultas).toBe(3);
    reiniciarConteo(prisma);
    expect(contarConsultas(prisma)).toBe(0);
  });
});
