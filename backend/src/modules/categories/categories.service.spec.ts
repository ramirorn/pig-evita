// ===========================================
// Criterio de edad de una categoría: por edad o por año de nacimiento
// ===========================================
//
// El pedido: un chico que "le da la edad" para la Sub-14 pero cumple 15 ese
// mismo año compite físicamente en desventaja con los de su categoría. La
// categoría por año de nacimiento lo resuelve; la de edad sigue disponible.
import { BadRequestException } from '@nestjs/common';
import { AgeCriterion, Sex } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { evaluarRango } from './category-range';
import type { PrismaService } from '../../database/prisma.service';

const DISCIPLINA = { id: 'd1', name: 'Fútbol' };

const POR_EDAD = {
  id: 'c1',
  disciplineId: 'd1',
  name: 'Sub-14',
  ageCriterion: AgeCriterion.AGE,
  minAge: 12,
  maxAge: 14,
  minBirthYear: null,
  maxBirthYear: null,
  sex: Sex.MIXTO,
  isActive: true,
};

function armar(existente = POR_EDAD) {
  const create = jest.fn((args: { data: unknown }) =>
    Promise.resolve({ ...(args.data as object), name: 'x' }),
  );
  const update = jest.fn((args: { data: unknown }) =>
    Promise.resolve({ ...existente, ...(args.data as object) }),
  );
  const prisma = {
    discipline: { findUnique: jest.fn(() => Promise.resolve(DISCIPLINA)) },
    category: {
      create,
      update,
      findUnique: jest.fn(() => Promise.resolve(existente)),
    },
  } as unknown as PrismaService;
  return { service: new CategoriesService(prisma), create, update };
}

const base = { disciplineId: 'd1', name: 'Sub-14', sex: Sex.MIXTO };

describe('evaluarRango', () => {
  const hoy = new Date(2026, 9, 25);

  it('por edad: usa la edad cumplida al día de hoy', () => {
    // Nació en dic/2011: hoy tiene 14 y entra en una 12–14.
    const r = evaluarRango(POR_EDAD, new Date('2011-12-01T00:00:00Z'), hoy);
    expect(r).toEqual({ ok: true, dato: 'tiene 14 años' });
  });

  it('por año: el que cumple la edad superior en el año queda afuera', () => {
    const porAnio = {
      ...POR_EDAD,
      ageCriterion: AgeCriterion.BIRTH_YEAR,
      minAge: null,
      maxAge: null,
      minBirthYear: 2012,
      maxBirthYear: 2014,
    };
    expect(
      evaluarRango(porAnio, new Date('2011-12-01T00:00:00Z'), hoy),
    ).toEqual({ ok: false, dato: 'nació en 2011' });
    // 1 de enero en UTC: leído en hora local podría caer en 2011.
    expect(
      evaluarRango(porAnio, new Date('2012-01-01T00:00:00Z'), hoy).ok,
    ).toBe(true);
  });

  it('sin criterio (dato previo a la migración) se trata como por edad', () => {
    const { ageCriterion: _, ...viejo } = POR_EDAD;
    expect(evaluarRango(viejo, new Date('2011-12-01T00:00:00Z'), hoy).ok).toBe(
      true,
    );
  });
});

describe('CategoriesService — criterio de edad', () => {
  it('crear sin criterio sigue siendo por edad y limpia los años', async () => {
    const { service, create } = armar();
    await service.create({ ...base, minAge: 12, maxAge: 14 });
    expect(create.mock.calls[0][0].data).toMatchObject({
      ageCriterion: AgeCriterion.AGE,
      minAge: 12,
      maxAge: 14,
      minBirthYear: null,
      maxBirthYear: null,
    });
  });

  it('crear por año de nacimiento guarda los años y anula las edades', async () => {
    const { service, create } = armar();
    await service.create({
      ...base,
      ageCriterion: AgeCriterion.BIRTH_YEAR,
      minAge: 12,
      maxAge: 14,
      minBirthYear: 2012,
      maxBirthYear: 2014,
    });
    expect(create.mock.calls[0][0].data).toMatchObject({
      ageCriterion: AgeCriterion.BIRTH_YEAR,
      minAge: null,
      maxAge: null,
      minBirthYear: 2012,
      maxBirthYear: 2014,
    });
  });

  it('rechaza el criterio elegido sin su par completo o invertido', async () => {
    const { service } = armar();
    await expect(
      service.create({
        ...base,
        ageCriterion: AgeCriterion.BIRTH_YEAR,
        minBirthYear: 2012,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        ...base,
        ageCriterion: AgeCriterion.BIRTH_YEAR,
        minBirthYear: 2014,
        maxBirthYear: 2012,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({ ...base, minAge: 15, maxAge: 12 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editar: una categoría existente por edad puede pasar a año de nacimiento', async () => {
    const { service, update } = armar();
    await service.update('c1', {
      ageCriterion: AgeCriterion.BIRTH_YEAR,
      minBirthYear: 2012,
      maxBirthYear: 2014,
    });
    expect(update.mock.calls[0][0].data).toMatchObject({
      ageCriterion: AgeCriterion.BIRTH_YEAR,
      minAge: null,
      maxAge: null,
      minBirthYear: 2012,
      maxBirthYear: 2014,
    });
  });

  it('editar: al cambiar de criterio no hereda el rango del anterior', async () => {
    const { service } = armar();
    // Pasa a año de nacimiento sin mandar años: las edades viejas no sirven.
    await expect(
      service.update('c1', { ageCriterion: AgeCriterion.BIRTH_YEAR }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editar sin tocar el criterio conserva el resto del rango', async () => {
    const { service, update } = armar();
    await service.update('c1', { maxAge: 15 });
    expect(update.mock.calls[0][0].data).toMatchObject({
      ageCriterion: AgeCriterion.AGE,
      minAge: 12,
      maxAge: 15,
    });
  });
});
