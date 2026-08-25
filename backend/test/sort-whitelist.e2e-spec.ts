// ===========================================
// E2E — `sortBy` con whitelist y 5xx sin stack (R11)
// ===========================================
//
// `orderBy: { [filterDto.sortBy || 'createdAt']: ... }` metía el string del
// cliente adentro de la consulta. Con una columna inexistente Prisma tira un
// `PrismaClientValidationError` cuyo `message` es la invocación completa: la
// ruta absoluta del archivo en el servidor, el número de línea, el fragmento de
// código y —de regalo— los nombres reales de todas las columnas de la tabla.
// Eso salía como 500 en el JSON de la respuesta.
//
// Dos defensas, las dos testeadas acá:
//   1. la whitelist por DTO (`@SortableBy`), que convierte el caso en un 400
//      antes de tocar la base;
//   2. el corte del filtro global de excepciones, que en producción no deja
//      salir el detalle de ningún 5xx, venga de donde venga.
//
// El doble de Prisma **no** es complaciente: reproduce el fallo de Prisma ante
// una columna desconocida. Si la whitelist no estuviera, el request llegaría
// hasta ahí y el test vería el 500.
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  InternalServerErrorException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';

import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { VenuesController } from '../src/modules/venues/venues.controller';
import { VenuesService } from '../src/modules/venues/venues.service';
import { PrismaService } from '../src/database/prisma.service';
import { GlobalExceptionFilter } from '../src/common/filters';
import { buildOrderBy } from '../src/common/dto';
import { CAMPOS_ORDEN_DISCIPLINE } from '../src/modules/disciplines/dto';

const DISCIPLINAS = [
  {
    id: 'd1',
    name: 'Ajedrez',
    isActive: true,
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'd2',
    name: 'Básquet',
    isActive: true,
    createdAt: new Date('2026-02-01'),
  },
];

/** Columnas que "existen" en la tabla del doble. */
const COLUMNAS_REALES = new Set([
  'id',
  'name',
  'isActive',
  'createdAt',
  'updatedAt',
  'sortOrder',
  'type',
]);

/**
 * Texto calcado del error real de Prisma 7 ante una columna inexistente en
 * `orderBy`. Incluye ruta absoluta, línea y fragmento de código: es exactamente
 * lo que no puede terminar en una respuesta HTTP.
 */
function errorDePrismaPorColumna(campo: string): Error {
  const error = new Error(
    `\nInvalid \`prisma.discipline.findMany()\` invocation in\n` +
      `C:\\app\\backend\\src\\modules\\disciplines\\disciplines.service.ts:65:41\n\n` +
      `  63 const [disciplines, total] = await Promise.all([\n` +
      `  64   this.prisma.discipline.findMany({\n` +
      `→ 65     orderBy: { ${campo}: 'asc' }\n` +
      `Unknown argument \`${campo}\`. Available options are marked with ?.`,
  );
  error.name = 'PrismaClientValidationError';
  return error;
}

function tablaFalsa(filas: Array<Record<string, unknown>>) {
  return {
    findMany: jest.fn(({ orderBy }: { orderBy?: Record<string, string> }) => {
      const campo = orderBy ? Object.keys(orderBy)[0] : 'createdAt';
      if (!COLUMNAS_REALES.has(campo)) {
        return Promise.reject(errorDePrismaPorColumna(campo));
      }
      return Promise.resolve(filas);
    }),
    count: jest.fn(() => Promise.resolve(filas.length)),
  };
}

