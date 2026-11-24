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
import { ScopeService } from '../src/common/scope';

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
        // R05 — los services acotados por territorio inyectan ScopeService.
        ScopeService,
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

  it('devuelve nombre, inicial del apellido, disciplina, categoría y estado', async () => {
    findUnique.mockResolvedValue(FULL_DB_ROW);

    const res = await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    expect(res.body).toEqual({
      qrCode: 'EVITA-A1B2C3D4',
      status: 'APROBADA',
      createdAt: '2026-03-01T12:00:00.000Z',
      participant: { firstName: 'Juan', lastInitial: 'P.' },
      category: { name: 'Sub-14', discipline: { name: 'Fútbol' } },
    });
  });

  // VULN-32 — el código es la única llave de un endpoint sin token: quien lo
  // adivina (o lo lee en una credencial impresa) no se lleva el apellido
  // completo de un menor. La inicial alcanza para que la familia reconozca el
  // trámite.
  it('no devuelve el apellido completo del participante', async () => {
    findUnique.mockResolvedValue(FULL_DB_ROW);

    const res = await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain('Pérez');
    expect(res.body.participant).not.toHaveProperty('lastName');
  });

  it('la inicial sale del primer apellido, en mayúscula', async () => {
    findUnique.mockResolvedValue({
      ...FULL_DB_ROW,
      participant: { ...FULL_DB_ROW.participant, lastName: '  de la Fuente' },
    });

    const res = await request(app.getHttpServer())
      .get('/inscriptions/qr/EVITA-A1B2C3D4')
      .expect(200);

    expect(res.body.participant).toEqual({
      firstName: 'Juan',
      lastInitial: 'D.',
    });
  });

  // VULN-32 — los códigos nuevos son largos, los impresos siguen siendo de 8
  // caracteres: la búsqueda es exacta por el código, sin asumir un formato.
  it.each([
    ['impreso antes del cambio', 'EVITA-A1B2C3D4'],
    ['generado con 130 bits', 'EVITA-0123456789ABCDEFGHJKMNPQ'],
  ])('busca el código %s tal cual llega', async (_etiqueta, codigo) => {
    findUnique.mockResolvedValue({ ...FULL_DB_ROW, qrCode: codigo });

    const res = await request(app.getHttpServer())
      .get(`/inscriptions/qr/${codigo}`)
      .expect(200);

    expect(res.body.qrCode).toBe(codigo);
    const [args] = findUnique.mock.calls[0] as [Record<string, any>];
    expect(args.where).toEqual({ qrCode: codigo });
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
