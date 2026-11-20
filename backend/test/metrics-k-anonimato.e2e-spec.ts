// ===========================================
// /metrics — k-anonimato de punta a punta y versión
// ===========================================
//
// Lo que fija este spec: a través de HTTP, con validación de query y todo,
// ningún corte con menos de 5 respuestas sale con un conteo; una celda
// suprimida arrastra el total de su fila; un KPI no publica cociente si
// alguno de sus lados está suprimido; la versión de la campaña, sin Redis,
// es el conteo de respuestas; cada corte se publica en tandas de 5; los
// filtros de fecha se redondean al día; un corte filtrado sólo se publica si
// su fila se publicaría en el cruce del corte sin ese filtro; y no se aceptan
// más de 2 filtros a la vez. El doble de Prisma es en memoria, como en
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
    // Un segundo después de la anterior: el orden de llegada es el de alta.
    enviadaEn: new Date(Date.UTC(2026, 10, 10, 10, 0, secuencia)),
    answers,
  };
}

const repetir = <T>(veces: number, crear: () => T): T[] =>
  Array.from({ length: veces }, crear);

/**
 * Filtro mínimo del doble: `campaignId`, `localityId`, el recorte por zona
 * (`locality.name`/`NOT.locality`) y el rango de `enviadaEn`. Alcanza para lo
 * que este spec ejercita.
 */
function pasaFiltro(r: Respuesta, where: Record<string, any>): boolean {
  if (where.campaignId && r.campaignId !== where.campaignId) return false;
  if (where.localityId && r.localityId !== where.localityId) return false;
  if (where.enviadaEn?.gte && r.enviadaEn < where.enviadaEn.gte) return false;
  if (where.enviadaEn?.lte && r.enviadaEn > where.enviadaEn.lte) return false;
  const esCapital = r.localityId === LOC_FORMOSA;
  if (where.locality?.name && !esCapital) return false;
  if (where.NOT?.locality && esCapital) return false;
  return true;
}

