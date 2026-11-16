// ===========================================
// /metrics — k-anonimato de punta a punta y versión
// ===========================================
//
// Lo que fija este spec: a través de HTTP, con validación de query y todo,
// ningún corte con menos de 5 respuestas sale con un conteo; una celda
// suprimida arrastra el total de su fila; un KPI no publica cociente si
// alguno de sus lados está suprimido; y la versión de la campaña, sin Redis,
// es el conteo de respuestas. El doble de Prisma es en memoria, como en
// `survey-anonimato.e2e-spec.ts`.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MetricsController } from '../src/modules/metrics/metrics.controller';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { PrismaService } from '../src/database/prisma.service';
import { MOTIVO_SUPRESION } from '../src/modules/survey/survey.constants';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Q_LESION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const Q_ESTUDIOS = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LOC_FORMOSA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOC_PIRANE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DEP_FORMOSA = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const DEP_PIRANE = '99999999-9999-4999-8999-999999999999';
const KPI_ID = '12121212-1212-4121-8121-121212121212';

const OPC = {
  no: 'o-no',
  atendido: 'o-si-at',
  sinAtencion: 'o-si-no',
  seguir: 'o-seguir',
  trabajar: 'o-trabajar',
};

const CAMPAÑA = {
  id: CAMPAIGN_ID,
  titulo: 'Encuesta de prueba',
  anio: 2026,
  status: 'ACTIVA',
  ventana: 'DURANTE',
  questions: [
    {
      id: Q_LESION,
      orden: 1,
      texto: '¿Te lesionaste?',
      kind: 'UNICA',
      audiencia: 'TODOS',
      activa: true,
      options: [
        { id: OPC.no, valor: 'no', texto: 'No', orden: 0 },
        {
          id: OPC.atendido,
          valor: 'si_atendido',
          texto: 'Sí, atendido',
          orden: 1,
        },
        {
          id: OPC.sinAtencion,
          valor: 'si_no_atendido',
          texto: 'Sí, sin atención',
          orden: 2,
        },
      ],
    },
    {
      id: Q_ESTUDIOS,
      orden: 2,
      texto: '¿Qué pensás hacer?',
      kind: 'UNICA',
      audiencia: 'TODOS',
      activa: true,
      options: [
        {
          id: OPC.seguir,
          valor: 'seguir_estudiando',
          texto: 'Seguir',
          orden: 0,
        },
        {
          id: OPC.trabajar,
          valor: 'solo_trabajar',
          texto: 'Trabajar',
          orden: 1,
        },
      ],
    },
  ],
};

const LOCALIDADES = [
  {
    id: LOC_FORMOSA,
    name: 'Formosa',
    departmentId: DEP_FORMOSA,
    department: { name: 'Formosa' },
  },
  {
    id: LOC_PIRANE,
    name: 'Pirané',
    departmentId: DEP_PIRANE,
    department: { name: 'Pirané' },
  },
];

interface Respuesta {
  id: string;
  campaignId: string;
  etapa: string;
  ventana: string;
  sexo: string | null;
  disciplineType: string;
  disciplineId: string | null;
  categoryId: string | null;
  localityId: string | null;
  enviadaEn: Date;
  answers: { questionId: string; optionId: string }[];
}

let secuencia = 0;
function respuesta(
  localityId: string | null,
  lesion: string,
  estudios: string | null,
): Respuesta {
  secuencia += 1;
  const answers = [{ questionId: Q_LESION, optionId: lesion }];
  if (estudios) answers.push({ questionId: Q_ESTUDIOS, optionId: estudios });
  return {
    id: `r-${secuencia}`,
    campaignId: CAMPAIGN_ID,
    etapa: 'ZONAL',
    ventana: 'DURANTE',
    sexo: 'MASCULINO',
    disciplineType: 'EQUIPO',
    disciplineId: null,
    categoryId: null,
    localityId,
    enviadaEn: new Date('2026-11-10T10:00:00Z'),
    answers,
  };
}

const repetir = <T>(veces: number, crear: () => T): T[] =>
  Array.from({ length: veces }, crear);

/**
 * Filtro mínimo del doble: `campaignId`, `localityId` y el recorte por zona
 * (`locality.name`/`NOT.locality`). Alcanza para lo que este spec ejercita.
 */
