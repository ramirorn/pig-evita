// ===========================================
// E2E — PII en endpoints públicos (R01)
//
// Dos capas:
//   1. el caso puntual: `GET /competitions/:id` sin token;
//   2. el barrido: TODOS los handlers `@Public()` de lectura, descubiertos por
//      reflexión sobre los controllers reales, no por una lista a mano.
//
// El mock de Prisma respeta `select`/`include` (ver `mocks/prisma-projection`).
// Eso es lo que le da poder al test: las filas de fixture están "gordas" —traen
// DNI, fecha de nacimiento, email, teléfono y domicilio—, así que un service que
// baje con `include: { participant: true }` los devuelve y el test falla. Con un
// mock ingenuo los dos casos se verían iguales.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import request from 'supertest';
import { App } from 'supertest/types';
import { IS_PUBLIC_KEY } from '../src/common/constants';
import { PrismaService } from '../src/database/prisma.service';
import { proyectar } from './mocks/prisma-projection';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';

import { CompetitionsController } from '../src/modules/competitions/competitions.controller';
import { CompetitionsService } from '../src/modules/competitions/competitions.service';
import { EngineFactory } from '../src/modules/competitions/engine.factory';
import { CategoriesController } from '../src/modules/categories/categories.controller';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { VenuesController } from '../src/modules/venues/venues.controller';
import { VenuesService } from '../src/modules/venues/venues.service';
import { NewsController } from '../src/modules/news/news.controller';
import { NewsService } from '../src/modules/news/news.service';
import { CalendarController } from '../src/modules/calendar/calendar.controller';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { ResultsController } from '../src/modules/results/results.controller';
import { ResultsService } from '../src/modules/results/results.service';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';

const UUID = '11111111-1111-4111-8111-111111111111';

/** Los cinco campos del DoD, más los valores plantados en el fixture. */
const CAMPOS_PROHIBIDOS = [
  'dni',
  'birthDate',
  'email',
  'phone',
  'address',
] as const;

const VALORES_PII = [
  '40123456', // dni
  '2012-04-18', // birthDate (menor de edad)
  'tutor.perez@gmail.com', // email
  '3704111222', // phone
  'Av. Siempre Viva 742', // address del participante
  'Nota interna del back-office', // notes del partido
];

// -------------------------------------------------
// Fixtures "gordos": la fila tal cual está en la base
// -------------------------------------------------
const PARTICIPANTE = {
  id: '22222222-2222-4222-8222-222222222222',
  dni: '40123456',
  firstName: 'Lucas',
  lastName: 'Pérez',
  birthDate: new Date('2012-04-18T00:00:00.000Z'),
  sex: 'M',
  phone: '3704111222',
  email: 'tutor.perez@gmail.com',
  locality: 'Clorinda',
  department: 'Pilcomayo',
  address: 'Av. Siempre Viva 742',
  createdAt: new Date('2026-01-02T10:00:00.000Z'),
  updatedAt: new Date('2026-01-02T10:00:00.000Z'),
};

const DISCIPLINA = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Fútbol',
  type: 'EQUIPO',
  resultType: 'GOLES',
  rules: '<p>Reglamento</p>',
  minPlayers: 7,
  maxPlayers: 11,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
};

const CATEGORIA = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Sub-14',
  disciplineId: DISCIPLINA.id,
  sex: 'M',
  minAge: 12,
  maxAge: 14,
  isActive: true,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  discipline: DISCIPLINA,
  _count: { inscriptions: 3 },
};

const EQUIPO = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Los Pumas',
  disciplineId: DISCIPLINA.id,
  categoryId: CATEGORIA.id,
  locality: 'Clorinda',
  department: 'Pilcomayo',
  isActive: true,
  createdAt: new Date('2026-01-03T10:00:00.000Z'),
  updatedAt: new Date('2026-01-03T10:00:00.000Z'),
};

