// ===========================================
// E2E — Alcance territorial por rol (R05)
// ===========================================
//
// Antes de R05 no había scoping en ninguna parte: un `DELEGADO` exportaba el
// padrón provincial completo por `/reports/participants` —110 filas con fechas
// de nacimiento de menores— y un `ADMIN_ZONAL` tenía en la práctica el mismo
// alcance que un `ADMIN_PROVINCIAL`. `User.zone` y `User.department` existían y
// no se consultaban en ninguna query.
//
// Este spec es la matriz rol × endpoint que pide el DoD. Para cada rol acotado
// verifica las tres puntas, que son distintas y se olvidan por separado:
//
//   1. la fila de otro departamento NO aparece en el listado,
//   2. NO se puede leer por id directo —y el 404 es indistinguible del de un id
//      inexistente, porque un 403 confirmaría que ahí hay algo—,
//   3. NO aparece en la exportación, que además declara el alcance aplicado.
//
// El doble de Prisma **evalúa el `where`**: si devolviera siempre todas las
// filas, el test pasaría igual con el scoping puesto y sin él, que es la forma
// más común de escribir un test que no prueba nada. Verificado a mano
// neutralizando `ScopeService.whereParticipant`: fallan 26 de 40.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';

import { ParticipantsController } from '../src/modules/participants/participants.controller';
import { ParticipantsService } from '../src/modules/participants/participants.service';
import { TeamsController } from '../src/modules/teams/teams.controller';
import { TeamsService } from '../src/modules/teams/teams.service';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { MinioService } from '../src/modules/documents/minio.service';
import { FileSignaturePipe } from '../src/modules/documents/file-signature.pipe';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/database/prisma.service';
import { ScopeService } from '../src/common/scope';
import { Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

// -------------------------------------------------
// El territorio del fixture
// -------------------------------------------------
const PILCOMAYO = 'Pilcomayo';
const CAPITAL = 'Formosa';
const RAMON_LISTA = 'Ramón Lista';

/** Zona cargada en `zone_departments`. La otra queda sin mapear a propósito. */
const ZONA_MAPEADA = 'Zona Norte';
const ZONA_SIN_MAPEO = 'Zona Sin Cargar';

const P_PILCOMAYO = {
  id: '11111111-1111-4111-8111-111111111111',
  dni: '48111111',
  firstName: 'Ana',
  lastName: 'Gómez',
  sex: 'FEMENINO',
  birthDate: new Date('2011-03-04T00:00:00.000Z'),
  phone: null,
  email: null,
  locality: 'Clorinda',
  department: PILCOMAYO,
  inscriptions: [],
  documents: [],
  teamMembers: [],
};

const P_CAPITAL = {
  ...P_PILCOMAYO,
  id: '22222222-2222-4222-8222-222222222222',
  dni: '48222222',
  lastName: 'Fernández',
  locality: 'Formosa',
  department: CAPITAL,
};

const P_RAMON_LISTA = {
  ...P_PILCOMAYO,
  id: '33333333-3333-4333-8333-333333333333',
  dni: '48333333',
  lastName: 'Sosa',
  locality: 'El Potrillo',
  department: RAMON_LISTA,
};

const PARTICIPANTES = [P_PILCOMAYO, P_CAPITAL, P_RAMON_LISTA];

const DISCIPLINA = { id: 'd1', name: 'Fútbol', minPlayers: 5, maxPlayers: 11 };
const CATEGORIA = {
  id: 'c1',
  name: 'Sub-14 Masculino',
  discipline: DISCIPLINA,
  disciplineId: DISCIPLINA.id,
};

const T_PILCOMAYO = {
  id: 'aaaaaaa1-1111-4111-8111-111111111111',
  name: 'Los del Norte',
  locality: 'Clorinda',
  department: PILCOMAYO,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  discipline: DISCIPLINA,
  category: CATEGORIA,
  members: [],
  _count: { members: 0, inscriptions: 0, results: 0 },
};

const T_CAPITAL = {
  ...T_PILCOMAYO,
  id: 'bbbbbbb2-2222-4222-8222-222222222222',
  name: 'Capital FC',
  locality: 'Formosa',
  department: CAPITAL,
};

const EQUIPOS = [T_PILCOMAYO, T_CAPITAL];

const I_PILCOMAYO = {
  id: 'ccccccc1-1111-4111-8111-111111111111',
  qrCode: 'EVITA-PILCO001',
  status: 'PENDIENTE',
  notes: null,
  rejectionNote: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  reviewedAt: null,
  approvedAt: null,
  participant: P_PILCOMAYO,
  participantId: P_PILCOMAYO.id,
  category: CATEGORIA,
  categoryId: CATEGORIA.id,
  team: null,
  createdBy: null,
  reviewedBy: null,
  approvedBy: null,
};

const I_CAPITAL = {
  ...I_PILCOMAYO,
  id: 'ddddddd2-2222-4222-8222-222222222222',
  qrCode: 'EVITA-CAPITAL1',
  participant: P_CAPITAL,
  participantId: P_CAPITAL.id,
};

const INSCRIPCIONES = [I_PILCOMAYO, I_CAPITAL];

const DOC_PILCOMAYO = {
  id: 'eeeeeee1-1111-4111-8111-111111111111',
  participantId: P_PILCOMAYO.id,
  participant: P_PILCOMAYO,
  documentType: 'DNI_FRENTE',
  fileKey: 'participants/p1/dni.pdf',
  originalName: 'dni.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  status: 'PENDIENTE',
  createdAt: new Date('2026-02-02T00:00:00.000Z'),
};

const DOC_CAPITAL = {
  ...DOC_PILCOMAYO,
  id: 'fffffff2-2222-4222-8222-222222222222',
  participantId: P_CAPITAL.id,
  participant: P_CAPITAL,
};

const DOCUMENTOS = [DOC_PILCOMAYO, DOC_CAPITAL];

/** Mapeo zona → departamentos. Sólo una de las dos zonas está cargada. */
const ZONE_DEPARTMENTS = [{ zone: ZONA_MAPEADA, department: CAPITAL }];

// -------------------------------------------------
// Evaluador de `where`
// -------------------------------------------------
//
// Un mock que devuelve siempre todas las filas haría pasar por igual al código
// con scoping y al de antes. Éste interpreta lo que el service construye:
// `AND`, `OR`, `equals` con `mode: 'insensitive'`, `in` (incluida la lista
// vacía, que es como se expresa "no ve nada") y las relaciones anidadas.
type Where = Record<string, any> | undefined;

function igual(campo: unknown, valor: unknown, mode?: string): boolean {
  if (
    mode === 'insensitive' &&
    typeof campo === 'string' &&
    typeof valor === 'string'
  ) {
    return campo.toLowerCase() === valor.toLowerCase();
  }
  return campo === valor;
}

function coincide(fila: any, where: Where): boolean {
  if (!where) return true;

  return Object.entries(where).every(([clave, valor]) => {
    if (valor === undefined) return true;
    if (clave === 'AND')
      return (valor as Where[]).every((w) => coincide(fila, w));
    if (clave === 'OR')
      return (valor as Where[]).some((w) => coincide(fila, w));
    if (clave === 'NOT') return !coincide(fila, valor as Where);

    const campo = fila?.[clave];

    if (valor !== null && typeof valor === 'object') {
      if ('equals' in valor) return igual(campo, valor.equals, valor.mode);
      if ('in' in valor) {
        return (valor.in as unknown[]).some((v) => igual(campo, v, valor.mode));
      }
      if ('contains' in valor) {
        return String(campo ?? '')
          .toLowerCase()
          .includes(String(valor.contains).toLowerCase());
      }
      // Relación anidada (`participant: { ... }`).
      return coincide(campo, valor as Where);
    }

    return campo === valor;
  });
}

function tabla<T>(filas: T[]) {
  return {
    findMany: jest.fn(({ where }: { where?: Where } = {}) =>
      Promise.resolve(filas.filter((f) => coincide(f, where))),
    ),
    findFirst: jest.fn(({ where }: { where?: Where } = {}) =>
      Promise.resolve(filas.find((f) => coincide(f, where)) ?? null),
    ),
    findUnique: jest.fn(({ where }: { where?: Where } = {}) =>
      Promise.resolve(filas.find((f) => coincide(f, where)) ?? null),
    ),
    count: jest.fn(({ where }: { where?: Where } = {}) =>
      Promise.resolve(filas.filter((f) => coincide(f, where)).length),
    ),
  };
}

describe('Alcance territorial por rol (R05)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeEach(async () => {
    const prisma = {
      participant: tabla(PARTICIPANTES),
      team: tabla(EQUIPOS),
      inscription: tabla(INSCRIPCIONES),
      document: tabla(DOCUMENTOS),
      zoneDepartment: {
        findMany: jest.fn(({ where }: { where?: Where } = {}) =>
          Promise.resolve(
            ZONE_DEPARTMENTS.filter((z) => coincide(z, where)).map((z) => ({
              department: z.department,
            })),
          ),
        ),
      },
      category: { findUnique: jest.fn(() => Promise.resolve(null)) },
      match: tabla([]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [
        ParticipantsController,
        TeamsController,
        InscriptionsController,
        DocumentsController,
        ReportsController,
      ],
      providers: [
        ParticipantsService,
        TeamsService,
        InscriptionsService,
        DocumentsService,
        ReportsService,
        ScopeService,
        FileSignaturePipe,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: MinioService,
          useValue: {
            getPresignedUrl: jest.fn(() => Promise.resolve('https://firmada')),
            uploadFile: jest.fn(() => Promise.resolve('clave')),
          },
        },
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
    await app.close();
  });

  /** Token de un usuario con su territorio cargado (o sin él, a propósito). */
  const tokenDe = (
    role: Role,
    territorio: { department?: string | null; zone?: string | null } = {},
  ) =>
    jwt.sign({
      sub: `usuario-${role}-${territorio.department ?? territorio.zone ?? 'sin-territorio'}`,
      email: `${role.toLowerCase()}@juegosevita.gob.ar`,
      role,
      department: territorio.department ?? null,
      zone: territorio.zone ?? null,
      type: 'access',
    });

  const get = (
    path: string,
    role: Role,
    territorio?: { department?: string | null; zone?: string | null },
  ) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${tokenDe(role, territorio)}`);

  /** Descarga cruda de un reporte, sin que supertest interprete el cuerpo. */
  const descargar = (
    path: string,
    role: Role,
    territorio?: { department?: string | null; zone?: string | null },
  ) =>
    get(path, role, territorio)
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (c: Buffer) => partes.push(Buffer.from(c)));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });

  /** Líneas de datos del CSV (sin BOM, sin la fila de alcance ni el encabezado). */
  function filasDelCsv(cuerpo: Buffer): string[] {
    const lineas = cuerpo
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split('\n');
    return lineas.slice(2).filter((l) => l.trim().length > 0);
  }

  function alcanceDelCsv(cuerpo: Buffer): string {
    return cuerpo
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .split('\n')[0];
  }

  // ===========================================
  // 1. Alcance provincial: no se recorta nada
  // ===========================================
  describe.each([Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL])(
    '%s (alcance provincial)',
    (role) => {
      it('ve los tres participantes del padrón', async () => {
        const res = await get('/participants', role).expect(200);
        expect(res.body.items).toHaveLength(PARTICIPANTES.length);
      });

      it('lee por id cualquier participante', async () => {
        await get(`/participants/${P_RAMON_LISTA.id}`, role).expect(200);
        await get(`/participants/${P_CAPITAL.id}`, role).expect(200);
      });

      it('exporta el padrón completo y el archivo lo declara', async () => {
        const res = await descargar('/reports/participants', role).expect(200);
        const cuerpo = res.body as Buffer;

        expect(filasDelCsv(cuerpo)).toHaveLength(PARTICIPANTES.length);
        expect(alcanceDelCsv(cuerpo)).toBe(
          '"Alcance del reporte: provincial (todos los departamentos)"',
        );
      });
    },
  );

  // ===========================================
  // 2. Roles acotados por departamento
  // ===========================================
  describe.each([
    [Role.ADMIN_DEPARTAMENTAL],
    [Role.DELEGADO],
    [Role.COORDINADOR],
  ])('%s de Pilcomayo (acotado por departamento)', (role) => {
    const territorio = { department: PILCOMAYO };

    it('el listado de participantes trae sólo los suyos', async () => {
      const res = await get('/participants', role, territorio).expect(200);
      const dnis = res.body.items.map((p: { dni: string }) => p.dni);

      expect(dnis).toContain(P_PILCOMAYO.dni);
      expect(dnis).not.toContain(P_CAPITAL.dni);
      expect(dnis).not.toContain(P_RAMON_LISTA.dni);
      expect(res.body.meta.total).toBe(1);
    });

    it('el de otro departamento NO se lee por id: 404, no 403', async () => {
      const ajeno = await get(
        `/participants/${P_CAPITAL.id}`,
        role,
        territorio,
      ).expect(404);

      const inexistente = await get(
        '/participants/99999999-9999-4999-8999-999999999999',
        role,
        territorio,
      ).expect(404);

      // Indistinguibles: un 403 le confirmaría a quien prueba ids que ese
      // participante existe (y, de yapa, que no es de su departamento).
      expect(ajeno.body.message).toBe(inexistente.body.message);
    });

    it('el propio sí se lee por id', async () => {
      const res = await get(
        `/participants/${P_PILCOMAYO.id}`,
        role,
        territorio,
      ).expect(200);
      expect(res.body.dni).toBe(P_PILCOMAYO.dni);
    });

    it('la búsqueda por DNI de un ajeno devuelve 404', async () => {
      await get(`/participants/dni/${P_CAPITAL.dni}`, role, territorio).expect(
        404,
      );
      await get(
        `/participants/dni/${P_PILCOMAYO.dni}`,
        role,
        territorio,
      ).expect(200);
    });

    it('el listado de equipos trae sólo los suyos', async () => {
      const res = await get('/teams', role, territorio).expect(200);
      const nombres = res.body.items.map((t: { name: string }) => t.name);

      expect(nombres).toContain(T_PILCOMAYO.name);
      expect(nombres).not.toContain(T_CAPITAL.name);
    });

    it('el equipo ajeno devuelve 404 por id', async () => {
      await get(`/teams/${T_CAPITAL.id}`, role, territorio).expect(404);
      await get(`/teams/${T_PILCOMAYO.id}`, role, territorio).expect(200);
    });

    it('los documentos de un participante ajeno no se listan', async () => {
      const ajenos = await get(
        `/documents/participant/${P_CAPITAL.id}`,
        role,
        territorio,
      ).expect(200);
      expect(ajenos.body).toHaveLength(0);

      const propios = await get(
        `/documents/participant/${P_PILCOMAYO.id}`,
        role,
        territorio,
      ).expect(200);
      expect(propios.body).toHaveLength(1);
    });

    it('un filtro por otro departamento no ensancha el alcance', async () => {
      // El `department=` del cliente y el recorte territorial van bajo `AND`:
      // pedir explícitamente un departamento ajeno devuelve cero filas, no un
      // atajo para verlo.
      const res = await get(
        `/participants?department=${encodeURIComponent(CAPITAL)}`,
        role,
        territorio,
      ).expect(200);

      expect(res.body.items).toHaveLength(0);
    });
  });

  // ===========================================
  // 3. Inscripciones (sólo los roles que las revisan)
  // ===========================================
  describe.each([[Role.ADMIN_DEPARTAMENTAL], [Role.DELEGADO]])(
    '%s de Pilcomayo — inscripciones',
    (role) => {
      const territorio = { department: PILCOMAYO };

      it('el listado trae sólo las de su departamento', async () => {
        const res = await get('/inscriptions', role, territorio).expect(200);
        const codigos = res.body.items.map((i: { qrCode: string }) => i.qrCode);

        expect(codigos).toContain(I_PILCOMAYO.qrCode);
        expect(codigos).not.toContain(I_CAPITAL.qrCode);
      });

      it('la inscripción ajena devuelve 404 por id', async () => {
        await get(`/inscriptions/${I_CAPITAL.id}`, role, territorio).expect(
          404,
        );
        await get(`/inscriptions/${I_PILCOMAYO.id}`, role, territorio).expect(
          200,
        );
      });
    },
  );

  // ===========================================
  // 4. El agujero que R05 cierra: sin territorio no se ve nada
  // ===========================================
  describe('rol acotado SIN su campo territorial cargado', () => {
    it('un DELEGADO sin departamento no ve ningún participante', async () => {
      // `User.department` es nullable. Antes de R05 este usuario tenía, en los
      // hechos, alcance provincial: el campo no se consultaba en ninguna query.
      const res = await get('/participants', Role.DELEGADO, {
        department: null,
      }).expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('tampoco lee ninguno por id', async () => {
      await get(`/participants/${P_PILCOMAYO.id}`, Role.DELEGADO, {
        department: null,
      }).expect(404);
    });

    it('ni exporta una sola fila, y el archivo lo dice', async () => {
      const res = await descargar('/reports/participants', Role.DELEGADO, {
        department: null,
      }).expect(200);
      const cuerpo = res.body as Buffer;

      expect(filasDelCsv(cuerpo)).toHaveLength(0);
      expect(alcanceDelCsv(cuerpo)).toContain(
        'sin alcance territorial asignado',
      );
    });

    it('un DELEGADO con el departamento en blanco tampoco', async () => {
      const res = await get('/participants', Role.DELEGADO, {
        department: '   ',
      }).expect(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ===========================================
  // 5. ADMIN_ZONAL: la zona se traduce con `zone_departments`
  // ===========================================
  describe('ADMIN_ZONAL', () => {
    it('con la zona mapeada ve los departamentos de esa zona', async () => {
      const res = await get('/participants', Role.ADMIN_ZONAL, {
        zone: ZONA_MAPEADA,
      }).expect(200);
      const dnis = res.body.items.map((p: { dni: string }) => p.dni);

      expect(dnis).toEqual([P_CAPITAL.dni]);
    });

    it('el participante de otro departamento de la provincia da 404', async () => {
      await get(`/participants/${P_PILCOMAYO.id}`, Role.ADMIN_ZONAL, {
        zone: ZONA_MAPEADA,
      }).expect(404);
    });

    it('con la zona SIN mapear no ve nada (tabla vacía = alcance vacío)', async () => {
      // Es el estado en el que queda el sistema hasta que se cargue la
      // composición real de las zonas de Formosa: preferimos que no vea nada a
      // que vea la provincia entera.
      const res = await get('/participants', Role.ADMIN_ZONAL, {
        zone: ZONA_SIN_MAPEO,
      }).expect(200);

      expect(res.body.items).toHaveLength(0);
    });

    it('sin zona cargada tampoco ve nada', async () => {
      const res = await get('/participants', Role.ADMIN_ZONAL, {
        zone: null,
      }).expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('la zona se compara sin distinguir mayúsculas', async () => {
      const res = await get('/participants', Role.ADMIN_ZONAL, {
        zone: ZONA_MAPEADA.toUpperCase(),
      }).expect(200);
      expect(res.body.items).toHaveLength(1);
    });
  });

  // ===========================================
  // 6. Reportes: el caso literal del hallazgo
  // ===========================================
  describe('exportaciones', () => {
    it('un DELEGADO exporta sólo su departamento, contado contra la base', async () => {
      const res = await descargar('/reports/participants', Role.DELEGADO, {
        department: PILCOMAYO,
      }).expect(200);
      const cuerpo = res.body as Buffer;

      const enLaBase = PARTICIPANTES.filter(
        (p) => p.department === PILCOMAYO,
      ).length;
      const filas = filasDelCsv(cuerpo);

      expect(filas).toHaveLength(enLaBase);
      expect(filas.join('\n')).toContain(P_PILCOMAYO.dni);
      expect(filas.join('\n')).not.toContain(P_CAPITAL.dni);
      expect(filas.join('\n')).not.toContain(P_RAMON_LISTA.dni);
    });

    it('el archivo declara el alcance aplicado en su primera fila', async () => {
      const res = await descargar('/reports/participants', Role.DELEGADO, {
        department: PILCOMAYO,
      }).expect(200);

      expect(alcanceDelCsv(res.body as Buffer)).toBe(
        `"Alcance del reporte: departamentos ${PILCOMAYO}"`,
      );
    });

    it('pedir un departamento ajeno NO da 403: da un reporte vacío', async () => {
      // Decisión de negocio de R05: los reportes se recortan al alcance y lo
      // declaran, nunca fallan por un filtro fuera de alcance. Así el
      // comportamiento es consistente con los listados.
      const res = await descargar(
        `/reports/participants?department=${encodeURIComponent(CAPITAL)}`,
        Role.DELEGADO,
        { department: PILCOMAYO },
      ).expect(200);

      expect(filasDelCsv(res.body as Buffer)).toHaveLength(0);
    });

    it('la exportación de equipos también se recorta', async () => {
      const res = await descargar('/reports/teams', Role.DELEGADO, {
        department: PILCOMAYO,
      }).expect(200);
      const filas = filasDelCsv(res.body as Buffer);

      expect(filas).toHaveLength(1);
      expect(filas[0]).toContain(T_PILCOMAYO.name);
    });

    it('la de inscripciones también', async () => {
      const res = await descargar('/reports/inscriptions', Role.DELEGADO, {
        department: PILCOMAYO,
      }).expect(200);
      const filas = filasDelCsv(res.body as Buffer);

      expect(filas).toHaveLength(1);
      expect(filas[0]).toContain(I_PILCOMAYO.qrCode);
    });

    it('un ADMIN_ZONAL exporta su zona, no la provincia', async () => {
      const res = await descargar('/reports/participants', Role.ADMIN_ZONAL, {
        zone: ZONA_MAPEADA,
      }).expect(200);
      const cuerpo = res.body as Buffer;

      expect(filasDelCsv(cuerpo)).toHaveLength(1);
      expect(alcanceDelCsv(cuerpo)).toBe(
        `"Alcance del reporte: departamentos ${CAPITAL}"`,
      );
    });
  });

  // ===========================================
  // 7. Escrituras: el alta también se acota
  // ===========================================
  describe('altas fuera de alcance', () => {
    it('un DELEGADO no puede crear un participante en otro departamento', async () => {
      // Acá sí 403 y no 404: no se está preguntando por ninguna fila existente,
      // así que no hay nada que ocultar, y el delegado necesita entender por
      // qué no puede cargar al chico.
      const res = await request(app.getHttpServer())
        .post('/participants')
        .set(
          'Authorization',
          `Bearer ${tokenDe(Role.DELEGADO, { department: PILCOMAYO })}`,
        )
        .send({
          dni: '48999999',
          firstName: 'Nuevo',
          lastName: 'Participante',
          birthDate: '2012-01-01',
          sex: 'MASCULINO',
          locality: 'Formosa',
          department: CAPITAL,
        })
        .expect(403);

      expect(res.body.message).toMatch(/fuera de tu alcance territorial/);
    });

    it('un DELEGADO sin departamento no puede crear en ninguno', async () => {
      await request(app.getHttpServer())
        .post('/participants')
        .set(
          'Authorization',
          `Bearer ${tokenDe(Role.DELEGADO, { department: null })}`,
        )
        .send({
          dni: '48999998',
          firstName: 'Nuevo',
          lastName: 'Participante',
          birthDate: '2012-01-01',
          sex: 'MASCULINO',
          locality: 'Clorinda',
          department: PILCOMAYO,
        })
        .expect(403);
    });
  });
});
