// ===========================================
// E2E — Borradores de noticias y calendario (R06)
//
// `findAll` filtraba por `isPublished` cuando llegaba el filtro, pero `findOne`
// y `findBySlug` hacían `findUnique({ where: { id } })` / `{ slug }` sin
// filtrarlo. Conociendo el id —o el slug, que `generateSlug` deriva del título y
// por lo tanto es adivinable— cualquiera leía un borrador sin autenticarse.
//
// El arreglo no puede ser "hacer privado el endpoint": el mismo `GET /news/:id`
// tiene que servir la nota publicada al visitante anónimo y el borrador al
// editor. De ahí `OptionalJwtAuthGuard`, que puebla `request.user` si hay token
// válido y deja el request como anónimo si no, sin lanzar 401.
//
// El test cubre las tres puntas: que el anónimo no vea, que el editor sí vea, y
// —la que se olvida— que el anónimo no pueda *pedir* borradores por query.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import { NewsController } from '../src/modules/news/news.controller';
import { NewsService } from '../src/modules/news/news.service';
import { CalendarController } from '../src/modules/calendar/calendar.controller';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { PrismaService } from '../src/database/prisma.service';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';

const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const PUBLICADA = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'arrancan-los-juegos',
  title: 'Arrancan los Juegos Evita',
  content: 'Contenido publicado.',
  isPublished: true,
  publishedAt: new Date('2026-08-01T12:00:00.000Z'),
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-01T12:00:00.000Z'),
};

const BORRADOR = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'sede-a-confirmar',
  title: 'Sede a confirmar',
  content: 'Borrador con información todavía no anunciada.',
  isPublished: false,
  publishedAt: null,
  createdAt: new Date('2026-08-10T12:00:00.000Z'),
  updatedAt: new Date('2026-08-10T12:00:00.000Z'),
};

const EVENTO_PUBLICADO = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Final provincial',
  startDate: new Date('2026-09-01T14:00:00.000Z'),
  isPublished: true,
};

const EVENTO_BORRADOR = {
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Reunión interna de coordinadores',
  startDate: new Date('2026-09-05T14:00:00.000Z'),
  isPublished: false,
};

/** ¿La fila pasa el `where` que armó el service? Sólo miramos lo que importa. */
function coincide(
  fila: Record<string, unknown>,
  where: Record<string, unknown> = {},
): boolean {
  return Object.entries(where).every(([campo, valor]) => {
    if (valor === undefined) return true;
    // Los filtros compuestos (`OR`, rangos) no se ejercitan acá.
    if (typeof valor === 'object' && valor !== null) return true;
    return fila[campo] === valor;
  });
}