const SEDE = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Polideportivo Municipal',
  // La dirección de una sede deportiva es información pública (mapas): por eso
  // el barrido la permite en `/venues`, y sólo ahí. Ver ENDPOINTS_CON_DOMICILIO.
  address: 'Ruta 11 km 1210',
  department: 'Formosa',
  locality: 'Formosa',
  latitude: -26.1,
  longitude: -58.2,
  capacity: 500,
  isActive: true,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
  _count: { matches: 2 },
};

const RESULTADO = {
  id: '77777777-7777-4777-8777-777777777777',
  matchId: '88888888-8888-4888-8888-888888888888',
  participantId: PARTICIPANTE.id,
  teamId: EQUIPO.id,
  scoreData: { goals: 3 },
  ranking: 1,
  isWinner: true,
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
  participant: PARTICIPANTE,
  team: EQUIPO,
};

const PARTIDO = {
  id: '88888888-8888-4888-8888-888888888888',
  competitionId: UUID,
  venueId: SEDE.id,
  round: 1,
  matchNumber: 1,
  status: 'FINALIZADO',
  scheduledAt: new Date('2026-03-01T14:00:00.000Z'),
  startedAt: new Date('2026-03-01T14:05:00.000Z'),
  finishedAt: new Date('2026-03-01T15:45:00.000Z'),
  notes: 'Nota interna del back-office',
  createdAt: new Date('2026-02-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T16:00:00.000Z'),
  venue: SEDE,
  results: [RESULTADO],
};

const COMPETENCIA = {
  id: UUID,
  disciplineId: DISCIPLINA.id,
  categoryId: CATEGORIA.id,
  stage: 'REGIONAL',
  format: 'ELIMINACION_SIMPLE',
  status: 'ACTIVA',
  name: 'Regional Fútbol Sub-14',
  startDate: new Date('2026-03-01T00:00:00.000Z'),
  endDate: new Date('2026-03-10T00:00:00.000Z'),
  config: null,
  createdAt: new Date('2026-02-01T10:00:00.000Z'),
  updatedAt: new Date('2026-02-01T10:00:00.000Z'),
  discipline: DISCIPLINA,
  category: CATEGORIA,
  matches: [PARTIDO],
  _count: { matches: 1 },
};

const NOTICIA = {
  id: '99999999-9999-4999-8999-999999999999',
  title: 'Arrancan los juegos',
  slug: 'arrancan-los-juegos',
  content: '<p>Contenido</p>',
  excerpt: 'Resumen',
  imageKey: null,
  isPublished: true,
  publishedAt: new Date('2026-02-20T10:00:00.000Z'),
  authorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  createdAt: new Date('2026-02-20T10:00:00.000Z'),
  updatedAt: new Date('2026-02-20T10:00:00.000Z'),
};

const EVENTO = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Acto de apertura',
  description: 'En el estadio',
  startDate: new Date('2026-03-01T10:00:00.000Z'),
  endDate: null,
  stage: 'REGIONAL',
  venueId: SEDE.id,
  disciplineId: DISCIPLINA.id,
  isPublished: true,
  createdAt: new Date('2026-02-01T10:00:00.000Z'),
  updatedAt: new Date('2026-02-01T10:00:00.000Z'),
};

const INSCRIPCION = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  qrCode: 'EVITA-A1B2C3D4',
  status: 'APROBADA',
  createdAt: new Date('2026-02-10T10:00:00.000Z'),
  updatedAt: new Date('2026-02-10T10:00:00.000Z'),
  notes: 'Nota interna del back-office',
  participant: PARTICIPANTE,
  category: CATEGORIA,
};

const FIXTURES: Record<string, Record<string, any>> = {
  competition: COMPETENCIA,
  match: PARTIDO,
  result: RESULTADO,
  category: CATEGORIA,
  discipline: { ...DISCIPLINA, categories: [CATEGORIA] },
  venue: SEDE,
  news: NOTICIA,
  calendarEvent: EVENTO,
  inscription: INSCRIPCION,
  team: EQUIPO,
  participant: PARTICIPANTE,
};

