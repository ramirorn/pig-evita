// ===========================================
// E2E — Validación de revisiones y filtros (F-01, F-06, F-07, F-08, O-7)
// ===========================================
//
// Controlador mínimo con los DTOs REALES y la misma configuración del
// ValidationPipe global: se mide el contrato del request sin Postgres.
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  INestApplication,
  Patch,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import {
  InscriptionFilterDto,
  RejectInscriptionDto,
} from '../src/modules/inscriptions/dto';
import { ReviewDocumentDto } from '../src/modules/documents/dto';
import { DocumentsService } from '../src/modules/documents/documents.service';
import type { PrismaService } from '../src/database/prisma.service';
import type { MinioService } from '../src/modules/documents/minio.service';
import type { ScopeService } from '../src/common/scope';
import type { Alcance } from '../src/common/scope';

@Controller()
class StubController {
  @Get('inscriptions')
  listar(@Query() q: InscriptionFilterDto) {
    return { status: q.status ?? null };
  }

  @Patch('inscriptions/reject')
  rechazar(@Body() dto: RejectInscriptionDto) {
    return dto;
  }

  @Patch('documents/review')
  revisar(@Body() dto: ReviewDocumentDto) {
    return dto;
  }
}

describe('Validación de revisiones y filtros (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StubController],
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

  const http = () => request(app.getHttpServer());

  describe('F-01 — filtro de estado de inscripciones', () => {
    it('un estado inexistente → 400 sin detalle de Prisma', async () => {
      const res = await http().get('/inscriptions?status=XX').expect(400);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma/i);
    });

    it('un estado válido pasa', async () => {
      const res = await http().get('/inscriptions?status=APROBADA').expect(200);
      expect(res.body.status).toBe('APROBADA');
    });
  });

  describe('F-06 — motivo de rechazo de inscripción', () => {
    it('sólo espacios → 400', async () => {
      await http()
        .patch('/inscriptions/reject')
        .send({ rejectionNote: '   ' })
        .expect(400);
    });

    it('un motivo real se acepta, recortado', async () => {
      const res = await http()
        .patch('/inscriptions/reject')
        .send({ rejectionNote: '  Falta certificado  ' })
        .expect(200);
      expect(res.body.rejectionNote).toBe('Falta certificado');
    });
  });

  describe('F-08 — estados de la revisión de documentos', () => {
    it('PENDIENTE → 400', async () => {
      await http()
        .patch('/documents/review')
        .send({ status: 'PENDIENTE' })
        .expect(400);
    });

    it.each(['APROBADO', 'RECHAZADO'])('%s se acepta', async (status) => {
      await http()
        .patch('/documents/review')
        .send({ status, notes: 'x' })
        .expect(200);
    });
  });
});

describe('DocumentsService (F-07, O-7)', () => {
  const ALCANCE = {} as Alcance;
  const DOC = {
    id: 'd1',
    participantId: 'p1',
    fileKey: 'participants/p1/dni.pdf',
    status: 'PENDIENTE',
  };

  function armar() {
    const prisma = {
      document: {
        findFirst: jest.fn(() => Promise.resolve(DOC)),
        findMany: jest.fn(() => Promise.resolve([DOC])),
        update: jest.fn(({ data }: { data: object }) =>
          Promise.resolve({ ...DOC, ...data }),
        ),
      },
    };
    const minio = {
      getPresignedUrl: jest.fn(() => Promise.resolve('https://firmada')),
    };
    const scope = { whereDocument: jest.fn(() => ({})) };
    const service = new DocumentsService(
      prisma as unknown as PrismaService,
      minio as unknown as MinioService,
      scope as unknown as ScopeService,
    );
    return { service, prisma };
  }

  it('F-07: rechazar con observaciones sólo de espacios → 400 y no se guarda', async () => {
    const { service, prisma } = armar();
    await expect(
      service.review(
        'd1',
        'u1',
        { status: 'RECHAZADO', notes: '   ' },
        ALCANCE,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('F-07: rechazar con observaciones reales guarda el motivo', async () => {
    const { service, prisma } = armar();
    await service.review(
      'd1',
      'u1',
      { status: 'RECHAZADO', notes: ' Ilegible ' },
      ALCANCE,
    );
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectionNote: 'Ilegible' }),
      }),
    );
  });

  it('O-7: el listado por participante no devuelve fileKey, sí la URL firmada', async () => {
    const { service } = armar();
    const docs = await service.findByParticipant('p1', ALCANCE);
    expect(docs[0]).not.toHaveProperty('fileKey');
    expect(docs[0]).toMatchObject({
      id: 'd1',
      presignedUrl: 'https://firmada',
    });
  });
});
