// ===========================================
// E2E — Composición del plantel en Discipline (S21)
// ===========================================
//
// `titulares` / `maxSuplentes` son la planilla que hay que completar al
// inscribir un equipo. Sólo tienen sentido en `type = EQUIPO`, y esa regla no
// puede vivir en el DTO: en un `PATCH` el `type` puede no venir en el body y el
// tipo efectivo es el que ya está en la base. Este spec fija las dos mitades:
// que una disciplina INDIVIDUAL no los acepte por ninguna de las dos puertas, y
// que una EQUIPO sí.
import { Test, TestingModule } from '@nestjs/testing';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { PrismaService } from '../src/database/prisma.service';
import { DisciplineType, ResultType } from '@prisma/client';

const EQUIPO = {
  id: 'd-equipo',
  name: 'Fútbol 11',
  type: DisciplineType.EQUIPO,
  resultType: ResultType.GOLES,
};

const INDIVIDUAL = {
  id: 'd-individual',
  name: 'Ajedrez',
  type: DisciplineType.INDIVIDUAL,
  resultType: ResultType.PUNTOS,
};

function crearPrismaFalso(persistida: Record<string, unknown> = EQUIPO) {
  return {
    discipline: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findUnique: jest.fn(() => Promise.resolve(persistida)),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'nueva', ...data }),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...persistida, ...data }),
      ),
    },
  };
}

async function construir(prisma: ReturnType<typeof crearPrismaFalso>) {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    providers: [
      DisciplinesService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return moduleFixture.get(DisciplinesService);
}

describe('Plantel de la disciplina — titulares / maxSuplentes (S21)', () => {
  it('una disciplina EQUIPO los acepta en el alta', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    const creada = await service.create({
      ...EQUIPO,
      titulares: 11,
      maxSuplentes: 5,
    });

    expect(creada).toMatchObject({ titulares: 11, maxSuplentes: 5 });
  });

  it('una disciplina INDIVIDUAL los rechaza en el alta', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    await expect(
      service.create({ ...INDIVIDUAL, titulares: 11 }),
    ).rejects.toThrow(/sólo se pueden cargar en disciplinas de tipo EQUIPO/);

    expect(prisma.discipline.create).not.toHaveBeenCalled();
  });

  // El caso que el DTO solo no puede cortar: el `PATCH` no manda `type`.
  it('el PATCH sin `type` los rechaza si la disciplina persistida es INDIVIDUAL', async () => {
    const prisma = crearPrismaFalso(INDIVIDUAL);
    const service = await construir(prisma);

    await expect(
      service.update(INDIVIDUAL.id, { maxSuplentes: 3 }),
    ).rejects.toThrow(/sólo se pueden cargar en disciplinas de tipo EQUIPO/);

    expect(prisma.discipline.update).not.toHaveBeenCalled();
  });

  it('el PATCH sin `type` los acepta si la disciplina persistida es EQUIPO', async () => {
    const prisma = crearPrismaFalso(EQUIPO);
    const service = await construir(prisma);

    await expect(
      service.update(EQUIPO.id, { titulares: 11, maxSuplentes: 5 }),
    ).resolves.toMatchObject({ titulares: 11, maxSuplentes: 5 });
  });

  // Pasar una disciplina de EQUIPO a INDIVIDUAL tiene que poder limpiar el
  // plantel; `null` es un borrado explícito, no una carga.
  it('permite limpiar el plantel con null al pasar a INDIVIDUAL', async () => {
    const prisma = crearPrismaFalso(EQUIPO);
    const service = await construir(prisma);

    await expect(
      service.update(EQUIPO.id, {
        type: DisciplineType.INDIVIDUAL,
        titulares: null as unknown as undefined,
        maxSuplentes: null as unknown as undefined,
      }),
    ).resolves.toBeDefined();
  });
});