/** PrismaService de mentira que aplica la proyección pedida a la fila gorda. */
function crearPrismaMock() {
  const modelo = (nombre: string) => ({
    findUnique: jest.fn((args: any) =>
      Promise.resolve(proyectar(FIXTURES[nombre] ?? null, args, nombre)),
    ),
    findFirst: jest.fn((args: any) =>
      Promise.resolve(proyectar(FIXTURES[nombre] ?? null, args, nombre)),
    ),
    findMany: jest.fn((args: any) =>
      Promise.resolve([proyectar(FIXTURES[nombre] ?? null, args, nombre)]),
    ),
    count: jest.fn(() => Promise.resolve(1)),
  });

  const prisma: Record<string, any> = {};
  for (const nombre of Object.keys(FIXTURES)) prisma[nombre] = modelo(nombre);
  return prisma;
}

/**
 * Rutas donde `address` está permitido: la dirección de una **sede** es dato
 * público y el endpoint existe justamente para mapas. Ninguna otra ruta pública
 * puede devolver un domicilio, y el chequeo por valor (el domicilio del
 * participante) sigue aplicando en todas.
 */
const ENDPOINTS_CON_DOMICILIO = [/^\/venues/];

describe('Endpoints públicos — fuga de PII (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: Record<string, any>;

  const CONTROLLERS = [
    CompetitionsController,
    CategoriesController,
    DisciplinesController,
    VenuesController,
    NewsController,
    CalendarController,
    ResultsController,
    InscriptionsController,
  ];

  beforeAll(async () => {
    prisma = crearPrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      // News y Calendar montan `OptionalJwtAuthGuard` (R06), que corre la
      // estrategia `jwt` de passport. Sin registrarla, esos handlers responden
      // 500 y el barrido no llegaría a mirar el payload: hay que registrarla
      // para que el request anónimo se resuelva como anónimo y no como error.
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: CONTROLLERS,
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (clave: string) =>
              clave === 'jwt.accessSecret' ? 'secreto-de-prueba' : undefined,
          },
        },
        CompetitionsService,
        CategoriesService,
        DisciplinesService,
        VenuesService,
        NewsService,
        CalendarService,
        ResultsService,
        InscriptionsService,
        { provide: EngineFactory, useValue: { getEngine: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
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

  afterAll(async () => {
    await app?.close();
  });

  // -------------------------------------------------
  // 1. El caso del DoD: GET /competitions/:id sin token
  // -------------------------------------------------
  describe('GET /competitions/:id sin token', () => {
    it('no devuelve dni, birthDate, email, phone ni address en ningún nivel', async () => {
      const res = await request(app.getHttpServer())
        .get(`/competitions/${UUID}`)
        .expect(200);

      const serializado = JSON.stringify(res.body);

      // Assertion sobre el string completo, no sobre campos sueltos: si mañana
      // el dato aparece tres niveles más abajo, este test lo ve igual.
      for (const campo of CAMPOS_PROHIBIDOS) {
        expect(serializado).not.toContain(`"${campo}"`);
      }
      for (const valor of VALORES_PII) {
        expect(serializado).not.toContain(valor);
      }
    });

    it('sigue devolviendo el fixture útil: nombre del competidor, marcador y sede', async () => {
      const res = await request(app.getHttpServer())
        .get(`/competitions/${UUID}`)
        .expect(200);

      const partido = res.body.matches[0];
      expect(partido.matchNumber).toBe(1);
      expect(partido.venue.name).toBe('Polideportivo Municipal');
      expect(partido.results[0]).toMatchObject({
        isWinner: true,
        scoreData: { goals: 3 },
        team: { name: 'Los Pumas' },
        participant: { firstName: 'Lucas', lastName: 'Pérez' },
      });
      // El marcador necesita el resultType de la disciplina.
      expect(res.body.discipline.resultType).toBe('GOLES');
    });

    it('le pide a Prisma un select, no un include: el filtrado ocurre en la query', async () => {
      await request(app.getHttpServer())
        .get(`/competitions/${UUID}`)
        .expect(200);

      const args = prisma.competition.findUnique.mock.calls.at(-1)[0];
      expect(args.include).toBeUndefined();
      expect(args.select).toBeDefined();
      expect(args.select.matches.select.results.select.participant).toEqual({
        select: { id: true, firstName: true, lastName: true },
      });
    });
  });

  // -------------------------------------------------
  // 2. Barrido de TODOS los handlers @Public() de lectura
  // -------------------------------------------------
  describe('Barrido de handlers @Public()', () => {
    /** Descubre por reflexión las rutas GET marcadas @Public(). */
    const rutasPublicas = (): { nombre: string; url: string }[] => {
      const rutas: { nombre: string; url: string }[] = [];

      for (const controller of CONTROLLERS) {
        const prefijo = Reflect.getMetadata(
          PATH_METADATA,
          controller,
        ) as string;
        const proto = controller.prototype as Record<string, any>;

        for (const nombre of Object.getOwnPropertyNames(proto)) {
          if (nombre === 'constructor') continue;
          const handler = proto[nombre];
          // RequestMethod.GET === 0
          if (Reflect.getMetadata(METHOD_METADATA, handler) !== 0) continue;
          if (!Reflect.getMetadata(IS_PUBLIC_KEY, handler)) continue;

          const patron = (Reflect.getMetadata(PATH_METADATA, handler) ||
            '') as string;
          const url = `/${prefijo}/${patron}`
            .replace(/\/+/g, '/')
            .replace(/\/$/, '')
            .replace(':qrCode', INSCRIPCION.qrCode)
            .replace(':slug', NOTICIA.slug)
            .replace(/:[A-Za-z]+/g, UUID);

          rutas.push({ nombre: `${controller.name}.${nombre}`, url });
        }
      }

      return rutas;
    };

    it('encuentra las rutas públicas por reflexión (red de seguridad del propio barrido)', () => {
      const urls = rutasPublicas().map((r) => r.url);
      // Si alguien borra un @Public() o agrega uno, el número cambia y hay que
      // mirarlo: el barrido no puede quedar recorriendo una lista vacía.
      expect(urls.length).toBeGreaterThanOrEqual(11);
      expect(urls).toContain(`/competitions/${UUID}`);
      expect(urls).toContain(`/news/slug/${NOTICIA.slug}`);
      expect(urls).toContain(
        `/inscriptions/qr/${INSCRIPCION.qrCode}`.replace(/\/+/g, '/'),
      );
    });

    it('ninguna ruta pública devuelve dni, birthDate, email, phone ni address', async () => {
      const fallas: string[] = [];

      for (const { nombre, url } of rutasPublicas()) {
        const res = await request(app.getHttpServer()).get(url);

        if (res.status !== 200) {
          fallas.push(`${nombre} (${url}) respondió ${res.status}`);
          continue;
        }

        const serializado = JSON.stringify(res.body);
        const permiteDomicilio = ENDPOINTS_CON_DOMICILIO.some((re) =>
          re.test(url),
        );

        for (const campo of CAMPOS_PROHIBIDOS) {
          if (campo === 'address' && permiteDomicilio) continue;
          if (serializado.includes(`"${campo}"`)) {
            fallas.push(`${nombre} (${url}) devuelve el campo "${campo}"`);
          }
        }

        for (const valor of VALORES_PII) {
          if (serializado.includes(valor)) {
            fallas.push(`${nombre} (${url}) devuelve el valor "${valor}"`);
          }
        }
      }

      expect(fallas).toEqual([]);
    });
  });
});
