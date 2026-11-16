// ===========================================
// GET /localities — catálogo territorial público
// ===========================================
//
// Lo que este spec fija: el endpoint no pide sesión, devuelve los
// departamentos con sus localidades ordenados por nombre, y marca como
// CAPITAL únicamente a la localidad Formosa del departamento Formosa. Gran
// Guardia está en el mismo departamento y tiene que salir como INTERIOR: es
// justo el caso que un "capital = departamento Formosa" habría clasificado mal.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LocalitiesController } from '../src/modules/localities/localities.controller';
import { LocalitiesService } from '../src/modules/localities/localities.service';
import { PrismaService } from '../src/database/prisma.service';

describe('GET /localities (e2e)', () => {
  let app: INestApplication;

  const departamentos = [
    {
      id: 'dep-pirane',
      name: 'Pirané',
      localities: [
        { id: 'loc-pirane', name: 'Pirané' },
        { id: 'loc-colorado', name: 'El Colorado' },
      ],
    },
    {
      id: 'dep-formosa',
      name: 'Formosa',
      localities: [
        { id: 'loc-formosa', name: 'Formosa' },
        { id: 'loc-gran-guardia', name: 'Gran Guardia' },
      ],
    },
  ];

  beforeEach(async () => {
    const prisma = {
      department: {
        findMany: jest.fn((args: { orderBy?: unknown }) => {
          // El doble respeta el orderBy por nombre, como Postgres.
          const ordenados = [...departamentos].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          return Promise.resolve(
            args.orderBy
              ? ordenados.map((d) => ({
                  ...d,
                  localities: [...d.localities].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  ),
                }))
              : ordenados,
          );
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LocalitiesController],
      providers: [
        LocalitiesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('devuelve los departamentos con sus localidades, ordenados por nombre', async () => {
    const res = await request(app.getHttpServer()).get('/localities');

    expect(res.status).toBe(200);
    expect(res.body.map((d: { name: string }) => d.name)).toEqual([
      'Formosa',
      'Pirané',
    ]);
    expect(res.body[1].localities.map((l: { name: string }) => l.name)).toEqual(
      ['El Colorado', 'Pirané'],
    );
  });

  it('sólo la localidad Formosa del departamento Formosa es CAPITAL', async () => {
    const res = await request(app.getHttpServer()).get('/localities');

    const formosa = res.body.find(
      (d: { name: string }) => d.name === 'Formosa',
    );
    const zonas = Object.fromEntries(
      formosa.localities.map((l: { name: string; zona: string }) => [
        l.name,
        l.zona,
      ]),
    );
    expect(zonas).toEqual({ Formosa: 'CAPITAL', 'Gran Guardia': 'INTERIOR' });

    const pirane = res.body.find((d: { name: string }) => d.name === 'Pirané');
    expect(
      pirane.localities.every((l: { zona: string }) => l.zona === 'INTERIOR'),
    ).toBe(true);
  });

  it('no expone ningún dato personal: sólo id, nombre y zona', async () => {
    const res = await request(app.getHttpServer()).get('/localities');

    for (const d of res.body) {
      expect(Object.keys(d).sort()).toEqual(['id', 'localities', 'name']);
      for (const l of d.localities) {
        expect(Object.keys(l).sort()).toEqual(['id', 'name', 'zona']);
      }
    }
  });
});
