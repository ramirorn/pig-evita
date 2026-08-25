// ===========================================
// E2E — Filtros booleanos: `?isActive=false` (R10)
// ===========================================
//
// El `ValidationPipe` global corre con `enableImplicitConversion: true`. Esa
// conversión hace `Boolean(valor)` sobre el string de la query, y **todo string
// no vacío es truthy**: `'false'` llegaba al service como `true`.
//
// El síntoma es peor que un 500: `GET /venues?isActive=false` devolvía 200 con
// la lista de sedes **activas**. El filtro no fallaba, mentía. Cualquier
// pantalla de "dados de baja" mostraba exactamente lo contrario de lo que
// decía su título.
//
// El test tiene dos capas:
//
//   1. **DTO**: se instancian los DTOs de filtro con el mismo pipeline de
//      transformación que usa la app (misma `transformOptions`) y se verifica
//      la tabla completa: `'false'`, `'true'`, `'0'`, `'1'`, ausente.
//   2. **HTTP**: dos endpoints reales contra un Prisma que **filtra de verdad**
//      por `isActive`. Si el booleano se da vuelta, el listado devuelve las
//      filas del otro conjunto y el test lo ve.
//
// Un mock que devolviera siempre las mismas filas haría pasar por igual al
// código viejo y al nuevo, así que el doble aplica el `where` que arma el
// service.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';

import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { VenuesController } from '../src/modules/venues/venues.controller';
import { VenuesService } from '../src/modules/venues/venues.service';
import { PrismaService } from '../src/database/prisma.service';

import { DisciplineFilterDto } from '../src/modules/disciplines/dto';
import { VenueFilterDto } from '../src/modules/venues/dto';
import { CategoryFilterDto } from '../src/modules/categories/dto/categories.dto';
import { TeamFilterDto } from '../src/modules/teams/dto';
import { UserFilterDto } from '../src/modules/users/dto';
import { NewsFilterDto } from '../src/modules/news/dto';
import { CalendarFilterDto } from '../src/modules/calendar/dto/calendar.dto';

/** Las mismas opciones que `main.ts` le pasa al ValidationPipe global. */
const OPCIONES_TRANSFORM = { enableImplicitConversion: true };

// -------------------------------------------------
// Capa 1 — los DTOs
// -------------------------------------------------

/** Todos los DTOs de filtro que exponen un booleano por query string. */
const DTOS_CON_BOOLEANO: Array<{
  nombre: string;
  clase: new () => object;
  campo: string;
}> = [
  {
    nombre: 'DisciplineFilterDto',
    clase: DisciplineFilterDto,
    campo: 'isActive',
  },
  { nombre: 'VenueFilterDto', clase: VenueFilterDto, campo: 'isActive' },
  { nombre: 'CategoryFilterDto', clase: CategoryFilterDto, campo: 'isActive' },
  { nombre: 'TeamFilterDto', clase: TeamFilterDto, campo: 'isActive' },
  { nombre: 'UserFilterDto', clase: UserFilterDto, campo: 'isActive' },
  { nombre: 'NewsFilterDto', clase: NewsFilterDto, campo: 'isPublished' },
  {
    nombre: 'CalendarFilterDto',
    clase: CalendarFilterDto,
    campo: 'isPublished',
  },
];

function transformar(
  clase: new () => object,
  query: Record<string, unknown>,
): Record<string, unknown> {
  return plainToInstance(clase, query, OPCIONES_TRANSFORM) as Record<
    string,
    unknown
  >;
}

describe('Filtros booleanos de query (R10)', () => {
  describe.each(DTOS_CON_BOOLEANO)('$nombre.$campo', ({ clase, campo }) => {
    it.each([
      ['false', false],
      ['true', true],
      ['0', false],
      ['1', true],
      ['FALSE', false],
      ['True', true],
    ])('%s → %s', (entrada, esperado) => {
      const dto = transformar(clase, { [campo]: entrada });
      expect(dto[campo]).toBe(esperado);
    });

    it('ausente → undefined (el service no filtra por el campo)', () => {
      const dto = transformar(clase, {});
      expect(dto[campo]).toBeUndefined();
    });

    it('cadena vacía → undefined', () => {
      const dto = transformar(clase, { [campo]: '' });
      expect(dto[campo]).toBeUndefined();
    });

    it('un valor que no es booleano se rechaza (400), no se adivina', async () => {
      const dto = transformar(clase, { [campo]: 'quizas' });
      const errores = await validate(dto as object);

      expect(errores.map((e) => e.property)).toContain(campo);
    });

    it('un booleano real del body JSON pasa intacto', () => {
      expect(transformar(clase, { [campo]: false })[campo]).toBe(false);
      expect(transformar(clase, { [campo]: true })[campo]).toBe(true);
    });
  });
});

