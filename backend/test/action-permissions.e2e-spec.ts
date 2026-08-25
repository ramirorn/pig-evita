// ===========================================
// E2E — Permisos por acción, matriz rol × acción (R22)
// ===========================================
//
// El bug: las rutas del frontend usaban grupos más anchos que los endpoints. La
// pantalla de Participantes exigía `PARTICIPANT_MANAGERS`, y adentro el `POST`
// excluía a `COORDINADOR` y el `PATCH` excluía además a `ADMIN_ZONAL`. Un
// ADMIN_ZONAL veía "Editar", abría el diálogo, corregía un domicilio, guardaba,
// y recibía "Error al actualizar el participante" sin que nada le dijera que
// jamás iba a poder.
//
// El arreglo estructural es `ACCIONES` (common/constants): los controllers
// declaran `@Roles(...ACCIONES.X)` y el frontend espeja ese mismo mapa. Este
// spec fija las dos mitades del contrato:
//
//   1. **Nadie declara roles inline.** Cada handler con `@Roles(...)` tiene que
//      llevar, por identidad de referencia, una entrada de `ACCIONES`. Un
//      `@Roles(Role.X, Role.Y)` escrito a mano vuelve a partir la verdad en dos
//      y acá se ve.
//   2. **La matriz se cumple contra HTTP de verdad**: para cada rol y cada
//      acción, el endpoint responde 403 exactamente cuando `puedeAccion` dice
//      que no. Ni un botón visible que dé 403, ni una acción permitida oculta.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
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
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { CompetitionsController } from '../src/modules/competitions/competitions.controller';
import { NewsController } from '../src/modules/news/news.controller';
import { CalendarController } from '../src/modules/calendar/calendar.controller';
import { VenuesController } from '../src/modules/venues/venues.controller';
import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { CategoriesController } from '../src/modules/categories/categories.controller';
import { ResultsController } from '../src/modules/results/results.controller';
import { AuditController } from '../src/modules/audit/audit.controller';
import { ZonesController } from '../src/modules/zones/zones.controller';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { ZonesService } from '../src/modules/zones/zones.service';

import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { ScopeService } from '../src/common/scope';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { MinioService } from '../src/modules/documents/minio.service';
import { FileSignaturePipe } from '../src/modules/documents/file-signature.pipe';
import {
  ACCIONES,
  ROLES_KEY,
  Role,
  puedeAccion,
  type AccionProtegida,
} from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const TODOS_LOS_ROLES = Object.values(Role);

const CONTROLLERS = [
  ParticipantsController,
  TeamsController,
  InscriptionsController,
  DocumentsController,
  ReportsController,
  UsersController,
  CompetitionsController,
  NewsController,
  CalendarController,
  VenuesController,
  DisciplinesController,
  CategoriesController,
  ResultsController,
  AuditController,
  ZonesController,
  DashboardController,
];

/**
 * Las listas de `ACCIONES`, normalizadas.
 *
 * La comparación es por **valor** y no por identidad porque `@Roles(...X)`
 * esparce la lista y construye un array nuevo: la referencia original nunca
 * llega a la metadata. Alcanza igual para lo que se quiere fijar —que el
 * conjunto de roles de cada handler sea exactamente uno de los publicados—: una
 * lista inline que no corresponda a ninguna acción no matchea.
 */
const clave = (roles: unknown) =>
  JSON.stringify([...(roles as string[])].sort());

const LISTAS_DE_ACCIONES = new Set<string>(
  Object.values(ACCIONES).map((lista) => clave(lista)),
);

