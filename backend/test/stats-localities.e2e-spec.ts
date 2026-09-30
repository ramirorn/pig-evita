// ===========================================
// E2E — GET /stats/localities (mapa de calor público)
// ===========================================
/**
 * A diferencia de `dashboard-stats.e2e-spec.ts`, acá Prisma **no** se mockea con
 * constantes: el service agrega todo en una consulta SQL cruda, y las reglas que
 * importan (excluir rechazadas, a qué localidad va cada podio, no partir
 * "Clorinda " de "clorinda", omitir las que dan cero) viven en ese SQL. Un doble
 * que devolviera filas armadas a mano pasaría con la consulta rota.
 *
 * Por eso `$queryRaw` corre contra un Postgres de verdad: PGlite (Postgres
 * compilado a WASM, en proceso) con **las migraciones reales del proyecto**
 * aplicadas. No hace falta Docker ni la base de desarrollo, y si una migración
 * futura renombra una columna, este test se entera.
 *
 * Redis se reemplaza con el mismo `FakeRedis` del dashboard.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import type { PGlite as PGliteTipo } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';

class FakeRedis {
  static ultimaInstancia: FakeRedis | null = null;

  status = 'end';
  almacen = new Map<string, string>();
  get = jest.fn((clave: string) =>
    Promise.resolve(this.almacen.get(clave) ?? null),
  );
  setex = jest.fn((clave: string, _ttl: number, valor: string) => {
    this.almacen.set(clave, valor);
    return Promise.resolve('OK');
  });
  on = jest.fn();
  connect = jest.fn(() => Promise.resolve());
  disconnect = jest.fn();

  constructor() {
    FakeRedis.ultimaInstancia = this;
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => new FakeRedis()),
}));

import { StatsController } from '../src/modules/stats/stats.controller';
import { StatsService } from '../src/modules/stats/stats.service';
import { PrismaService } from '../src/database/prisma.service';
import {
  TransformInterceptor,
  CacheControlInterceptor,
} from '../src/common/interceptors';
import { RolesGuard } from '../src/common/guards';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';

/**
 * PGlite se carga con el `require` nativo de Node y no con el de Jest. Jest
 * ejecuta cada módulo dentro de un `vm` que no soporta `import()` dinámico sin
 * `--experimental-vm-modules`, y PGlite importa así sus propios módulos (el
 * `.wasm`, `fs`, `zlib`). `process.getBuiltinModule` devuelve el módulo real
 * (el `node:module` que ve el test es el de Jest). Cargado por afuera, corre en el contexto normal de
 * Node y el resto de la suite sigue igual.
 */
const requireNativo = process
  .getBuiltinModule('node:module')
  .createRequire(__filename);
const { PGlite } = requireNativo(
  '@electric-sql/pglite',
) as typeof import('@electric-sql/pglite');
type PGlite = PGliteTipo;