describe('Orden por `sortBy` (R11)', () => {
  let app: INestApplication<App>;
  let prisma: {
    discipline: ReturnType<typeof tablaFalsa>;
    venue: ReturnType<typeof tablaFalsa>;
  };
  const nodeEnvOriginal = process.env.NODE_ENV;

  beforeEach(async () => {
    prisma = { discipline: tablaFalsa(DISCIPLINAS), venue: tablaFalsa([]) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DisciplinesController, VenuesController],
      providers: [
        DisciplinesService,
        VenuesService,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    process.env.NODE_ENV = nodeEnvOriginal;
    await app.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(path);

  // -------------------------------------------------
  // El DoD: 400 con mensaje genérico
  // -------------------------------------------------
  describe('columna fuera de la whitelist', () => {
    it('?sortBy=noExiste devuelve 400', async () => {
      const res = await get('/disciplines?sortBy=noExiste').expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toBe('Error de validación');
    });

    it('no llega a consultar la base', async () => {
      await get('/disciplines?sortBy=noExiste').expect(400);

      // La whitelist corta en el pipe: Prisma ni se entera. Es lo que evita el
      // costo de una query segura de fallar y, sobre todo, el 500 filtrado.
      expect(prisma.discipline.findMany).not.toHaveBeenCalled();
    });

    it.each([
      'passwordHash',
      'user.email',
      '../../etc/passwd',
      'name; DROP TABLE disciplines',
      '__proto__',
    ])('rechaza `%s` con 400', async (valor) => {
      await get(`/disciplines?sortBy=${encodeURIComponent(valor)}`).expect(400);
    });

    it('la respuesta del 400 no filtra rutas ni nombres de archivo', async () => {
      const res = await get('/disciplines?sortBy=noExiste').expect(400);
      const cuerpo = JSON.stringify(res.body);

      expect(cuerpo).not.toContain('.ts');
      expect(cuerpo).not.toContain('C:\\');
      expect(cuerpo).not.toContain('/app/');
      expect(cuerpo).not.toContain('prisma.');
    });

    it('el mismo agujero estaba en otros módulos: /venues también corta', async () => {
      await get('/venues?sortBy=noExiste').expect(400);
      expect(prisma.venue.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------
  // Lo que sí tiene que seguir funcionando
  // -------------------------------------------------
  describe('columnas permitidas', () => {
    it('?sortBy=name ordena por name', async () => {
      await get('/disciplines?sortBy=name&sortOrder=asc').expect(200);

      expect(prisma.discipline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('sin `sortBy` usa el default del DTO', async () => {
      await get('/disciplines').expect(200);

      const args = prisma.discipline.findMany.mock.calls[0][0] as {
        orderBy: Record<string, string>;
      };
      expect(Object.keys(args.orderBy)[0]).toBe('createdAt');
    });

    it('un `sortOrder` inventado también es 400', async () => {
      await get('/disciplines?sortBy=name&sortOrder=aleatorio').expect(400);
    });
  });

  // -------------------------------------------------
  // Defensa en profundidad: el helper del service
  // -------------------------------------------------
  describe('buildOrderBy', () => {
    it('un campo desconocido cae al default en vez de propagarse', () => {
      expect(
        buildOrderBy(CAMPOS_ORDEN_DISCIPLINE, 'name', 'passwordHash', 'asc'),
      ).toEqual({ name: 'asc' });
    });

    it('un campo permitido se respeta', () => {
      expect(
        buildOrderBy(CAMPOS_ORDEN_DISCIPLINE, 'name', 'sortOrder', 'desc'),
      ).toEqual({ sortOrder: 'desc' });
    });

    it('una dirección desconocida cae a `desc`', () => {
      expect(
        buildOrderBy(CAMPOS_ORDEN_DISCIPLINE, 'name', 'name', 'ASC; DROP'),
      ).toEqual({ name: 'desc' });
    });
  });

  // -------------------------------------------------
  // El segundo criterio del DoD: ningún 5xx filtra el stack
  // -------------------------------------------------
  describe('respuestas 5xx en producción', () => {
    /**
     * Se fuerza el error de Prisma **por dentro** del service, sin pasar por
     * `sortBy`: representa cualquier fallo inesperado de la capa de datos, que
     * es la familia entera que R11 pide cerrar.
     */
    function forzarErrorDePrisma() {
      prisma.discipline.findMany.mockRejectedValue(
        errorDePrismaPorColumna('columnaFantasma'),
      );
      prisma.discipline.count.mockRejectedValue(
        errorDePrismaPorColumna('columnaFantasma'),
      );
    }

    it('no devuelve rutas, stack ni nombres de archivo', async () => {
      process.env.NODE_ENV = 'production';
      forzarErrorDePrisma();

      const res = await get('/disciplines').expect(500);
      const cuerpo = JSON.stringify(res.body);

      expect(cuerpo).not.toContain('C:\\');
      expect(cuerpo).not.toContain('/app/');
      expect(cuerpo).not.toContain('.ts');
      expect(cuerpo).not.toContain('at ');
      expect(cuerpo).not.toContain('prisma.discipline');
      expect(res.body.message).toBe('Error interno del servidor');
    });

    it('tampoco cuando alguien envuelve el detalle en una HttpException', async () => {
      // El caso que el `catch (exception instanceof Error)` del filtro NO
      // cubría: una `InternalServerErrorException` construida con el mensaje
      // del error de la base adentro. Como es una `HttpException`, el filtro la
      // consideraba "mensaje ya elegido por el programador" y lo devolvía tal
      // cual, con la ruta del archivo incluida.
      process.env.NODE_ENV = 'production';
      const detalle = errorDePrismaPorColumna('columnaFantasma').message;
      prisma.discipline.findMany.mockRejectedValue(
        new InternalServerErrorException(detalle),
      );
      prisma.discipline.count.mockRejectedValue(
        new InternalServerErrorException(detalle),
      );

      const res = await get('/disciplines').expect(500);
      const cuerpo = JSON.stringify(res.body);

      expect(cuerpo).not.toContain('C:\\');
      expect(cuerpo).not.toContain('.ts');
      expect(res.body.message).toBe('Error interno del servidor');
    });

    it('tampoco cuando el detalle viaja en `errors`', async () => {
      process.env.NODE_ENV = 'production';
      forzarErrorDePrisma();

      const res = await get('/disciplines').expect(500);
      expect(res.body.errors).toBeUndefined();
    });
  });
});
