// ===========================================
// E2E — Seguridad del alta individual de inscripciones
// (relevamiento OWASP 2025: VULN-06, VULN-25, VULN-32, VULN-44)
// ===========================================
//
// `POST /inscriptions` por HTTP, con el guard de JWT y el de roles reales y un
// doble de Prisma que **evalúa el `where`** (`mocks/prisma-territorial`): si el
// doble devolviera siempre la fila pedida, el chequeo de alcance del equipo
// pasaría igual puesto que sacado.
//
//   * VULN-06 — el `teamId` del body no puede colgar la inscripción de un
//     equipo de otro departamento ni de otra categoría.
//   * VULN-32 — los códigos QR nuevos tienen 128 bits o más de entropía.
//   * VULN-25 — el DNI del participante no se escribe en el log.
//   * VULN-44 — el 409 por DNI ajeno queda registrado (sin el DNI) para poder
//     alertar sobre quien lo usa como oráculo.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { PrismaService } from '../src/database/prisma.service';
import { ScopeService } from '../src/common/scope';
import { Role } from '../src/common/constants';
import { coincide, tabla } from './mocks/prisma-territorial';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const PILCOMAYO = 'Pilcomayo';
const PIRANE = 'Pirané';

const DISCIPLINA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Fútbol',
  type: 'EQUIPO',
  minPlayers: 5,
  maxPlayers: 11,
  isActive: true,
};

const categoria = (id: string, name: string) => ({
  id,
  name,
  disciplineId: DISCIPLINA.id,
  discipline: DISCIPLINA,
  sex: 'MIXTO',
  minAge: 12,
  maxAge: 14,
  isActive: true,
});

const CATEGORIA = categoria('55555555-5555-4555-8555-555555555555', 'Sub-14');
const OTRA_CATEGORIA = categoria(
  '66666666-6666-4666-8666-666666666666',
  'Sub-14 B',
);

const equipo = (
  id: string,
  name: string,
  department: string,
  categoryId: string,
) => ({
  id,
  name,
  disciplineId: DISCIPLINA.id,
  categoryId,
  locality: 'Localidad',
  department,
  isActive: true,
});

const T_PROPIO = equipo(
  '11111111-1111-4111-8111-111111111111',
  'Clorinda FC',
  PILCOMAYO,
  CATEGORIA.id,
);
const T_AJENO = equipo(
  '99999999-9999-4999-8999-999999999999',
  'Juniors del Sur',
  PIRANE,
  CATEGORIA.id,
);
const T_PROPIO_OTRA_CATEGORIA = equipo(
  '22222222-2222-4222-8222-222222222222',
  'Clorinda B',
  PILCOMAYO,
  OTRA_CATEGORIA.id,
);
const ID_INEXISTENTE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** Participante ya cargado en Pirané: su DNI es el que usa el oráculo. */
const P_AJENO = {
  id: '99999999-aaaa-4aaa-8aaa-999999999999',
  dni: '48999999',
  firstName: 'Joaquín',
  lastName: 'Insaurralde',
  birthDate: new Date('2012-06-15T00:00:00.000Z'),
  sex: 'MASCULINO',
  locality: 'Villa Dos Trece',
  department: PIRANE,
};

/** Nacimiento que cae dentro de la categoría sin depender del año en curso. */
const NACIMIENTO_ISO = new Date(
  Date.UTC(new Date().getUTCFullYear() - 13, 5, 15),
)
  .toISOString()
  .slice(0, 10);

const cuerpo = (extra: Record<string, unknown> = {}) => ({
  dni: '30111222',
  firstName: 'Nuevo',
  lastName: 'Participante',
  birthDate: NACIMIENTO_ISO,
  sex: 'FEMENINO',
  locality: 'Clorinda',
  department: PILCOMAYO,
  categoryId: CATEGORIA.id,
  ...extra,
});

let contador = 0;
const sufijo = () => String(++contador).padStart(12, '0');

