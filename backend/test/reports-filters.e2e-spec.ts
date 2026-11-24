// ===========================================
// E2E — Los filtros de los reportes se validan (F-20)
// ===========================================
//
// `@Query('disciplineId')` suelto llevaba cualquier string al `where` de Prisma
// y el reporte respondía 500. Con un DTO por endpoint y el ValidationPipe
// global, un filtro inválido es un 400 que nunca llega al service.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { Response } from 'express';

import { ReportsController } from '../src/modules/reports/reports.controller';
import { ReportsService } from '../src/modules/reports/reports.service';
import { ScopeService } from '../src/common/scope';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('Reportes — validación de filtros (F-20)', () => {
  let app: INestApplication<App>;
  let servicio: Record<string, jest.Mock>;

  beforeEach(async () => {
    const escribir = jest.fn((res: Response) => {
      res.end('ok');
      return Promise.resolve();
    });
    servicio = {
      especificacionParticipants: jest.fn(() => ({})),
      especificacionInscriptions: jest.fn(() => ({})),
      especificacionTeams: jest.fn(() => ({})),
      especificacionResults: jest.fn(() => ({})),
      escribirCsv: escribir,
      escribirExcel: escribir,
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: servicio },
        {
          provide: ScopeService,
          useValue: { alcanceDe: jest.fn(() => Promise.resolve({})) },
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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (url: string) => request(app.getHttpServer()).get(url);

  it.each([
    '/reports/participants?disciplineId=zz',
    '/reports/participants?categoryId=zz',
    '/reports/participants?sex=X',
    '/reports/participants?format=pdf',
    '/reports/inscriptions?status=XX',
    '/reports/inscriptions?disciplineId=zz',
    '/reports/teams?categoryId=zz',
    '/reports/results?competitionId=zz',
    '/reports/results?from=ayer',
  ])('%s → 400 y no llega al service', async (url) => {
    await get(url).expect(400);
    expect(servicio.especificacionParticipants).not.toHaveBeenCalled();
    expect(servicio.especificacionInscriptions).not.toHaveBeenCalled();
    expect(servicio.especificacionTeams).not.toHaveBeenCalled();
    expect(servicio.especificacionResults).not.toHaveBeenCalled();
  });

  it('los filtros válidos llegan al service tal cual', async () => {
    await get(
      `/reports/participants?disciplineId=${UUID}&categoryId=${UUID}&locality=Clorinda&department=Pilcomayo&format=xlsx`,
    ).expect(200);
    expect(servicio.especificacionParticipants).toHaveBeenCalledWith(
      {},
      {
        disciplineId: UUID,
        categoryId: UUID,
        locality: 'Clorinda',
        department: 'Pilcomayo',
      },
    );
    expect(servicio.escribirExcel).toHaveBeenCalled();
  });

  it('inscripciones con estado válido y formato csv por defecto', async () => {
    await get(
      `/reports/inscriptions?status=APROBADA&categoryId=${UUID}`,
    ).expect(200);
    expect(servicio.especificacionInscriptions).toHaveBeenCalledWith(
      {},
      undefined,
      UUID,
      'APROBADA',
    );
  });

  it('`format=excel` se sigue aceptando como sinónimo de xlsx', async () => {
    await get('/reports/teams?format=excel').expect(200);
    await get(`/reports/results?competitionId=${UUID}`).expect(200);
    expect(servicio.especificacionResults).toHaveBeenCalledWith({}, UUID);
  });
});
