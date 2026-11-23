// ===========================================
// E2E — Las exportaciones masivas quedan en la auditoría (VULN-26)
// ===========================================
//
// El padrón de participantes sale con DNI, fecha de nacimiento, teléfono y
// domicilio de menores, y lo puede descargar un DELEGADO. Sin una fila en
// `AuditLog`, ante una filtración no hay forma de saber quién lo bajó ni
// cuándo. Se monta el `AuditInterceptor` real como `APP_INTERCEPTOR`, como en
// `app.module.ts`, y se mira qué llega a `prisma.auditLog.create`.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import type { NextFunction, Request, Response } from 'express';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ScopeService } from '../src/common/scope';
import { PrismaService } from '../src/database/prisma.service';

const USUARIO = '77777777-7777-4777-8777-777777777777';
const DISCIPLINA = '11111111-1111-4111-8111-111111111111';
const COMPETENCIA = '22222222-2222-4222-8222-222222222222';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Reportes — auditoría de exportaciones (e2e)', () => {
  let app: INestApplication<App>;
  let auditLogCreate: jest.Mock;
  let falla: boolean;

  beforeEach(async () => {
    falla = false;
    auditLogCreate = jest.fn(() => Promise.resolve({}));
    const escribir = jest.fn((res: Response) => {
      if (falla) return Promise.reject(new Error('la base no respondió'));
      res.end('ok');
      return Promise.resolve();
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        AuditService,
        {
          provide: ReportsService,
          useValue: {
            especificacionParticipants: jest.fn(() => ({})),
            especificacionInscriptions: jest.fn(() => ({})),
            especificacionTeams: jest.fn(() => ({})),
            especificacionResults: jest.fn(() => ({})),
            escribirCsv: escribir,
            escribirExcel: escribir,
          },
        },
        {
          provide: ScopeService,
          useValue: { alcanceDe: jest.fn(() => Promise.resolve({})) },
        },
        {
          provide: PrismaService,
          useValue: { auditLog: { create: auditLogCreate } },
        },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Lo que deja el JwtAuthGuard: quién está pidiendo el reporte.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = {
        sub: USUARIO,
        role: 'DELEGADO',
      };
      next();
    });
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
    await app.close();
  });

  const filas = () =>
    auditLogCreate.mock.calls.map(
      ([arg]) => (arg as { data: Record<string, unknown> }).data,
    );

  it.each([
    ['participants', `?disciplineId=${DISCIPLINA}&format=xlsx`, 'participants'],
    ['inscriptions', `?disciplineId=${DISCIPLINA}`, 'inscriptions'],
    ['teams', `?disciplineId=${DISCIPLINA}`, 'teams'],
    ['results', `?competitionId=${COMPETENCIA}`, 'results'],
  ])(
    'GET /reports/%s deja una fila EXPORT_REPORT con el usuario y los filtros',
    async (ruta, query, entidad) => {
      await request(app.getHttpServer())
        .get(`/reports/${ruta}${query}`)
        .expect(200);
      await flush();

      expect(filas()).toHaveLength(1);
      const [fila] = filas();
      expect(fila).toMatchObject({
        action: 'EXPORT_REPORT',
        entity: entidad,
        userId: USUARIO,
      });
      const filtros = Object.fromEntries(new URLSearchParams(query));
      expect(fila.changes).toEqual(filtros);
    },
  );

  it('una exportación que falla no deja fila (no ocurrió)', async () => {
    falla = true;
    await request(app.getHttpServer()).get('/reports/participants').expect(500);
    await flush();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});