function crearPrisma() {
  const participant = tabla('participant', [P_AJENO], (datos) => ({
    ...datos,
    id: `eeeeeeee-eeee-4eee-8eee-${sufijo()}`,
  }));
  const category = tabla('category', [CATEGORIA, OTRA_CATEGORIA]);
  const team = tabla('team', [T_PROPIO, T_AJENO, T_PROPIO_OTRA_CATEGORIA]);
  const inscription = tabla(
    'inscription',
    [] as Record<string, any>[],
    (datos) => ({
      ...datos,
      id: `ffffffff-ffff-4fff-8fff-${sufijo()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      participant: participant._filas.find((p) => p.id === datos.participantId),
      category: [CATEGORIA, OTRA_CATEGORIA].find(
        (c) => c.id === datos.categoryId,
      ),
    }),
  );

  const prisma: Record<string, any> = {
    participant,
    category,
    team,
    inscription,
    zoneDepartment: {
      findMany: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
        Promise.resolve([].filter((z) => coincide(z, where))),
      ),
    },
  };
  prisma.$transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(prisma));
  return prisma;
}

describe('Seguridad del alta individual de inscripciones (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let prisma: ReturnType<typeof crearPrisma>;

  beforeEach(async () => {
    prisma = crearPrisma();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [InscriptionsController],
      providers: [
        InscriptionsService,
        ScopeService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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
    jest.restoreAllMocks();
    await app.close();
  });

  const token = (role: Role, department: string | null) =>
    jwt.sign({
      sub: `usuario-${role}-${department ?? 'provincia'}`,
      email: `${role.toLowerCase()}@juegosevita.gob.ar`,
      role,
      department,
      zone: null,
      type: 'access',
    });

  const alta = (
    body: Record<string, unknown>,
    role: Role = Role.DELEGADO,
    department: string | null = PILCOMAYO,
  ) =>
    request(app.getHttpServer())
      .post('/inscriptions')
      .set('Authorization', `Bearer ${token(role, department)}`)
      .send(body);

  // -------------------------------------------------
  // VULN-06 — alcance y coherencia del equipo
  // -------------------------------------------------
  describe('VULN-06 — el teamId del body', () => {
    it('un DELEGADO no puede colgar la inscripción de un equipo de otro departamento: 404 y sin escrituras', async () => {
      const res = await alta(cuerpo({ teamId: T_AJENO.id })).expect(404);

      expect(JSON.stringify(res.body)).not.toContain(T_AJENO.name);
      expect(prisma.inscription._filas).toHaveLength(0);
      // El chequeo va antes de crear al participante: un 404 no deja una
      // persona huérfana en el padrón.
      expect(prisma.participant._filas).toHaveLength(1);
    });

    it('el 404 del equipo ajeno es el mismo que el de un equipo inexistente', async () => {
      const ajeno = await alta(cuerpo({ teamId: T_AJENO.id })).expect(404);
      const inexistente = await alta(cuerpo({ teamId: ID_INEXISTENTE })).expect(
        404,
      );

      expect(ajeno.body.message).toBe(inexistente.body.message);
    });

    it('tampoco con un equipo propio de otra categoría', async () => {
      await alta(cuerpo({ teamId: T_PROPIO_OTRA_CATEGORIA.id })).expect(404);
      expect(prisma.inscription._filas).toHaveLength(0);
    });

    it('con un equipo propio de la misma categoría la inscripción se crea con ese equipo', async () => {
      const res = await alta(cuerpo({ teamId: T_PROPIO.id })).expect(201);

      expect(res.body.teamId).toBe(T_PROPIO.id);
      expect(prisma.inscription._filas[0].teamId).toBe(T_PROPIO.id);
    });

    it('sin equipo el alta sigue funcionando como antes', async () => {
      const res = await alta(cuerpo()).expect(201);

      expect(res.body.status).toBe('PENDIENTE');
      expect(prisma.inscription._filas[0].teamId).toBeUndefined();
    });

    it('un ADMIN_PROVINCIAL puede usar el equipo de cualquier departamento de la categoría', async () => {
      const res = await alta(
        cuerpo({ teamId: T_AJENO.id }),
        Role.ADMIN_PROVINCIAL,
        null,
      ).expect(201);

      expect(res.body.teamId).toBe(T_AJENO.id);
    });

    it('pero tampoco puede mezclar categorías', async () => {
      await alta(
        cuerpo({ teamId: T_PROPIO_OTRA_CATEGORIA.id }),
        Role.ADMIN_PROVINCIAL,
        null,
      ).expect(404);
    });
  });

  // -------------------------------------------------
  // VULN-32 — entropía de los códigos nuevos
  // -------------------------------------------------
  describe('VULN-32 — código QR de las inscripciones nuevas', () => {
    it('tiene el prefijo EVITA- y 26 caracteres Crockford (130 bits)', async () => {
      const res = await alta(cuerpo()).expect(201);

      // Crockford base32: dígitos y mayúsculas sin I, L, O ni U. Es mayúscula
      // a propósito: la consulta pública pasa lo que tipea la persona a
      // mayúsculas antes de buscar.
      expect(res.body.qrCode).toMatch(/^EVITA-[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('dos altas no comparten código', async () => {
      const a = await alta(cuerpo({ dni: '30111222' })).expect(201);
      const b = await alta(cuerpo({ dni: '30111223' })).expect(201);

      expect(a.body.qrCode).not.toBe(b.body.qrCode);
    });
  });

  // -------------------------------------------------
  // VULN-25 — DNI fuera del log
  // -------------------------------------------------
  describe('VULN-25 — log de aplicación', () => {
    it('un alta que crea al participante no escribe su DNI en el log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await alta(cuerpo({ dni: '30444555' })).expect(201);

      const escrito = JSON.stringify([...log.mock.calls, ...warn.mock.calls]);
      expect(log).toHaveBeenCalled();
      expect(escrito).not.toContain('30444555');
    });
  });

  // -------------------------------------------------
  // VULN-44 — oráculo de existencia del DNI
  // -------------------------------------------------
  describe('VULN-44 — DNI que existe fuera del alcance', () => {
    it('responde el mismo 409 de siempre y deja un aviso con el usuario, sin el DNI', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      const res = await alta(cuerpo({ dni: P_AJENO.dni })).expect(409);

      expect(res.body.message).toBe(
        'Ya existe un participante con ese DNI. Si es de tu departamento, ' +
          'buscalo en el padrón; si no, pedí el alta a un administrador.',
      );
      const avisos = JSON.stringify(warn.mock.calls);
      expect(avisos).toContain(`usuario-${Role.DELEGADO}-${PILCOMAYO}`);
      expect(avisos).not.toContain(P_AJENO.dni);
    });
  });
});