describe('Borradores de contenido editorial (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeEach(async () => {
    const noticias = [PUBLICADA, BORRADOR];
    const eventos = [EVENTO_PUBLICADO, EVENTO_BORRADOR];

    const prisma = {
      news: {
        findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(noticias.find((n) => coincide(n, where)) ?? null),
        ),
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(noticias.filter((n) => coincide(n, where))),
        ),
        count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(noticias.filter((n) => coincide(n, where)).length),
        ),
      },
      calendarEvent: {
        findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(eventos.find((e) => coincide(e, where)) ?? null),
        ),
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(eventos.filter((e) => coincide(e, where))),
        ),
        count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(eventos.filter((e) => coincide(e, where)).length),
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [NewsController, CalendarController],
      providers: [
        NewsService,
        CalendarService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
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
    jwt = moduleFixture.get(JwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** Access token válido para el rol pedido. */
  const tokenDe = (role: string) =>
    jwt.sign({
      sub: '99999999-9999-4999-8999-999999999999',
      email: 'editor@juegosevita.gob.ar',
      role,
      type: 'access',
    });

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const getComo = (path: string, role: string) =>
    get(path).set('Authorization', `Bearer ${tokenDe(role)}`);

  // -------------------------------------------------
  // El DoD: el anónimo no llega al borrador
  // -------------------------------------------------
  describe('Sin token', () => {
    it('GET /news/:id de un borrador devuelve 404', async () => {
      await get(`/news/${BORRADOR.id}`).expect(404);
    });

    it('GET /news/slug/:slug de un borrador devuelve 404', async () => {
      await get(`/news/slug/${BORRADOR.slug}`).expect(404);
    });

    it('GET /calendar/:id de un borrador devuelve 404', async () => {
      await get(`/calendar/${EVENTO_BORRADOR.id}`).expect(404);
    });

    it('404 y no 403: no se confirma que el borrador exista', async () => {
      const res = await get(`/news/${BORRADOR.id}`).expect(404);
      const inexistente = await get(
        '/news/55555555-5555-4555-8555-555555555555',
      ).expect(404);

      // Un 403 le diría al que prueba ids que ahí hay algo. Las dos respuestas
      // tienen que ser indistinguibles.
      expect(res.body.message).toBe(inexistente.body.message);
    });

    it('el contenido publicado sigue siendo público', async () => {
      const res = await get(`/news/${PUBLICADA.id}`).expect(200);
      expect(res.body.title).toBe(PUBLICADA.title);

      await get(`/news/slug/${PUBLICADA.slug}`).expect(200);
      await get(`/calendar/${EVENTO_PUBLICADO.id}`).expect(200);
    });
  });

  // -------------------------------------------------
  // Los listados: el filtro no se puede dar vuelta desde la query
  // -------------------------------------------------
  describe('Listados sin token', () => {
    it('GET /news no incluye borradores', async () => {
      const res = await get('/news').expect(200);
      const ids = res.body.items.map((n: { id: string }) => n.id);

      expect(ids).toContain(PUBLICADA.id);
      expect(ids).not.toContain(BORRADOR.id);
    });

    it('?isPublished=false NO devuelve los borradores', async () => {
      // El filtro del cliente se aplica primero y el recorte de visibilidad
      // después: si fuera al revés, pedir explícitamente los no publicados
      // sería la forma más cómoda de listarlos.
      const res = await get('/news?isPublished=false').expect(200);
      const ids = res.body.items.map((n: { id: string }) => n.id);

      expect(ids).not.toContain(BORRADOR.id);
    });

    it('GET /calendar tampoco incluye borradores', async () => {
      const res = await get('/calendar').expect(200);
      const ids = res.body.items.map((e: { id: string }) => e.id);

      expect(ids).toContain(EVENTO_PUBLICADO.id);
      expect(ids).not.toContain(EVENTO_BORRADOR.id);
    });
  });

  // -------------------------------------------------
  // El camino administrativo, que es la razón de que el guard sea opcional
  // -------------------------------------------------
  describe('Con token de un rol que administra contenido', () => {
    it.each([Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL])(
      '%s sí lee el borrador por id y por slug',
      async (role) => {
        const res = await getComo(`/news/${BORRADOR.id}`, role).expect(200);
        expect(res.body.title).toBe(BORRADOR.title);

        await getComo(`/news/slug/${BORRADOR.slug}`, role).expect(200);
        await getComo(`/calendar/${EVENTO_BORRADOR.id}`, role).expect(200);
      },
    );

    it('el listado le muestra publicadas y borradores', async () => {
      const res = await getComo('/news', Role.ADMIN_PROVINCIAL).expect(200);
      const ids = res.body.items.map((n: { id: string }) => n.id);

      expect(ids).toContain(PUBLICADA.id);
      expect(ids).toContain(BORRADOR.id);
    });
  });

  // -------------------------------------------------
  // Roles que NO administran contenido: token válido, pero no alcanza
  // -------------------------------------------------
  describe('Con token de un rol operativo', () => {
    it.each([Role.DELEGADO, Role.ARBITRO, Role.COORDINADOR])(
      '%s no ve el borrador: estar logueado no es ser editor',
      async (role) => {
        await getComo(`/news/${BORRADOR.id}`, role).expect(404);
        await getComo(`/calendar/${EVENTO_BORRADOR.id}`, role).expect(404);
      },
    );
  });

  // -------------------------------------------------
  // El guard opcional no debe convertirse en un guard obligatorio
  // -------------------------------------------------
  describe('Tolerancia del guard opcional', () => {
    it.each([
      ['token con basura', 'Bearer no-es-un-jwt'],
      ['token firmado con otro secreto', `Bearer ${'a.b.c'}`],
      ['header vacío', 'Bearer '],
    ])(
      'con %s el request sigue siendo público, no 401',
      async (_caso, header) => {
        // Si el guard lanzara ante un token inválido, un visitante con una
        // cookie vieja de otra app dejaría de poder leer las noticias.
        await get(`/news/${PUBLICADA.id}`)
          .set('Authorization', header)
          .expect(200);
      },
    );

    it('un token inválido tampoco abre el borrador', async () => {
      await get(`/news/${BORRADOR.id}`)
        .set('Authorization', 'Bearer no-es-un-jwt')
        .expect(404);
    });
  });
});