// -------------------------------------------------
// Ids legibles: el prefijo dice qué es cada cosa
// -------------------------------------------------
const id = (prefijo: string, n: number) =>
  `${prefijo}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DISC = {
  ATLETISMO: id('d0000000', 1),
  FUTBOL: id('d0000000', 2),
  AJEDREZ: id('d0000000', 3),
};
const CAT = {
  ATL_SUB14: id('c0000000', 1),
  ATL_SUB16: id('c0000000', 2),
  FUT_SUB14: id('c0000000', 3),
  AJE_SUB14: id('c0000000', 4),
};

/** PII plantada en las filas: nada de esto puede aparecer en la respuesta. */
const PII = {
  dni: '40111222',
  nombre: 'Valentina',
  apellido: 'Benítez',
  email: 'tutora.benitez@gmail.com',
  telefono: '3704555666',
  domicilio: 'Calle Falsa 123',
};

describe('GET /stats/localities (e2e)', () => {
  let db: PGlite;
  let app: INestApplication<App>;
  let queryRaw: jest.Mock;

  // -------------------------------------------------
  // Postgres en proceso con el esquema real
  // -------------------------------------------------
  beforeAll(async () => {
    db = new PGlite();
    const dir = join(__dirname, '..', 'prisma', 'migrations');
    const migraciones = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const m of migraciones) {
      await db.exec(readFileSync(join(dir, m, 'migration.sql'), 'utf8'));
    }
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(
      'TRUNCATE results, matches, competitions, inscriptions, team_members, teams, participants, categories, disciplines CASCADE',
    );
    await sembrarCatalogo();
  });

  afterEach(async () => {
    if (app) await app.close();
    FakeRedis.ultimaInstancia = null;
    jest.clearAllMocks();
  });

  async function levantarApp() {
    // `$queryRaw` recibe el `Prisma.Sql` que arma el service; `.text` trae los
    // placeholders `$1..$n` y `.values` los parámetros, igual que el driver pg.
    queryRaw = jest.fn(async (consulta: Prisma.Sql) => {
      const r = await db.query(consulta.text, consulta.values);
      return r.rows;
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [StatsController],
      providers: [
        StatsService,
        JwtStrategy,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        {
          provide: ConfigService,
          useValue: {
            get: (clave: string, def?: unknown) =>
              clave === 'jwt.accessSecret' ? 'secreto-de-prueba' : def,
          },
        },
        // Los mismos guards globales que en producción: si faltara el
        // `@Public()`, el request anónimo rebotaría con 401 acá también.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  }

  // -------------------------------------------------
  // Helpers de carga
  // -------------------------------------------------
  async function sembrarCatalogo() {
    await db.query(
      `INSERT INTO disciplines (id, name, type, result_type, updated_at) VALUES
        ($1, 'Atletismo', 'INDIVIDUAL', 'TIEMPO', now()),
        ($2, 'Fútbol', 'EQUIPO', 'GOLES', now()),
        ($3, 'Ajedrez', 'INDIVIDUAL', 'POSICIONES', now())`,
      [DISC.ATLETISMO, DISC.FUTBOL, DISC.AJEDREZ],
    );
    await db.query(
      `INSERT INTO categories (id, discipline_id, name, min_age, max_age, sex, updated_at) VALUES
        ($1, $5, 'Sub-14 Mixto', 12, 14, 'MIXTO', now()),
        ($2, $5, 'Sub-16 Mixto', 15, 16, 'MIXTO', now()),
        ($3, $6, 'Sub-14 Masculino', 12, 14, 'MASCULINO', now()),
        ($4, $7, 'Sub-14 Mixto', 12, 14, 'MIXTO', now())`,
      [
        CAT.ATL_SUB14,
        CAT.ATL_SUB16,
        CAT.FUT_SUB14,
        CAT.AJE_SUB14,
        DISC.ATLETISMO,
        DISC.FUTBOL,
        DISC.AJEDREZ,
      ],
    );
  }

  let secuencia = 0;

  async function participante(
    n: number,
    locality: string,
    department: string,
  ): Promise<string> {
    const pid = id('a0000000', n);
    await db.query(
      `INSERT INTO participants
        (id, dni, first_name, last_name, birth_date, sex, phone, email, locality, department, address, updated_at)
       VALUES ($1, $2, $3, $4, '2012-04-18', 'FEMENINO', $5, $6, $7, $8, $9, now())`,
      [
        pid,
        `${PII.dni}${n}`,
        PII.nombre,
        PII.apellido,
        PII.telefono,
        PII.email,
        locality,
        department,
        PII.domicilio,
      ],
    );
    return pid;
  }

  async function equipo(
    n: number,
    locality: string,
    department: string,
    opciones: { activo?: boolean; categoria?: string } = {},
  ): Promise<string> {
    const tid = id('e0000000', n);
    await db.query(
      `INSERT INTO teams (id, name, discipline_id, category_id, locality, department, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        tid,
        `Equipo ${n}`,
        DISC.FUTBOL,
        opciones.categoria ?? CAT.FUT_SUB14,
        locality,
        department,
        opciones.activo ?? true,
      ],
    );
    return tid;
  }

  async function inscribir(
    participantId: string,
    categoryId: string,
    status: 'PENDIENTE' | 'REVISADA' | 'APROBADA' | 'RECHAZADA',
    teamId: string | null = null,
  ) {
    secuencia++;
    await db.query(
      `INSERT INTO inscriptions (id, participant_id, category_id, team_id, status, qr_code, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Nota interna del revisor', now())`,
      [
        id('b0000000', secuencia),
        participantId,
        categoryId,
        teamId,
        status,
        `EVITA-${String(secuencia).padStart(8, '0')}`,
      ],
    );
  }

  /** Un partido con sus resultados. `quien` es un participante o un equipo. */
  async function partido(
    n: number,
    disciplina: string,
    categoria: string,
    resultados: Array<{
      participantId?: string;
      teamId?: string;
      ranking: number | null;
      isWinner?: boolean;
    }>,
  ) {
    const comp = id('f0000000', n);
    const match = id('f1000000', n);
    await db.query(
      `INSERT INTO competitions (id, discipline_id, category_id, stage, format, updated_at)
       VALUES ($1, $2, $3, 'PROVINCIAL', 'ROUND_ROBIN', now())
       ON CONFLICT (discipline_id, category_id, stage) DO NOTHING`,
      [comp, disciplina, categoria],
    );
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM competitions WHERE discipline_id = $1 AND category_id = $2`,
      [disciplina, categoria],
    );
    await db.query(
      `INSERT INTO matches (id, competition_id, round, match_number, updated_at)
       VALUES ($1, $2, 1, $3, now())`,
      [match, rows[0].id, n],
    );
    for (const [i, r] of resultados.entries()) {
      await db.query(
        `INSERT INTO results (id, match_id, participant_id, team_id, score_data, ranking, is_winner, updated_at)
         VALUES ($1, $2, $3, $4, '{}', $5, $6, now())`,
        [
          id('f2000000', n * 100 + i),
          match,
          r.participantId ?? null,
          r.teamId ?? null,
          r.ranking,
          r.isWinner ?? false,
        ],
      );
    }
  }

  /**
   * El escenario completo. Cada localidad prueba una regla:
   *
   * - Clorinda: tres grafías ("Clorinda ", "clorinda", "CLORINDA  ") que tienen
   *   que quedar en una sola entrada; un atleta juega en un equipo de Formosa y
   *   suma en Clorinda; podios individuales.
   * - Formosa: el equipo (delegación por equipo) y su podio por team.locality.
   * - Ibarreta: un tercer puesto y una inscripción individual.
   * - Pirané: sólo inscripciones RECHAZADAS → no aparece.
   * - El Colorado: equipo con todas sus inscripciones rechazadas → no aparece.
   * - Las Lomitas: rechazado y un resultado fuera del podio → todo en cero, no
   *   aparece.
   * - Laguna Blanca: equipo inactivo; su atleta sí cuenta pero el equipo no es
   *   delegación.
   */
  async function sembrarEscenario() {
    const p1 = await participante(1, 'Clorinda ', 'Pilcomayo');
    const p2 = await participante(2, 'clorinda', 'Pilcomayo');
    const p3 = await participante(3, 'CLORINDA  ', 'Pilcomayo');
    const p4 = await participante(4, 'Formosa', 'Formosa');
    const p5 = await participante(5, 'Pirané', 'Pirané');
    const p6 = await participante(6, 'El Colorado', 'Pirané');
    const p7 = await participante(7, 'Las Lomitas', 'Patiño');
    const p8 = await participante(8, 'Ibarreta', 'Patiño');
    const p9 = await participante(9, 'Laguna Blanca', 'Pilagás');

    const formosa = await equipo(1, 'Formosa', 'Formosa');
    const colorado = await equipo(2, 'El Colorado', 'Pirané');
    const laguna = await equipo(3, 'Laguna Blanca', 'Pilagás', {
      activo: false,
    });

    // Clorinda: dos categorías individuales de atletismo + fútbol en equipo ajeno.
    await inscribir(p1, CAT.ATL_SUB14, 'APROBADA');
    await inscribir(p1, CAT.ATL_SUB16, 'PENDIENTE');
    await inscribir(p2, CAT.ATL_SUB14, 'REVISADA');
    await inscribir(p3, CAT.FUT_SUB14, 'APROBADA', formosa);
    // Formosa
    await inscribir(p4, CAT.FUT_SUB14, 'PENDIENTE', formosa);
    // Pirané y El Colorado: todo rechazado.
    await inscribir(p5, CAT.AJE_SUB14, 'RECHAZADA');
    await inscribir(p6, CAT.FUT_SUB14, 'RECHAZADA', colorado);
    // Las Lomitas
    await inscribir(p7, CAT.ATL_SUB14, 'RECHAZADA');
    // Ibarreta
    await inscribir(p8, CAT.AJE_SUB14, 'APROBADA');
    // Laguna Blanca: equipo dado de baja
    await inscribir(p9, CAT.FUT_SUB14, 'APROBADA', laguna);

    // Atletismo sub-14: podio individual.
    await partido(1, DISC.ATLETISMO, CAT.ATL_SUB14, [
      { participantId: p1, ranking: 1, isWinner: true },
      { participantId: p2, ranking: 2 },
      { participantId: p7, ranking: 4 },
    ]);
    // Fútbol: el resultado es del equipo de Formosa, aunque lo integre alguien
    // de Clorinda. El rival no tiene resultado de podio.
    await partido(2, DISC.FUTBOL, CAT.FUT_SUB14, [
      { teamId: formosa, ranking: 1, isWinner: true },
      { teamId: colorado, ranking: null, isWinner: false },
    ]);
    // Ajedrez: un tercer puesto para Ibarreta.
    await partido(3, DISC.AJEDREZ, CAT.AJE_SUB14, [
      { participantId: p8, ranking: 3 },
    ]);
  }

  function pedir() {
    return request(app.getHttpServer()).get('/stats/localities');
  }

  const porNombre = (body: any, nombre: string) =>
    body.data.localities.find((l: any) => l.locality === nombre);

  // -------------------------------------------------
  // Tests
  // -------------------------------------------------
  describe('acceso', () => {
    it('responde 200 sin sesión, con el envoltorio estándar y cacheable', async () => {
      await sembrarEscenario();
      await levantarApp();

      const res = await pedir().expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.generatedAt).toBe('string');
      expect(new Date(res.body.data.generatedAt).toISOString()).toBe(
        res.body.data.generatedAt,
      );
      expect(Array.isArray(res.body.data.localities)).toBe(true);
      expect(res.headers['cache-control']).toContain('public');
    });
  });

  describe('datos personales', () => {
    it('sólo devuelve conteos: ni nombres, ni DNI, ni contacto, ni ids', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);

      expect(Object.keys(body.data).sort()).toEqual([
        'generatedAt',
        'localities',
      ]);
      for (const l of body.data.localities) {
        expect(Object.keys(l).sort()).toEqual([
          'athletes',
          'categories',
          'delegations',
          'department',
          'disciplines',
          'locality',
          'podiums',
          'wins',
        ]);
        expect(Object.keys(l.podiums).sort()).toEqual([
          'first',
          'second',
          'third',
        ]);
      }

      const crudo = JSON.stringify(body);
      for (const valor of Object.values(PII)) {
        expect(crudo).not.toContain(valor);
      }
      expect(crudo).not.toContain('Nota interna');
      expect(crudo).not.toContain('EVITA-');
      expect(crudo).not.toContain('Equipo ');
      // Ningún uuid: con localidades chicas, un id alcanza para reidentificar.
      expect(crudo).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
      );
    });
  });

  describe('conteos', () => {
    it('agrupa las grafías de una localidad y devuelve la más legible', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);
      const clorindas = body.data.localities.filter(
        (l: any) => l.locality.trim().toLowerCase() === 'clorinda',
      );

      expect(clorindas).toHaveLength(1);
      expect(clorindas[0]).toEqual({
        locality: 'Clorinda',
        department: 'Pilcomayo',
        // p1, p2 y p3 (que juega en un equipo de Formosa pero es de Clorinda).
        athletes: 3,
        // Atletismo sub-14 y sub-16 individuales. El equipo es de Formosa.
        delegations: 2,
        // Atletismo + Fútbol (por p3).
        disciplines: 2,
        categories: 3,
        podiums: { first: 1, second: 1, third: 0 },
        wins: 1,
      });
    });

    it('atribuye el podio de equipo por team.locality, no por sus integrantes', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);

      expect(porNombre(body, 'Formosa')).toEqual({
        locality: 'Formosa',
        department: 'Formosa',
        athletes: 1,
        delegations: 1,
        disciplines: 1,
        categories: 1,
        podiums: { first: 1, second: 0, third: 0 },
        wins: 1,
      });
      expect(porNombre(body, 'Ibarreta')).toEqual({
        locality: 'Ibarreta',
        department: 'Patiño',
        athletes: 1,
        delegations: 1,
        disciplines: 1,
        categories: 1,
        podiums: { first: 0, second: 0, third: 1 },
        wins: 0,
      });
    });

    it('excluye las inscripciones rechazadas', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);
      const nombres = body.data.localities.map((l: any) => l.locality);

      // Sólo tenían inscripciones RECHAZADAS.
      expect(nombres).not.toContain('Pirané');
      expect(nombres).not.toContain('El Colorado');
    });

    it('omite las localidades con todos los conteos en cero', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);

      // Las Lomitas tiene una inscripción rechazada y un cuarto puesto: nada
      // que sume en ningún contador.
      expect(porNombre(body, 'Las Lomitas')).toBeUndefined();
      for (const l of body.data.localities) {
        const total =
          l.athletes +
          l.delegations +
          l.disciplines +
          l.categories +
          l.podiums.first +
          l.podiums.second +
          l.podiums.third +
          l.wins;
        expect(total).toBeGreaterThan(0);
      }
      expect(body.data.localities.map((l: any) => l.locality)).toEqual([
        'Clorinda',
        'Formosa',
        'Ibarreta',
        'Laguna Blanca',
      ]);
    });

    it('un equipo inactivo no es delegación, pero su atleta sí cuenta', async () => {
      await sembrarEscenario();
      await levantarApp();

      const { body } = await pedir().expect(200);

      expect(porNombre(body, 'Laguna Blanca')).toMatchObject({
        athletes: 1,
        delegations: 0,
        disciplines: 1,
        categories: 1,
      });
    });

    it('sin datos devuelve una lista vacía', async () => {
      await levantarApp();
      const { body } = await pedir().expect(200);
      expect(body.data.localities).toEqual([]);
    });

    it('agrega en la base: una sola consulta por request', async () => {
      await sembrarEscenario();
      await levantarApp();
      await pedir().expect(200);
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache Redis', () => {
    function conectarRedis() {
      FakeRedis.ultimaInstancia!.status = 'ready';
      return FakeRedis.ultimaInstancia!;
    }

    it('sin Redis responde igual, calculando contra la base', async () => {
      await sembrarEscenario();
      await levantarApp();

      await pedir().expect(200);
      await pedir().expect(200);

      expect(queryRaw).toHaveBeenCalledTimes(2);
      expect(FakeRedis.ultimaInstancia!.get).not.toHaveBeenCalled();
    });

    it('la segunda llamada se sirve del cache, con TTL de 60s', async () => {
      await sembrarEscenario();
      await levantarApp();
      const redis = conectarRedis();

      const primera = await pedir().expect(200);
      const segunda = await pedir().expect(200);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(redis.setex).toHaveBeenCalledWith(
        'stats:localities',
        60,
        expect.any(String),
      );
      expect(segunda.body.data).toEqual(primera.body.data);
    });

    it('si Redis falla al leer, cae a la base en vez de romper', async () => {
      await sembrarEscenario();
      await levantarApp();
      const redis = conectarRedis();
      redis.get.mockRejectedValueOnce(new Error('READONLY'));

      const { body } = await pedir().expect(200);
      expect(body.data.localities.length).toBeGreaterThan(0);
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
