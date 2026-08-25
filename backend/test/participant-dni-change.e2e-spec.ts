// ===========================================
// E2E — El DNI no lo cambia cualquiera (R17)
// ===========================================
//
// `UpdateParticipantDto extends PartialType(CreateParticipantDto)`, así que
// heredaba `dni`, y el `@Roles(...)` del PATCH incluye a `DELEGADO`. Resultado:
// el delegado que carga las altas del día podía, sobre una inscripción ya
// aprobada, cambiarle el documento al participante. La fila conserva el id, el
// equipo y la categoría; adentro hay otra persona. La auditoría lo registraba
// como un UPDATE más, con el mismo aspecto que corregir un teléfono.
//
// El arreglo: sólo los dos roles provinciales pueden cambiarlo, y cuando lo
// hacen queda una fila de auditoría propia con el valor anterior y el nuevo.
//
// El doble de Prisma guarda el estado: el `dni` que queda en la "tabla" después
// del PATCH es lo que se verifica, no lo que devolvió el mock.
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
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import {
  AuditService,
  type AuditLogInput,
} from '../src/modules/audit/audit.service';
import { sanitizeAuditChanges } from '../src/modules/audit/audit-sanitizer';
import { PrismaService } from '../src/database/prisma.service';
import { AuditAction, Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const ID = '11111111-1111-4111-8111-111111111111';
const DNI_ORIGINAL = '48123456';
const DNI_NUEVO = '40999888';

describe('PATCH /participants/:id — cambio de DNI (R17)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let fila: Record<string, unknown>;
  /** Filas de auditoría, saneadas igual que las guardaría `AuditService`. */
  let auditoria: Array<AuditLogInput & { changes: unknown }>;

  beforeEach(async () => {
    fila = {
      id: ID,
      dni: DNI_ORIGINAL,
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '3704123456',
      locality: 'Clorinda',
      department: 'Pilcomayo',
      inscriptions: [],
      documents: [],
      teamMembers: [],
    };
    auditoria = [];

    const prisma = {
      participant: {
        findUnique: jest.fn(({ where }: { where: { id?: string } }) =>
          Promise.resolve(where.id === ID ? fila : null),
        ),
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          fila = { ...fila, ...data };
          return Promise.resolve(fila);
        }),
      },
    };

    const audit = {
      log: jest.fn((entrada: AuditLogInput) => {
        // Se sanea acá igual que en el service real: así el test mide lo que
        // termina en la tabla, no lo que se le pasó a la función.
        auditoria.push({
          ...entrada,
          changes: sanitizeAuditChanges(entrada.changes),
        });
        return Promise.resolve();
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [ParticipantsController],
      providers: [
        ParticipantsService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
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

  const tokenDe = (role: string) =>
    jwt.sign({
      sub: `usuario-${role}`,
      email: `${role.toLowerCase()}@juegosevita.gob.ar`,
      role,
      type: 'access',
    });

  const patch = (role: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/participants/${ID}`)
      .set('Authorization', `Bearer ${tokenDe(role)}`)
      .send(body);

  // -------------------------------------------------
  // El DoD, primera mitad: el rol operativo no puede
  // -------------------------------------------------
  describe('DELEGADO', () => {
    it('mandar `dni` en el PATCH devuelve 400', async () => {
      const res = await patch(Role.DELEGADO, { dni: DNI_NUEVO }).expect(400);

      expect(res.body.message).toMatch(
        /No tiene permisos para modificar el DNI/,
      );
    });

    it('el DNI no cambió en la base', async () => {
      await patch(Role.DELEGADO, { dni: DNI_NUEVO }).expect(400);

      // Lo que importa: no es que la respuesta diga que no, es que no pasó.
      expect(fila.dni).toBe(DNI_ORIGINAL);
    });

    it('tampoco cambia nada más del mismo PATCH', async () => {
      // Rechazo total, no parcial: si se aplicara el teléfono y se descartara
      // el DNI, el operador vería un 400 y a la vez un cambio hecho.
      await patch(Role.DELEGADO, {
        dni: DNI_NUEVO,
        phone: '3704000000',
      }).expect(400);

      expect(fila.phone).toBe('3704123456');
    });

    it('el rechazo es explícito, no un descarte mudo', async () => {
      // Ignorar el campo en silencio dejaría al delegado convencido de que
      // corrigió el documento. Por eso 400 y no 200.
      const res = await patch(Role.DELEGADO, { dni: DNI_NUEVO });
      expect(res.status).toBe(400);
    });

    it('puede seguir editando el resto de los campos', async () => {
      await patch(Role.DELEGADO, { phone: '3704555555' }).expect(200);
      expect(fila.phone).toBe('3704555555');
    });

    it('reenviar el MISMO dni no rompe la edición', async () => {
      // Los formularios mandan el objeto completo. Cortar acá sería romper la
      // edición de cualquier otro campo para el rol que hace la mayoría de las
      // ediciones.
      await patch(Role.DELEGADO, {
        dni: DNI_ORIGINAL,
        phone: '3704777777',
      }).expect(200);

      expect(fila.phone).toBe('3704777777');
      expect(fila.dni).toBe(DNI_ORIGINAL);
    });
  });

  it.each([Role.ADMIN_DEPARTAMENTAL])(
    '%s tampoco puede cambiar el DNI',
    async (role) => {
      await patch(role, { dni: DNI_NUEVO }).expect(400);
      expect(fila.dni).toBe(DNI_ORIGINAL);
    },
  );

  // -------------------------------------------------
  // El DoD, segunda mitad: el rol habilitado sí, y queda auditado
  // -------------------------------------------------
  describe.each([Role.SUPER_ADMIN, Role.ADMIN_PROVINCIAL])('%s', (role) => {
    it('puede cambiar el DNI', async () => {
      await patch(role, { dni: DNI_NUEVO }).expect(200);
      expect(fila.dni).toBe(DNI_NUEVO);
    });

    it('el cambio queda auditado con el valor anterior y el nuevo', async () => {
      await patch(role, { dni: DNI_NUEVO }).expect(200);

      const entrada = auditoria.find(
        (a) => a.action === AuditAction.DNI_CHANGE,
      );
      expect(entrada).toBeDefined();
      expect(entrada!.entity).toBe('participants');
      expect(entrada!.entityId).toBe(ID);

      const changes = entrada!.changes as {
        anterior: { dni: string };
        nuevo: { dni: string };
      };
      // Enmascarado por el sanitizador de R12 —es PII— pero distinguible: los
      // dos documentos están, y no son el mismo.
      expect(changes.anterior.dni).toBe('******56');
      expect(changes.nuevo.dni).toBe('******88');
      expect(changes.anterior.dni).not.toBe(changes.nuevo.dni);
    });

    it('el DNI no queda en claro en la fila de auditoría', async () => {
      await patch(role, { dni: DNI_NUEVO }).expect(200);

      const serializado = JSON.stringify(auditoria);
      expect(serializado).not.toContain(DNI_ORIGINAL);
      expect(serializado).not.toContain(DNI_NUEVO);
    });

    it('editar otro campo NO genera la fila de cambio de DNI', async () => {
      await patch(role, { phone: '3704222222' }).expect(200);

      expect(
        auditoria.filter((a) => a.action === AuditAction.DNI_CHANGE),
      ).toHaveLength(0);
    });
  });
});