describe('Permisos por acción (R22)', () => {
  // ===========================================
  // 1. Ningún `@Roles(...)` inline
  // ===========================================
  describe('los controllers no declaran roles inline', () => {
    const reflector = new Reflector();

    /** Todos los handlers con `@Roles(...)` de todos los controllers migrados. */
    const handlers: Array<[string, string, unknown]> = [];

    for (const controller of CONTROLLERS) {
      const proto = controller.prototype as unknown as Record<string, unknown>;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor') continue;
        const metodo = proto[nombre];
        if (typeof metodo !== 'function') continue;
        const roles = reflector.get(ROLES_KEY, metodo);
        if (roles) handlers.push([controller.name, nombre, roles]);
      }
    }

    it('encuentra handlers con @Roles (red de seguridad del propio barrido)', () => {
      // Si el barrido dejara de encontrar handlers —por un cambio de decorador
      // o de metadata—, los `it.each` de abajo pasarían vacíos y este spec
      // quedaría midiendo nada.
      expect(handlers.length).toBeGreaterThan(30);
    });

    it.each(handlers)(
      '%s.%s usa una lista de ACCIONES, no una inline',
      (_controller, _handler, roles) => {
        expect(LISTAS_DE_ACCIONES.has(clave(roles))).toBe(true);
      },
    );
  });

  // ===========================================
  // 2. La matriz, contra HTTP
  // ===========================================
  describe('matriz rol × acción', () => {
    let app: INestApplication<App>;
    let jwt: JwtService;

    /** Endpoint representativo de cada acción con botón en el panel. */
    const CASOS: Array<{
      accion: AccionProtegida;
      metodo: 'get' | 'post' | 'patch' | 'delete';
      url: string;
      body?: Record<string, unknown>;
    }> = [
      { accion: 'PARTICIPANT_READ', metodo: 'get', url: '/participants' },
      {
        accion: 'PARTICIPANT_CREATE',
        metodo: 'post',
        url: '/participants',
        body: {
          dni: '48123456',
          firstName: 'Ana',
          lastName: 'Gómez',
          birthDate: '2012-01-01',
          sex: 'FEMENINO',
          locality: 'Clorinda',
          department: 'Pilcomayo',
        },
      },
      {
        accion: 'PARTICIPANT_UPDATE',
        metodo: 'patch',
        url: '/participants/11111111-1111-4111-8111-111111111111',
        body: { phone: '3704000000' },
      },
      { accion: 'TEAM_READ', metodo: 'get', url: '/teams' },
      {
        accion: 'TEAM_UPDATE',
        metodo: 'patch',
        url: '/teams/11111111-1111-4111-8111-111111111111',
        body: { name: 'Nuevo nombre' },
      },
      {
        accion: 'TEAM_DELETE',
        metodo: 'delete',
        url: '/teams/11111111-1111-4111-8111-111111111111',
      },
      {
        accion: 'TEAM_MEMBER_MANAGE',
        metodo: 'delete',
        url: '/teams/11111111-1111-4111-8111-111111111111/members/22222222-2222-4222-8222-222222222222',
      },
      { accion: 'INSCRIPTION_READ', metodo: 'get', url: '/inscriptions' },
      {
        accion: 'INSCRIPTION_APPROVE',
        metodo: 'patch',
        url: '/inscriptions/11111111-1111-4111-8111-111111111111/approve',
      },
      {
        accion: 'INSCRIPTION_REJECT',
        metodo: 'patch',
        url: '/inscriptions/11111111-1111-4111-8111-111111111111/reject',
        body: { rejectionNote: 'Faltan documentos' },
      },
      {
        accion: 'DOCUMENT_READ',
        metodo: 'get',
        url: '/documents/participant/11111111-1111-4111-8111-111111111111',
      },
      {
        accion: 'DOCUMENT_REVIEW',
        metodo: 'patch',
        url: '/documents/11111111-1111-4111-8111-111111111111/review',
        body: { status: 'APROBADO' },
      },
      { accion: 'REPORT_EXPORT', metodo: 'get', url: '/reports/participants' },
      { accion: 'USER_READ', metodo: 'get', url: '/users' },
      {
        accion: 'USER_MANAGE',
        metodo: 'delete',
        url: '/users/11111111-1111-4111-8111-111111111111',
      },
      { accion: 'AUDIT_READ', metodo: 'get', url: '/audit' },
      { accion: 'ZONE_READ', metodo: 'get', url: '/zones' },
    ];

    beforeAll(async () => {
      /** Todo devuelve algo inocuo: acá se mide el permiso, no el negocio. */
      const cualquierCosa = () =>
        ({
          items: [],
          data: [],
          meta: {},
        }) as unknown;

      const servicioMudo = new Proxy(
        {},
        {
          get: (_destino, prop) => {
            // `then` NO se puede interceptar: un objeto con `then` es
            // *thenable*, así que `await app.init()` intentaría resolverlo y el
            // arranque queda colgado (5s de timeout en el `beforeAll`). Lo mismo
            // con los símbolos internos que Nest y Jest inspeccionan.
            if (prop === 'then' || typeof prop === 'symbol') return undefined;
            return jest.fn(() => Promise.resolve(cualquierCosa()));
          },
        },
      );

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
          UsersController,
          AuditController,
          ZonesController,
        ],
        providers: [
          JwtStrategy,
          FileSignaturePipe,
          { provide: ParticipantsService, useValue: servicioMudo },
          { provide: TeamsService, useValue: servicioMudo },
          { provide: InscriptionsService, useValue: servicioMudo },
          { provide: DocumentsService, useValue: servicioMudo },
          { provide: UsersService, useValue: servicioMudo },
          { provide: ZonesService, useValue: servicioMudo },
          { provide: AuditService, useValue: servicioMudo },
          { provide: MinioService, useValue: servicioMudo },
          { provide: PrismaService, useValue: servicioMudo },
          {
            provide: ReportsService,
            useValue: {
              // El controller escribe el reporte al `res`: hay que terminar la
              // respuesta o el request queda colgado.
              especificacionParticipants: jest.fn(() => ({})),
              escribirCsv: jest.fn((destino: { end: () => void }) => {
                destino.end();
                return Promise.resolve();
              }),
              escribirExcel: jest.fn((destino: { end: () => void }) => {
                destino.end();
                return Promise.resolve();
              }),
            },
          },
          {
            provide: ScopeService,
            useValue: {
              alcanceDe: jest.fn(() => Promise.resolve({ tipo: 'PROVINCIAL' })),
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

    afterAll(async () => {
      await app.close();
    });

    const tokenDe = (role: Role) =>
      jwt.sign({
        sub: '99999999-9999-4999-8999-999999999999',
        email: `${role.toLowerCase()}@juegosevita.gob.ar`,
        role,
        // Provincial: acá se mide el permiso por acción, no el alcance
        // territorial (eso lo cubre `territorial-scope.e2e-spec.ts`).
        department: null,
        zone: null,
        type: 'access',
      });

    const combinaciones = CASOS.flatMap((caso) =>
      TODOS_LOS_ROLES.map((role) => [role, caso.accion, caso] as const),
    );

    it.each(combinaciones)(
      '%s sobre %s coincide con la matriz publicada',
      async (role, accion, caso) => {
        const permitido = puedeAccion(role, accion);

        const res = await request(app.getHttpServer())
          [caso.metodo](caso.url)
          .set('Authorization', `Bearer ${tokenDe(role)}`)
          .send(caso.body ?? {});

        if (permitido) {
          // Lo único que importa es que el permiso no lo corte. El negocio (400,
          // 404) queda fuera del alcance de este spec.
          expect(res.status).not.toBe(403);
        } else {
          expect(res.status).toBe(403);
        }
      },
    );
  });

  // ===========================================
  // 3. El endpoint que publica los permisos
  // ===========================================
  describe('accionesDe', () => {
    it('un ADMIN_ZONAL no tiene PARTICIPANT_UPDATE, que es el caso del hallazgo', () => {
      expect(puedeAccion(Role.ADMIN_ZONAL, 'PARTICIPANT_UPDATE')).toBe(false);
      expect(puedeAccion(Role.ADMIN_ZONAL, 'PARTICIPANT_READ')).toBe(true);
    });

    it('un COORDINADOR ve el padrón pero no lo edita ni lo crea', () => {
      expect(puedeAccion(Role.COORDINADOR, 'PARTICIPANT_READ')).toBe(true);
      expect(puedeAccion(Role.COORDINADOR, 'PARTICIPANT_CREATE')).toBe(false);
      expect(puedeAccion(Role.COORDINADOR, 'PARTICIPANT_UPDATE')).toBe(false);
    });

    it('un ADMIN_PROVINCIAL entra a Usuarios pero no los da de alta', () => {
      // Fue el otro botón que devolvía 403: la ruta pedía SYSTEM_MANAGERS y el
      // alta es sólo del SUPER_ADMIN.
      expect(puedeAccion(Role.ADMIN_PROVINCIAL, 'USER_READ')).toBe(true);
      expect(puedeAccion(Role.ADMIN_PROVINCIAL, 'USER_MANAGE')).toBe(false);
    });

    it('sin rol no se puede nada', () => {
      expect(puedeAccion(undefined, 'PARTICIPANT_READ')).toBe(false);
      expect(puedeAccion(null, 'REPORT_EXPORT')).toBe(false);
    });
  });
});
