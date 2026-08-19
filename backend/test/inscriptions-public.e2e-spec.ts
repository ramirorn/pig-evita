// ===========================================
// E2E — Endpoint público GET /inscriptions/qr/:qrCode
// Regresión C-01: la respuesta pública no debe exponer PII.
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { PrismaService } from '../src/database/prisma.service';

/** Campos de PII que jamás pueden salir por el endpoint público. */
const FORBIDDEN_FIELDS = [
  'dni',
  'email',
  'phone',
  'birthDate',
  'address',
] as const;

/**
 * Registro "gordo" que devolvería Prisma si alguien borrara el `select`.
 * Sirve para verificar que el mapeo explícito del service también filtra.
 */
const FULL_DB_ROW = {
  id: 'insc-1',
  qrCode: 'EVITA-A1B2C3D4',
  status: 'APROBADA',
  createdAt: new Date('2026-03-01T12:00:00.000Z'),
  notes: 'Nota interna del revisor',
  rejectionNote: null,
  participant: {
    id: 'part-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    email: 'juan.perez@example.com',
    phone: '3704123456',
    birthDate: new Date('2010-05-15T00:00:00.000Z'),
    address: 'Av. Siempre Viva 742',
    locality: 'Formosa',
    department: 'Formosa',
  },
  category: {
    id: 'cat-1',
    name: 'Sub-14',
    minAge: 12,
    maxAge: 14,
    discipline: { id: 'disc-1', name: 'Fútbol', rules: '<p>Reglas</p>' },
  },
};

describe('Inscriptions público — GET /inscriptions/qr/:qrCode (e2e)', () => {
  let app: INestApplication<App>;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InscriptionsController],
      providers: [
        InscriptionsService,
        {
          provide: PrismaService,
          useValue: { inscription: { findUnique } },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('devuelve nombre, apellido, disciplina, categoría y estado', async () => {
    findUnique.mockResolvedValue(FULL_DB_ROW);

    const res = await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    expect(res.body).toEqual({
      qrCode: 'EVITA-A1B2C3D4',
      status: 'APROBADA',
      createdAt: '2026-03-01T12:00:00.000Z',
      participant: { firstName: 'Juan', lastName: 'Pérez' },
      category: { name: 'Sub-14', discipline: { name: 'Fútbol' } },
    });
  });

  it('no expone PII aunque la fila de la DB la contenga', async () => {
    findUnique.mockResolvedValue(FULL_DB_ROW);

    const res = await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    const raw = JSON.stringify(res.body);

    for (const field of FORBIDDEN_FIELDS) {
      expect(raw).not.toContain(`"${field}"`);
    }

    // Y tampoco los valores, por si cambiara el nombre de la propiedad.
    expect(raw).not.toContain('12345678');
    expect(raw).not.toContain('juan.perez@example.com');
    expect(raw).not.toContain('3704123456');
    expect(raw).not.toContain('2010-05-15');
    expect(raw).not.toContain('Siempre Viva');

    // Notas internas del back-office tampoco viajan al público.
    expect(raw).not.toContain('Nota interna');
  });

  it('pide a Prisma solamente los campos permitidos', async () => {
    findUnique.mockResolvedValue(FULL_DB_ROW);

    await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    const [args] = findUnique.mock.calls[0] as [Record<string, any>];

    expect(args.include).toBeUndefined();
    expect(Object.keys(args.select.participant.select).sort()).toEqual([
      'firstName',
      'lastName',
    ]);
    expect(JSON.stringify(args.select)).not.toContain('dni');
  });

  it('devuelve 404 si el código QR no existe', async () => {
    findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-NOEXISTE')
      .expect(404);
  });
});
