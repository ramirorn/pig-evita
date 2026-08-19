// ===========================================
// E2E — Reducción de payload por `select` explícito (T21 / Q2, Q9, Q11, Q17)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { PrismaService } from '../src/database/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors';

const FILAS = 50;

/**
 * Fila completa tal como la devolvía el `include` anterior:
 * `participant: true` + `category: { include: { discipline: true } }` +
 * `team: true` trae **todas** las columnas de esas tablas.
 */
function filaCompleta(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    participantId: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    categoryId: '20000000-0000-4000-8000-000000000001',
    teamId: '30000000-0000-4000-8000-000000000001',
    createdById: '40000000-0000-4000-8000-000000000001',
    status: 'PENDIENTE',
    qrCode: `EVITA-${String(i).padStart(8, '0')}`,
    notes:
      'Nota interna del revisor sobre la documentación presentada por el participante.',
    reviewedById: null,
    reviewedAt: null,
    approvedById: null,
    approvedAt: null,
    rejectionNote: null,
    createdAt: new Date('2026-03-01T12:00:00.000Z'),
    updatedAt: new Date('2026-03-02T12:00:00.000Z'),
    participant: {
      id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      dni: `4512${String(i).padStart(4, '0')}`,
      firstName: 'Juan Ignacio',
      lastName: 'Pérez González',
      birthDate: new Date('2010-05-15T00:00:00.000Z'),
      sex: 'MASCULINO',
      phone: '3704123456',
      email: 'juan.perez.gonzalez@example.com',
      locality: 'Clorinda',
      department: 'Pilcomayo',
      address: 'Av. San Martín 1234, Barrio Centro',
      createdAt: new Date('2026-02-01T12:00:00.000Z'),
      updatedAt: new Date('2026-02-01T12:00:00.000Z'),
    },
    category: {
      id: '20000000-0000-4000-8000-000000000001',
      disciplineId: '50000000-0000-4000-8000-000000000001',
      name: 'Sub-14 Masculino',
      sex: 'MASCULINO',
      minAge: 12,
      maxAge: 14,
      isActive: true,
      sortOrder: 1,
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
      discipline: {
        id: '50000000-0000-4000-8000-000000000001',
        name: 'Fútbol 11',
        type: 'EQUIPO',
        resultType: 'GOLES',
        rules:
          'Reglamento oficial de la disciplina, con todas sus aclaraciones sobre duración de los partidos, cantidad de jugadores y criterios de desempate. '.repeat(
            4,
          ),
        minPlayers: 11,
        maxPlayers: 18,
        sortOrder: 1,
        isActive: true,
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        updatedAt: new Date('2026-01-01T12:00:00.000Z'),
      },
    },
    team: {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'Escuela N° 12 - Clorinda',
      disciplineId: '50000000-0000-4000-8000-000000000001',
      categoryId: '20000000-0000-4000-8000-000000000001',
      locality: 'Clorinda',
      department: 'Pilcomayo',
      isActive: true,
      createdAt: new Date('2026-01-15T12:00:00.000Z'),
      updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    },
    createdBy: { id: '4', firstName: 'Ana', lastName: 'Gómez' },
    reviewedBy: null,
    approvedBy: null,
  };
}

/** Aplica un `select` de Prisma (con anidados) sobre una fila. */
function aplicarSelect(fila: any, select: any): any {
  if (fila === null || fila === undefined) return fila;
  if (Array.isArray(fila)) return fila.map((f) => aplicarSelect(f, select));

  const salida: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(select)) {
    if (valor === true) {
      salida[campo] = fila[campo];
    } else if (valor && typeof valor === 'object' && 'select' in valor) {
      salida[campo] = aplicarSelect(fila[campo], (valor as any).select);
    }
  }
  return salida;
}

describe('Payload de GET /inscriptions (e2e)', () => {
  let app: INestApplication<App>;
  let findMany: jest.Mock;

  beforeEach(async () => {
    findMany = jest.fn(({ select }) =>
      Promise.resolve(
        Array.from({ length: FILAS }, (_, i) =>
          aplicarSelect(filaCompleta(i), select),
        ),
      ),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InscriptionsController],
      providers: [
        InscriptionsService,
        {
          provide: PrismaService,
          useValue: {
            inscription: {
              findMany,
              count: jest.fn().mockResolvedValue(FILAS),
            },
          },
        },
        // Mismo wrapper `{ success, data, meta }` que en producción.
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('el select recorta ≥30% respecto del include anterior', async () => {
    const res = await request(app.getHttpServer())
      .get('/inscriptions?limit=50')
      .expect(200);

    // "Antes": las mismas 50 filas completas, que es lo que devolvía el include.
    const antes = JSON.stringify(
      Array.from({ length: FILAS }, (_, i) => filaCompleta(i)),
    ).length;
    const despues = JSON.stringify(res.body).length;
    const reduccion = 1 - despues / antes;

    console.log(
      `       payload de 50 inscripciones: ${antes.toLocaleString()} B -> ${despues.toLocaleString()} B (${(reduccion * 100).toFixed(1)}% menos)`,
    );

    expect(reduccion).toBeGreaterThanOrEqual(0.3);
  });

  it('la lista conserva lo que muestra la tabla admin', async () => {
    const res = await request(app.getHttpServer())
      .get('/inscriptions?limit=50')
      .expect(200);

    const fila = res.body.data[0];
    expect(fila.qrCode).toBeDefined();
    expect(fila.status).toBeDefined();
    expect(fila.createdAt).toBeDefined();
    expect(fila.participant).toEqual({
      id: expect.any(String),
      firstName: 'Juan Ignacio',
      lastName: 'Pérez González',
      dni: expect.any(String),
    });
    expect(fila.category.name).toBe('Sub-14 Masculino');
    expect(fila.category.discipline.name).toBe('Fútbol 11');
    expect(fila.team.name).toBe('Escuela N° 12 - Clorinda');
    expect(fila.createdBy).toEqual({
      id: '4',
      firstName: 'Ana',
      lastName: 'Gómez',
    });
  });

  it('la lista deja fuera los campos pesados que no se muestran', async () => {
    const res = await request(app.getHttpServer())
      .get('/inscriptions?limit=50')
      .expect(200);

    const fila = res.body.data[0];
    // Notas internas y timestamps de revisión: sólo en el detalle.
    expect(fila.notes).toBeUndefined();
    expect(fila.rejectionNote).toBeUndefined();
    // El reglamento completo de la disciplina viajaba en cada fila.
    expect(fila.category.discipline.rules).toBeUndefined();
    // Datos de contacto del participante: sólo en el detalle.
    expect(fila.participant.email).toBeUndefined();
    expect(fila.participant.phone).toBeUndefined();
    expect(fila.participant.address).toBeUndefined();
    expect(fila.participant.birthDate).toBeUndefined();
  });
});
