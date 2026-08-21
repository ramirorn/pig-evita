// ===========================================
// E2E — Tope de paginación (T28 / Q24)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ParticipantFilterDto } from '../src/modules/participants/dto/participants.dto';

/**
 * Controlador mínimo con el DTO REAL de participantes: el test no depende de
 * Postgres, MinIO ni de los guards, pero valida exactamente el mismo contrato
 * de query params que expone `GET /participants`.
 */
@Controller('participants')
class ParticipantsStubController {
  @Get()
  findAll(@Query() query: ParticipantFilterDto) {
    return { limit: query.limit, page: query.page };
  }
}

/** Misma configuración del ValidationPipe global que arma `bootstrap()`. */
async function crearApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [ParticipantsStubController],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

describe('Paginación — tope de elementos por página (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rechaza un limit desmedido con 400 (@Max(100))', async () => {
    const res = await request(app.getHttpServer())
      .get('/participants?limit=99999')
      .expect(400);

    // El motivo tiene que ser el tope, no otra cosa.
    expect(JSON.stringify(res.body.message)).toMatch(/limit/);
  });

  it('rechaza limit=0 y limit negativo (@Min(1))', async () => {
    await request(app.getHttpServer()).get('/participants?limit=0').expect(400);
    await request(app.getHttpServer())
      .get('/participants?limit=-5')
      .expect(400);
  });

  it('acepta el tope exacto de 100', async () => {
    const res = await request(app.getHttpServer())
      .get('/participants?limit=100')
      .expect(200);

    expect(res.body.limit).toBe(100);
  });

  it('aplica el default de 20 cuando no se manda limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/participants')
      .expect(200);

    expect(res.body.limit).toBe(20);
  });

  /**
   * `pageSize` NO existe como campo (el nuestro se llama `limit`). Igual da 400,
   * pero por otro motivo: `forbidNonWhitelisted` rechaza cualquier query param
   * desconocido. Se deja explícito para que quede claro que son DOS defensas
   * distintas y que ninguna de las dos permite pedir 99999 filas.
   */
  it('rechaza el parámetro inexistente pageSize por forbidNonWhitelisted', async () => {
    const res = await request(app.getHttpServer())
      .get('/participants?pageSize=99999')
      .expect(400);

    expect(JSON.stringify(res.body.message)).toMatch(/pageSize/);
  });
});
