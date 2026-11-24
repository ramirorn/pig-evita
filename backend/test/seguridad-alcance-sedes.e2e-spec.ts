// ===========================================
// E2E — Sedes: cada admin territorial gestiona las de su territorio (VULN-08)
//
// Decisión del usuario (odd/tasks/seguridad-owasp-2025.md, S3): un
// ADMIN_DEPARTAMENTAL o ADMIN_ZONAL sólo crea, edita o borra sedes de su
// departamento o zona; ADMIN_PROVINCIAL y SUPER_ADMIN, todas.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { App } from 'supertest/types';
import { VenuesController } from '../src/modules/venues/venues.controller';
import { VenuesService } from '../src/modules/venues/venues.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { Role } from '../src/common/constants';
import { ScopeService } from '../src/common/scope';
import { ACCESS_SIGN_OPTIONS } from './mocks/jwt-test';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};
const EN_FORMOSA = '44444444-4444-4444-8444-444444444441';
const EN_PIRANE = '44444444-4444-4444-8444-444444444442';

interface Sede {
  id: string;
  name: string;
  department: string;
  locality: string;
  isActive: boolean;
  imageKey: null;
}

describe('Sedes — alcance territorial de escritura (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let sedes: Map<string, Sede>;

  const token = (role: Role, department?: string) =>
    jwt.sign({
      sub: `user-${role}`,
      email: `${role}@t.test`,
      role,
      ...(department && { department }),
      type: 'access',
    });

  beforeEach(async () => {
    sedes = new Map(
      [
        { id: EN_FORMOSA, department: 'Formosa', locality: 'Formosa' },
        { id: EN_PIRANE, department: 'Pirané', locality: 'Pirané' },
      ].map((s) => [
        s.id,
        { ...s, name: `Sede ${s.department}`, isActive: true, imageKey: null },
      ]),
    );

    const prisma = {
      venue: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          const s = sedes.get(where.id);
          return Promise.resolve(s ? { ...s, _count: { matches: 0 } } : null);
        }),
        create: jest.fn(({ data }: { data: Omit<Sede, 'id'> }) =>
          Promise.resolve({ ...data, id: 'nueva', imageKey: null }),
        ),
        update: jest.fn(
          ({ where, data }: { where: { id: string }; data: Partial<Sede> }) => {
            Object.assign(sedes.get(where.id)!, data);
            return Promise.resolve(sedes.get(where.id));
          },
        ),
        delete: jest.fn(({ where }: { where: { id: string } }) => {
          const s = sedes.get(where.id);
          sedes.delete(where.id);
          return Promise.resolve(s);
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: ACCESS_SECRET,
          signOptions: ACCESS_SIGN_OPTIONS,
        }),
      ],
      controllers: [VenuesController],
      providers: [
        VenuesService,
        ScopeService,
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => CONFIG[k]) },
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
      }),
    );
    await app.init();
    jwt = moduleFixture.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const alta = (department: string) => ({
    name: 'Polideportivo nuevo',
    department,
    locality: department,
    address: 'Calle 123',
  });

  it('ADMIN_DEPARTAMENTAL da de alta una sede de su departamento', async () => {
    await http()
      .post('/venues')
      .set(
        'Authorization',
        `Bearer ${token(Role.ADMIN_DEPARTAMENTAL, 'Formosa')}`,
      )
      .send(alta('Formosa'))
      .expect(201);
  });

  it('pero no una de otro departamento (403)', async () => {
    await http()
      .post('/venues')
      .set(
        'Authorization',
        `Bearer ${token(Role.ADMIN_DEPARTAMENTAL, 'Formosa')}`,
      )
      .send(alta('Pirané'))
      .expect(403);
  });

  it('no edita ni borra una sede de otro departamento, ni la muda a otro', async () => {
    const t = token(Role.ADMIN_DEPARTAMENTAL, 'Formosa');
    await http()
      .patch(`/venues/${EN_PIRANE}`)
      .set('Authorization', `Bearer ${t}`)
      .send({ name: 'Ajena' })
      .expect(403);
    await http()
      .delete(`/venues/${EN_PIRANE}`)
      .set('Authorization', `Bearer ${t}`)
      .expect(403);
    await http()
      .patch(`/venues/${EN_FORMOSA}`)
      .set('Authorization', `Bearer ${t}`)
      .send({ department: 'Pirané' })
      .expect(403);
    expect(sedes.get(EN_PIRANE)!.name).toBe('Sede Pirané');
    expect(sedes.get(EN_FORMOSA)!.department).toBe('Formosa');
  });

  it('edita una sede propia', async () => {
    await http()
      .patch(`/venues/${EN_FORMOSA}`)
      .set(
        'Authorization',
        `Bearer ${token(Role.ADMIN_DEPARTAMENTAL, 'Formosa')}`,
      )
      .send({ name: 'Renombrada' })
      .expect(200);
    expect(sedes.get(EN_FORMOSA)!.name).toBe('Renombrada');
  });

  it('comportamiento previo: ADMIN_PROVINCIAL gestiona sedes de cualquier departamento', async () => {
    const t = token(Role.ADMIN_PROVINCIAL);
    await http()
      .post('/venues')
      .set('Authorization', `Bearer ${t}`)
      .send(alta('Pirané'))
      .expect(201);
    await http()
      .patch(`/venues/${EN_PIRANE}`)
      .set('Authorization', `Bearer ${t}`)
      .send({ name: 'Provincial' })
      .expect(200);
  });

  it('una sede inexistente sigue respondiendo 404', async () => {
    await http()
      .patch('/venues/99999999-9999-4999-8999-999999999999')
      .set(
        'Authorization',
        `Bearer ${token(Role.ADMIN_DEPARTAMENTAL, 'Formosa')}`,
      )
      .send({ name: 'x' })
      .expect(404);
  });
});