function pasaFiltro(r: Respuesta, where: Record<string, any>): boolean {
  if (where.campaignId && r.campaignId !== where.campaignId) return false;
  if (where.localityId && r.localityId !== where.localityId) return false;
  const esCapital = r.localityId === LOC_FORMOSA;
  if (where.locality?.name && !esCapital) return false;
  if (where.NOT?.locality && esCapital) return false;
  return true;
}

describe('/metrics (e2e) — k-anonimato', () => {
  let app: INestApplication;
  let respuestas: Respuesta[];
  let kpis: Array<Record<string, any>>;

  beforeEach(async () => {
    respuestas = [];
    kpis = [];

    const prisma = {
      surveyCampaign: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === CAMPAIGN_ID ? CAMPAÑA : null),
        ),
        findMany: jest.fn(() =>
          Promise.resolve([
            { ...CAMPAÑA, _count: { responses: respuestas.length } },
          ]),
        ),
      },
      surveyResponse: {
        count: jest.fn(({ where }: { where: Record<string, any> }) =>
          Promise.resolve(
            respuestas.filter((r) => pasaFiltro(r, where)).length,
          ),
        ),
        findMany: jest.fn(({ where }: { where: Record<string, any> }) =>
          Promise.resolve(respuestas.filter((r) => pasaFiltro(r, where))),
        ),
      },
      surveyKpi: {
        findMany: jest.fn(() => Promise.resolve(kpis)),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(kpis.find((k) => k.id === where.id) ?? null),
        ),
        create: jest.fn(({ data }: { data: Record<string, any> }) => {
          const creado = { id: KPI_ID, ...data };
          kpis.push(creado);
          return Promise.resolve(creado);
        }),
        delete: jest.fn(({ where }: { where: { id: string } }) => {
          const i = kpis.findIndex((k) => k.id === where.id);
          const [borrado] = kpis.splice(i, 1);
          return Promise.resolve(borrado);
        }),
      },
      locality: {
        findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            LOCALIDADES.filter((l) => where.id.in.includes(l.id)),
          ),
        ),
      },
      department: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              id: DEP_FORMOSA,
              name: 'Formosa',
              localities: [{ id: LOC_FORMOSA, name: 'Formosa' }],
            },
            {
              id: DEP_PIRANE,
              name: 'Pirané',
              localities: [{ id: LOC_PIRANE, name: 'Pirané' }],
            },
          ]),
        ),
      },
      discipline: { findMany: jest.fn(() => Promise.resolve([])) },
      category: { findMany: jest.fn(() => Promise.resolve([])) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService, { provide: PrismaService, useValue: prisma }],
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

  it('la versión sin Redis es el conteo de respuestas', async () => {
    respuestas.push(...repetir(3, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/version`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: 3 });
  });

  it('overview: un corte con menos de 5 respuestas sale suprimido en todas sus partes', async () => {
    respuestas.push(...repetir(4, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);

    expect(res.status).toBe(200);
    expect(res.body.totalRespuestas).toBe(4);
    expect(res.body.porEtapaVentana[0]).toMatchObject({
      etapa: 'ZONAL',
      ventana: 'DURANTE',
      suprimido: true,
      motivo: MOTIVO_SUPRESION,
      conteo: null,
    });
    for (const punto of res.body.serie.puntos) {
      expect(punto.suprimido).toBe(true);
    }
    expect(JSON.stringify(res.body)).not.toContain('"conteo":4');
  });

  it('cross: una celda suprimida arrastra el total de su fila', async () => {
    respuestas.push(
      ...repetir(7, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(2, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
      ...repetir(6, () => respuesta(LOC_FORMOSA, OPC.atendido, null)),
    );
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=localidad`,
    );

    expect(res.status).toBe(200);
    const pirane = res.body.filas.find((f: any) => f.etiqueta === 'Pirané');
    const formosa = res.body.filas.find((f: any) => f.etiqueta === 'Formosa');

    // Pirané: 7 visibles + 2 suprimidas ⇒ el total (9) también se oculta.
    expect(pirane.totalFila).toMatchObject({ suprimido: true, conteo: null });
    expect(pirane.celdas.find((c: any) => c.valor === 'no')).toMatchObject({
      conteo: 7,
    });
    expect(
      pirane.celdas.find((c: any) => c.valor === 'si_no_atendido'),
    ).toMatchObject({
      suprimido: true,
      conteo: null,
    });
    // Formosa: todas sus celdas visibles o en cero publicable ⇒ total visible.
    expect(formosa.totalFila).toEqual({ suprimido: false, conteo: 6 });
    expect(res.body.etiquetaDimension).toBe('Localidad');
  });

  it('cross por zona: Formosa es CAPITAL, el resto y sin dato es INTERIOR', async () => {
    respuestas.push(
      ...repetir(5, () => respuesta(LOC_FORMOSA, OPC.no, null)),
      ...repetir(5, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(5, () => respuesta(null, OPC.no, null)),
    );
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=zona`,
    );
    expect(res.status).toBe(200);
    expect(
      res.body.filas.map((f: any) => [f.etiqueta, f.totalFila.conteo]),
    ).toEqual([
      ['INTERIOR', 10],
      ['CAPITAL', 5],
    ]);
  });

  it('cross: rechaza dimensiones inválidas y una pregunta cruzada consigo misma', async () => {
    const invalida = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=edad`,
    );
    expect(invalida.status).toBe(400);

    const consigo = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=pregunta:${Q_LESION}`,
    );
    expect(consigo.status).toBe(400);

    const ajena = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${LOC_PIRANE}&por=zona`,
    );
    expect(ajena.status).toBe(404);
  });

  it('kpis: el cociente se publica sólo con ambos lados por encima del umbral', async () => {
    kpis.push({
      id: KPI_ID,
      campaignId: null,
      nombre: 'Lesionados atendidos',
      descripcion: null,
      orden: 0,
      activo: true,
      definicion: {
        numerador: [{ valores: ['si_atendido'] }],
        denominador: [{ valores: ['si_atendido', 'si_no_atendido'] }],
        formato: 'porcentaje',
      },
      createdAt: new Date(),
    });

    // 6 atendidos de 10 lesionados: ambos lados visibles.
    respuestas.push(
      ...repetir(6, () => respuesta(LOC_PIRANE, OPC.atendido, null)),
      ...repetir(4, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
    );
    const visible = await get(`/metrics/survey/${CAMPAIGN_ID}/kpis`);
    expect(visible.status).toBe(200);
    expect(visible.body.kpis[0]).toMatchObject({
      nombre: 'Lesionados atendidos',
      numerador: { suprimido: false, conteo: 6 },
      denominador: { suprimido: false, conteo: 10 },
      valor: 60,
    });

    // Filtrando a la capital no hay lesionados: numerador suprimido ⇒ sin valor.
    const suprimido = await get(
      `/metrics/survey/${CAMPAIGN_ID}/kpis?zona=CAPITAL`,
    );
    expect(suprimido.body.kpis[0]).toMatchObject({
      numerador: { suprimido: true, conteo: null },
      valor: null,
    });
  });

  it('kpis: crear valida la definición y borrar funciona', async () => {
    const malo = await request(app.getHttpServer())
      .post('/metrics/kpis')
      .send({
        nombre: 'Sin numerador',
        definicion: { numerador: [], denominador: 'todas', formato: 'conteo' },
      });
    expect(malo.status).toBe(400);
    expect(malo.body.message).toMatch(/numerador/);

    const bueno = await request(app.getHttpServer())
      .post('/metrics/kpis')
      .send({
        nombre: 'Seguir estudiando',
        definicion: {
          numerador: [{ valores: ['seguir_estudiando'] }],
          denominador: 'contestaron',
          formato: 'porcentaje',
        },
      });
    expect(bueno.status).toBe(201);
    expect(kpis).toHaveLength(1);

    const borrado = await request(app.getHttpServer()).delete(
      `/metrics/kpis/${KPI_ID}`,
    );
    expect(borrado.status).toBe(200);
    expect(kpis).toHaveLength(0);
  });

  it('catalog: devuelve preguntas, dimensiones y localidades con zona, sin datos personales', async () => {
    const res = await get('/metrics/catalog');
    expect(res.status).toBe(200);
    expect(res.body.campaniaId).toBe(CAMPAIGN_ID);
    expect(res.body.preguntas).toHaveLength(2);
    expect(res.body.dimensiones.map((d: any) => d.clave)).toContain('zona');
    const formosa = res.body.departamentos.find(
      (d: any) => d.nombre === 'Formosa',
    );
    expect(formosa.localidades[0]).toEqual({
      id: LOC_FORMOSA,
      nombre: 'Formosa',
      zona: 'CAPITAL',
    });
    expect(res.body.umbral).toBe(5);
  });
});