// -------------------------------------------------
// Capa 2 — dos endpoints de verdad
// -------------------------------------------------

const DISCIPLINAS = [
  { id: 'd1', name: 'Fútbol', type: 'EQUIPO', isActive: true },
  { id: 'd2', name: 'Natación', type: 'INDIVIDUAL', isActive: true },
  { id: 'd3', name: 'Ajedrez postal', type: 'INDIVIDUAL', isActive: false },
];

const SEDES = [
  { id: 'v1', name: 'Polideportivo', locality: 'Formosa', isActive: true },
  { id: 'v2', name: 'Club viejo', locality: 'Clorinda', isActive: false },
  { id: 'v3', name: 'Cancha cerrada', locality: 'Pirané', isActive: false },
];

/** Aplica el `where` que armó el service. Sólo lo que estos tests ejercitan. */
function coincide(
  fila: Record<string, unknown>,
  where: Record<string, unknown> = {},
): boolean {
  return Object.entries(where).every(([campo, valor]) => {
    if (valor === undefined) return true;
    if (typeof valor === 'object' && valor !== null) return true;
    return fila[campo] === valor;
  });
}

function tablaFalsa(filas: Array<Record<string, unknown>>) {
  return {
    findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(filas.filter((f) => coincide(f, where))),
    ),
    count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(filas.filter((f) => coincide(f, where)).length),
    ),
  };
}

describe('Filtros booleanos sobre endpoints reales (R10)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const prisma = {
      discipline: tablaFalsa(DISCIPLINAS),
      venue: tablaFalsa(SEDES),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DisciplinesController, VenuesController],
      providers: [
        DisciplinesService,
        VenuesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Exactamente el pipe de `main.ts`, `enableImplicitConversion` incluido:
    // sin esa opción el bug no se reproduce y el test no probaría nada.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: OPCIONES_TRANSFORM,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const ids = (body: { items: Array<{ id: string }> }) =>
    body.items.map((i) => i.id);

  it('GET /disciplines?isActive=false devuelve SÓLO las inactivas', async () => {
    const res = await request(app.getHttpServer())
      .get('/disciplines?isActive=false')
      .expect(200);

    expect(ids(res.body)).toEqual(['d3']);
  });

  it('GET /disciplines?isActive=true devuelve SÓLO las activas', async () => {
    const res = await request(app.getHttpServer())
      .get('/disciplines?isActive=true')
      .expect(200);

    expect(ids(res.body).sort()).toEqual(['d1', 'd2']);
  });

  it('GET /venues?isActive=false devuelve SÓLO las inactivas', async () => {
    const res = await request(app.getHttpServer())
      .get('/venues?isActive=false')
      .expect(200);

    expect(ids(res.body).sort()).toEqual(['v2', 'v3']);
  });

  it('sin el filtro vienen todas (el campo ausente no filtra nada)', async () => {
    const res = await request(app.getHttpServer()).get('/venues').expect(200);

    expect(ids(res.body)).toHaveLength(SEDES.length);
  });

  it('los dos conjuntos son disjuntos y suman el total', async () => {
    // La forma más directa de detectar la inversión: si `false` devolviera las
    // activas, este par de listas sería idéntico en vez de complementario.
    const activas = await request(app.getHttpServer())
      .get('/venues?isActive=true')
      .expect(200);
    const inactivas = await request(app.getHttpServer())
      .get('/venues?isActive=false')
      .expect(200);

    const a = ids(activas.body);
    const i = ids(inactivas.body);

    expect(a.some((id) => i.includes(id))).toBe(false);
    expect(a.length + i.length).toBe(SEDES.length);
    expect(a).toEqual(['v1']);
  });

  it('un booleano basura devuelve 400, no un listado al azar', async () => {
    await request(app.getHttpServer())
      .get('/venues?isActive=quizas')
      .expect(400);
  });
});
