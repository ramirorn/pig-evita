// ===========================================
// E2E — Límite del body y errores sin detalle interno (F-22, F-01)
// ===========================================
//
// F-22: un body JSON mayor al límite de `body-parser` respondía 500 "request
// entity too large": el error de la librería no es una `HttpException` y el
// filtro global lo trataba como un fallo inesperado. Ahora es un 413.
//
// F-01 (segunda mitad): el mensaje crudo de una excepción no controlada (por
// ejemplo, la invocación de Prisma con rutas de `dist/`) salía en el 500 en
// cualquier entorno que no fuera producción.
import { Test, TestingModule } from '@nestjs/testing';
import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { GlobalExceptionFilter } from '../src/common/filters';
import { BODY_LIMIT, setupBodyParsers } from '../src/security';

@Controller()
class EcoController {
  @Post('eco')
  eco(@Body() body: { content?: string }) {
    return { largo: body.content?.length ?? 0 };
  }

  @Get('explota')
  explota() {
    throw new Error(
      'Invalid `prisma.inscription.findMany()` invocation in /app/dist/modules/inscriptions/inscriptions.service.js:190',
    );
  }
}

describe('Límite del body y respuestas de error (e2e)', () => {
  let app: NestExpressApplication;
  const entornoOriginal = process.env.NODE_ENV;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EcoController],
    }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    setupBodyParsers(app);
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = entornoOriginal;
    await app?.close();
  });

  it('el límite es explícito (1 MB)', () => {
    expect(BODY_LIMIT).toBe('1mb');
  });

  it('F-22: un body más grande que el límite → 413 con el formato de error de la API', async () => {
    const res = await request(app.getHttpServer())
      .post('/eco')
      .send({ content: 'a'.repeat(3 * 1024 * 1024) })
      .expect(413);
    expect(res.body).toMatchObject({ success: false, statusCode: 413 });
    expect(JSON.stringify(res.body)).not.toMatch(/request entity too large/i);
  });

  it('un body de 500 KB (por encima del viejo default de 100 KB) se acepta', async () => {
    const res = await request(app.getHttpServer())
      .post('/eco')
      .send({ content: 'a'.repeat(500 * 1024) })
      .expect(201);
    expect(res.body.largo).toBe(500 * 1024);
  });

  it('un JSON mal formado sigue siendo 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/eco')
      .set('content-type', 'application/json')
      .send('{no-json')
      .expect(400);
    expect(res.body).toMatchObject({ success: false, statusCode: 400 });
  });

  it('F-01: un 500 no devuelve el mensaje crudo ni en desarrollo', async () => {
    process.env.NODE_ENV = 'development';
    const res = await request(app.getHttpServer()).get('/explota').expect(500);
    expect(res.body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|\/app\/dist/i);
  });
});
