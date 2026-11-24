// ===========================================
// E2E — Contrato de alta/edición de sedes (F-16, F-37)
// ===========================================
//
// Controlador mínimo con los DTOs REALES de sedes y la misma configuración del
// ValidationPipe global: se valida el contrato del body sin Postgres ni MinIO.
import { Test, TestingModule } from '@nestjs/testing';
import {
  Body,
  Controller,
  INestApplication,
  Patch,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  CreateVenueDto,
  UpdateVenueDto,
} from '../src/modules/venues/dto/venues.dto';

@Controller('venues')
class VenuesStubController {
  @Post()
  create(@Body() dto: CreateVenueDto) {
    return dto;
  }

  @Patch()
  update(@Body() dto: UpdateVenueDto) {
    return dto;
  }
}

const BASE = {
  name: 'Polideportivo',
  address: 'Calle 1',
  locality: 'Formosa',
  department: 'Formosa',
};

describe('Sedes — validación del body (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VenuesStubController],
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

  const alta = (body: object) =>
    request(app.getHttpServer()).post('/venues').send(body);

  it('F-37: el alta acepta `isActive` (lo manda el formulario del panel)', async () => {
    const res = await alta({ ...BASE, isActive: true }).expect(201);
    expect(res.body.isActive).toBe(true);
  });

  it('el alta sin `isActive` sigue funcionando', async () => {
    await alta(BASE).expect(201);
  });

  it('una propiedad desconocida se sigue rechazando', async () => {
    await alta({ ...BASE, isAdmin: true }).expect(400);
  });

  it.each([
    [{ latitude: 999 }],
    [{ latitude: -90.5 }],
    [{ longitude: 999 }],
    [{ longitude: -180.5 }],
  ])('F-16: coordenada fuera de rango %j → 400', async (mal) => {
    await alta({ ...BASE, ...mal }).expect(400);
  });

  it('coordenadas reales de Formosa se aceptan', async () => {
    await alta({ ...BASE, latitude: -26.18, longitude: -58.17 }).expect(201);
  });

  it('F-16: la edición también valida el rango', async () => {
    await request(app.getHttpServer())
      .patch('/venues')
      .send({ latitude: 91 })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/venues')
      .send({ isActive: false })
      .expect(200);
  });
});