describe('/metrics (e2e) — k-anonimato', () => {
  let app: INestApplication;
  let respuestas: Respuesta[];
  let kpis: Array<Record<string, any>>;
  let destacados: Array<Record<string, any>>;

  beforeEach(async () => {
    respuestas = [];
    kpis = [];
    destacados = [];

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
      surveyHighlight: {
        findMany: jest.fn(() => Promise.resolve(destacados)),
        create: jest.fn(({ data }: { data: Record<string, any> }) => {
          const creado = { id: KPI_ID, ...data };
          destacados.push(creado);
          return Promise.resolve(creado);
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
    // El total del corte también pasa por el umbral: con 4 no se publica.
    expect(res.body.totalRespuestas).toEqual({
      suprimido: true,
      motivo: MOTIVO_SUPRESION,
      conteo: null,
    });
    // Con 4 todavía no hay una tanda completa: no se publica ninguna parte.
    expect(res.body.porEtapaVentana).toEqual([]);
    expect(res.body.serie.puntos).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('"conteo":4');
  });

  it('overview: total 15 con 12 en la capital: el interior (3) no se despeja restando', async () => {
    respuestas.push(
      ...repetir(12, () => respuesta(LOC_FORMOSA, OPC.no, null)),
      ...repetir(3, () => respuesta(LOC_PIRANE, OPC.no, null)),
    );
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);
    expect(res.body.totalRespuestas).toEqual({ suprimido: false, conteo: 15 });
    for (const zona of res.body.porZona) {
      expect(zona).toMatchObject({ suprimido: true, conteo: null });
    }
    const cruce = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=zona`,
    );
    for (const fila of cruce.body.filas) {
      expect(fila.totalFila).toMatchObject({ suprimido: true, conteo: null });
    }
    expect(JSON.stringify(cruce.body.filas)).not.toMatch(/"conteo":(3|12)[,}]/);
  });

  it('cross: un corte chico no publica ni su total ni los ceros (no se despeja por resta)', async () => {
    respuestas.push(
      ...repetir(3, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
      ...repetir(6, () => respuesta(LOC_FORMOSA, OPC.no, null)),
    );
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=ventana&localityId=${LOC_PIRANE}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.totalRespuestas).toMatchObject({
      suprimido: true,
      conteo: null,
    });
    // Con 3 en el corte no hay tanda completa: no sale ninguna fila.
    expect(res.body.filas).toEqual([]);
    expect(JSON.stringify(res.body)).not.toMatch(/"conteo":(0|3)[,}]/);

    const overview = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?localityId=${LOC_PIRANE}`,
    );
    expect(overview.body.totalRespuestas).toMatchObject({
      suprimido: true,
      conteo: null,
    });
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

    // Pirané: 7 + 2 suprimidas ⇒ el total (9) también se oculta. Y como la
    // pregunta es de opción única y el total de la localidad se conoce por
    // otro lado (filtrando el resumen), 9 − 7 despejaría el 2: la menor celda
    // visible (el 7) se oculta también (supresión secundaria).
    expect(pirane.totalFila).toMatchObject({ suprimido: true, conteo: null });
    expect(pirane.celdas.find((c: any) => c.valor === 'no')).toMatchObject({
      suprimido: true,
      conteo: null,
    });
    expect(
      pirane.celdas.find((c: any) => c.valor === 'si_no_atendido'),
    ).toMatchObject({
      suprimido: true,
      conteo: null,
    });
    expect(JSON.stringify(pirane)).not.toMatch(/"conteo":(2|7)[,}]/);
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
      ['Interior', 10],
      ['Capital', 5],
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

    // 6 atendidos de 10 lesionados: 10 − 6 = 4 sin atención quedaría a la
    // vista por resta ⇒ el numerador y el valor no se publican.
    respuestas.push(
      ...repetir(6, () => respuesta(LOC_PIRANE, OPC.atendido, null)),
      ...repetir(4, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
    );
    const complemento = await get(`/metrics/survey/${CAMPAIGN_ID}/kpis`);
    expect(complemento.status).toBe(200);
    expect(complemento.body.kpis[0]).toMatchObject({
      numerador: { suprimido: true, conteo: null },
      denominador: { suprimido: false, conteo: 10 },
      valor: null,
    });

    // Cinco sin atención más (una tanda; 6 de 15, resto 9): todo visible.
    respuestas.push(
      ...repetir(5, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
    );
    const visible = await get(`/metrics/survey/${CAMPAIGN_ID}/kpis`);
    expect(visible.body.kpis[0]).toMatchObject({
      nombre: 'Lesionados atendidos',
      numerador: { suprimido: false, conteo: 6 },
      denominador: { suprimido: false, conteo: 15 },
      valor: 40,
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

  const LESIONES = {
    id: KPI_ID,
    campaignId: null,
    titulo: 'Lo que más les pasa',
    descripcion: null,
    orden: 0,
    activo: true,
    definicion: {
      opciones: ['no', 'si_atendido', 'si_no_atendido', 'de_otra_edicion'],
      top: 3,
    },
    createdAt: new Date(),
  };

  it('highlights: ranking sin celdas chicas ni resta posible en opción única', async () => {
    destacados.push(LESIONES);
    // 22 + 9 + 4 = 35. El 4 se oculta; como la pregunta es de opción única y
    // la base es visible, 35 − 22 − 9 lo despejaría: se oculta también el 9.
    respuestas.push(
      ...repetir(22, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(9, () => respuesta(LOC_PIRANE, OPC.atendido, null)),
      ...repetir(4, () => respuesta(LOC_PIRANE, OPC.sinAtencion, null)),
    );
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/highlights`);
    expect(res.status).toBe(200);
    expect(res.body.minimoFrases).toBe(30);
    const [d] = res.body.destacados;
    expect(d.titulo).toBe('Lo que más les pasa');
    expect(d.base).toEqual({ suprimido: false, conteo: 35 });
    expect(d.opciones).toEqual([
      { valor: 'no', texto: 'No', conteo: 22, porcentaje: 62.9 },
    ]);
    expect(d.ocultas).toBe(2);
    expect(d.puedeAfirmar).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/"conteo":(4|9)[,}]/);
  });

  it('highlights: con pocas respuestas no hay ranking ni frases', async () => {
    destacados.push(LESIONES);
    respuestas.push(...repetir(4, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/highlights`);
    const [d] = res.body.destacados;
    expect(d.base).toMatchObject({ suprimido: true, conteo: null });
    expect(d.opciones).toEqual([]);
    expect(d.puedeAfirmar).toBe(false);
  });

  it('highlights: un destacado sin opciones en esta campaña no aparece', async () => {
    destacados.push({
      ...LESIONES,
      titulo: 'De otra edición',
      definicion: { opciones: ['nec_transporte'], top: 3 },
    });
    respuestas.push(...repetir(6, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const res = await get(`/metrics/survey/${CAMPAIGN_ID}/highlights`);
    expect(res.status).toBe(200);
    expect(res.body.destacados).toEqual([]);
  });

  it('highlights: crear valida la definición', async () => {
    const malo = await request(app.getHttpServer())
      .post('/metrics/highlights')
      .send({ titulo: 'X', definicion: { opciones: [], top: 3 } });
    expect(malo.status).toBe(400);
    expect(malo.body.message).toMatch(/opciones/);

    const bueno = await request(app.getHttpServer())
      .post('/metrics/highlights')
      .send({
        titulo: 'Lo que más necesitan los deportistas es:',
        definicion: { opciones: ['no', 'si_atendido'], top: 3 },
      });
    expect(bueno.status).toBe(201);
    expect(destacados).toHaveLength(1);
  });

  it('tandas: de la 6.ª a la 9.ª respuesta nada cambia; la 10.ª suma las cinco juntas', async () => {
    respuestas.push(...repetir(5, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const base = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);
    expect(base.body.totalRespuestas).toEqual({ suprimido: false, conteo: 5 });
    const cruceBase = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=ventana`,
    );

    // Un coordinador que ve contestar a alguien y recarga no ve su respuesta.
    for (let i = 0; i < 4; i += 1) {
      respuestas.push(respuesta(LOC_PIRANE, OPC.sinAtencion, null));
      const ahora = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);
      expect(ahora.body.totalRespuestas).toEqual(base.body.totalRespuestas);
      expect(ahora.body.porZona).toEqual(base.body.porZona);
      const cruce = await get(
        `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=ventana`,
      );
      expect(cruce.body.filas).toEqual(cruceBase.body.filas);
    }

    respuestas.push(respuesta(LOC_PIRANE, OPC.sinAtencion, null));
    const despues = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);
    expect(despues.body.totalRespuestas).toEqual({
      suprimido: false,
      conteo: 10,
    });
  });

  it('tandas: un corte filtrado también se publica de a 5 (7 en Pirané ⇒ 5)', async () => {
    respuestas.push(
      ...repetir(7, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(10, () => respuesta(LOC_FORMOSA, OPC.no, null)),
    );
    const pirane = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?localityId=${LOC_PIRANE}`,
    );
    expect(pirane.body.totalRespuestas).toEqual({
      suprimido: false,
      conteo: 5,
    });
    const catalogo = await get('/metrics/catalog');
    expect(catalogo.body.campanias[0].totalRespuestas).toBe(15);
  });

  it('fechas: un rango con hora se amplía al día completo (no aísla minutos)', async () => {
    respuestas.push(...repetir(10, () => respuesta(LOC_PIRANE, OPC.no, null)));
    // Entre el segundo 3 y el 4 hay dos respuestas; redondeado al día, diez.
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?desde=2026-11-10T10:00:03Z&hasta=2026-11-10T10:00:04Z`,
    );
    expect(res.status).toBe(200);
    expect(res.body.totalRespuestas).toEqual({ suprimido: false, conteo: 10 });
    expect(res.body.filtros).toMatchObject({
      desde: '2026-11-10',
      hasta: '2026-11-10',
    });

    const otroDia = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?desde=2026-11-11T00:00:00Z`,
    );
    expect(otroDia.body.totalRespuestas).toMatchObject({ suprimido: true });
  });

  it('coherencia: total 50 con 3 en la capital: filtrar por interior no despeja la capital', async () => {
    respuestas.push(
      ...repetir(47, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(3, () => respuesta(LOC_FORMOSA, OPC.no, null)),
    );
    const total = await get(`/metrics/survey/${CAMPAIGN_ID}/overview`);
    expect(total.body.totalRespuestas).toEqual({
      suprimido: false,
      conteo: 50,
    });

    for (const zona of ['INTERIOR', 'CAPITAL']) {
      const filtrado = await get(
        `/metrics/survey/${CAMPAIGN_ID}/overview?zona=${zona}`,
      );
      expect(filtrado.status).toBe(200);
      expect(filtrado.body.totalRespuestas).toMatchObject({
        suprimido: true,
        conteo: null,
      });
      const cruce = await get(
        `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=ventana&zona=${zona}`,
      );
      expect(cruce.body.filas).toEqual([]);
      const kpis = await get(
        `/metrics/survey/${CAMPAIGN_ID}/kpis?zona=${zona}`,
      );
      expect(JSON.stringify(kpis.body)).not.toMatch(/"conteo":(3|45|47)[,}]/);
    }
  });

  it('coherencia: un segundo filtro redundante no destraba un corte bloqueado', async () => {
    // Interior y Pirané son lo mismo acá: cada filtro solo está bloqueado
    // (50 − 47 despejaría la capital); juntos tampoco se publican.
    respuestas.push(
      ...repetir(47, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(3, () => respuesta(LOC_FORMOSA, OPC.no, null)),
    );
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?zona=INTERIOR&localityId=${LOC_PIRANE}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.totalRespuestas).toMatchObject({
      suprimido: true,
      conteo: null,
    });
    const cruce = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=ventana&zona=INTERIOR&localityId=${LOC_PIRANE}`,
    );
    expect(cruce.body.filas).toEqual([]);
  });

  it('coherencia: sumar localidades no despeja la que falta', async () => {
    // Formosa 10, Pirané 12 y 3 sin localidad (total 25). Sin la regla,
    // 25 − 10 − 12 daría los 3 sin localidad: Formosa (la visible más chica)
    // tampoco se publica filtrando.
    respuestas.push(
      ...repetir(10, () => respuesta(LOC_FORMOSA, OPC.no, null)),
      ...repetir(12, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(3, () => respuesta(null, OPC.no, null)),
    );
    const formosa = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?localityId=${LOC_FORMOSA}`,
    );
    expect(formosa.body.totalRespuestas).toMatchObject({ suprimido: true });
    const pirane = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?localityId=${LOC_PIRANE}`,
    );
    expect(pirane.body.totalRespuestas).toEqual({
      suprimido: false,
      conteo: 10,
    });
  });

  it('coherencia: un rango de fechas que deja afuera a pocos no se publica', async () => {
    respuestas.push(
      ...repetir(12, () => respuesta(LOC_PIRANE, OPC.no, null)),
      ...repetir(3, () => ({
        ...respuesta(LOC_PIRANE, OPC.no, null),
        enviadaEn: new Date('2026-11-11T12:00:00Z'),
      })),
    );
    const dia = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?desde=2026-11-10&hasta=2026-11-10`,
    );
    expect(dia.status).toBe(200);
    expect(dia.body.totalRespuestas).toMatchObject({ suprimido: true });
  });

  it('tope: más de 2 filtros a la vez se rechaza con 400', async () => {
    respuestas.push(...repetir(10, () => respuesta(LOC_PIRANE, OPC.no, null)));
    const res = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?zona=INTERIOR&localityId=${LOC_PIRANE}&desde=2026-11-10`,
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('hasta 2 filtros');
    const cruce = await get(
      `/metrics/survey/${CAMPAIGN_ID}/cross?pregunta=${Q_LESION}&por=zona&zona=INTERIOR&localityId=${LOC_PIRANE}&sexo=MASCULINO`,
    );
    expect(cruce.status).toBe(400);
    const dos = await get(
      `/metrics/survey/${CAMPAIGN_ID}/overview?localityId=${LOC_PIRANE}&desde=2026-11-10&hasta=2026-11-10`,
    );
    expect(dos.status).toBe(200);
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
