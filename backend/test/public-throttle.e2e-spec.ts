// ===========================================
// E2E — Rate limiting de endpoints públicos (T05 / A-01)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { DisciplinesController } from '../src/modules/disciplines/disciplines.controller';
import { DisciplinesService } from '../src/modules/disciplines/disciplines.service';
import { PUBLIC_READ_RATE_LIMIT } from '../src/common/decorators';

/** Límite global del proyecto, el que aplica a todo lo no decorado. */
const LIMITE_GLOBAL = 100;
const RAFAGA = 30;

describe('Rate limiting de endpoints públicos (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: LIMITE_GLOBAL }]),
      ],
      controllers: [DisciplinesController],
      providers: [
        {
          provide: DisciplinesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
            findOne: jest.fn().mockResolvedValue({ id: 'd1' }),
            create: jest.fn().mockResolvedValue({ id: 'd1' }),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  /** Dispara N requests seguidas y devuelve la lista de códigos de estado. */
  async function rafaga(
    metodo: 'get' | 'post',
    ruta: string,
    veces: number,
  ): Promise<number[]> {
    const codigos: number[] = [];
    for (let i = 0; i < veces; i++) {
      const res = await request(app.getHttpServer())[metodo](ruta).send();
      codigos.push(res.status);
    }
    return codigos;
  }

  it('el cupo público es de 20 por minuto', () => {
    expect(PUBLIC_READ_RATE_LIMIT).toEqual({ limit: 20, ttl: 60_000 });
  });

  it('30 requests seguidas al listado público reciben 429 a partir de la #21', async () => {
    const codigos = await rafaga('get', '/disciplines', RAFAGA);

    const primerRechazo = codigos.indexOf(429) + 1; // 1-based
    console.log(
      `       ${codigos.filter((c) => c === 200).length} OK y ${codigos.filter((c) => c === 429).length} rechazadas; primer 429 en la #${primerRechazo}`,
    );

    expect(codigos.slice(0, 20).every((c) => c === 200)).toBe(true);
    expect(primerRechazo).toBe(21);
    expect(codigos.slice(20).every((c) => c === 429)).toBe(true);
  });

  it('el detalle público también está limitado', async () => {
    const codigos = await rafaga(
      'get',
      '/disciplines/11111111-1111-4111-8111-111111111111',
      25,
    );

    expect(codigos.filter((c) => c === 429).length).toBe(5);
  });

  it('cada endpoint lleva su propio contador', async () => {
    // Agotar el cupo del listado no debe dejar sin servicio al detalle.
    await rafaga('get', '/disciplines', 21);
    const codigos = await rafaga(
      'get',
      '/disciplines/11111111-1111-4111-8111-111111111111',
      3,
    );

    expect(codigos.every((c) => c === 200)).toBe(true);
  });

  it('los endpoints no decorados conservan el límite global', async () => {
    // `POST /disciplines` es una operación de back-office: 30 requests seguidas
    // están muy lejos del cupo global de 100/min y deben pasar todas.
    const codigos = await rafaga('post', '/disciplines', RAFAGA);

    expect(codigos.some((c) => c === 429)).toBe(false);
  });
});
