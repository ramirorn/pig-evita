// ===========================================
// E2E — Encuesta psicológica: anonimato, validación y k-anonimato (S20)
// ===========================================
//
// Las cuatro cosas que este módulo no puede romper nunca, en el orden en que
// duelen:
//
//   1. **La respuesta no guarda quién la mandó.** Responden menores de edad
//      sobre su salud mental. Si alguna vez aparece un `participantId` "para
//      deduplicar", el test de abajo se pone en rojo antes de que llegue a
//      producción — mira el esquema, no sólo el payload, porque la columna
//      podría existir sin que este service la escriba.
//   2. **Una opción sólo cuenta para su pregunta.** El endpoint es público:
//      lo que llega puede no venir del formulario, y una opción cruzada
//      contaminaría el agregado de otra pregunta sin dejar rastro.
//   3. **La audiencia se verifica del lado del servidor.** El formulario
//      esconde las preguntas de equipo cuando el chico compite solo; esconder
//      no es validar.
//   4. **Los cortes chicos no se publican.** "Handball, Laguna Yema, zonal: 3
//      respuestas" con desglose por opción es un nombre propio para cualquiera
//      que estuvo en esa cancha.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SurveyController } from '../src/modules/survey/survey.controller';
import { SurveyService } from '../src/modules/survey/survey.service';
import {
  MOTIVO_SUPRESION,
  UMBRAL_K_ANONIMATO,
} from '../src/modules/survey/survey.constants';
import { PrismaService } from '../src/database/prisma.service';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const Q_TODOS = '22222222-2222-4222-8222-222222222221';
const Q_EQUIPO = '22222222-2222-4222-8222-222222222222';
const OPT_TODOS_SI = '33333333-3333-4333-8333-333333333331';
const OPT_TODOS_NO = '33333333-3333-4333-8333-333333333332';
const OPT_EQUIPO_APOYO = '33333333-3333-4333-8333-333333333333';
const DISCIPLINA_INDIVIDUAL = '44444444-4444-4444-8444-444444444441';
const LOCALIDAD = '55555555-5555-4555-8555-555555555551';

const CAMPAÑA = {
  id: CAMPAIGN_ID,
  titulo: 'Encuesta de bienestar deportivo',
  descripcion: null,
  anio: 2026,
  status: 'ACTIVA',
  ventana: 'PRE',
  etapa: null,
  abreEn: null,
  cierraEn: null,
  createdById: null,
  createdAt: new Date('2026-08-01T12:00:00.000Z'),
  updatedAt: new Date('2026-08-01T12:00:00.000Z'),
  _count: { responses: 8 },
  questions: [
    {
      id: Q_TODOS,
      campaignId: CAMPAIGN_ID,
      orden: 1,
      texto: '¿Tuviste asistencia profesional acerca de la salud mental?',
      ayuda: null,
      kind: 'UNICA',
      audiencia: 'TODOS',
      obligatoria: true,
      activa: true,
      options: [
        {
          id: OPT_TODOS_SI,
          questionId: Q_TODOS,
          orden: 0,
          texto: 'Sí',
          valor: 'si',
        },
        {
          id: OPT_TODOS_NO,
          questionId: Q_TODOS,
          orden: 1,
          texto: 'No',
          valor: 'no',
        },
      ],
    },
    {
      id: Q_EQUIPO,
      campaignId: CAMPAIGN_ID,
      orden: 2,
      texto: 'Cuando el equipo pierde, ¿cómo se hablan entre ustedes?',
      ayuda: null,
      kind: 'UNICA',
      audiencia: 'EQUIPO',
      // No obligatoria: así el envío de un deportista individual que la omite
      // es válido, y el 400 que buscamos sólo puede venir de la audiencia.
      obligatoria: false,
      activa: true,
      options: [
        {
          id: OPT_EQUIPO_APOYO,
          questionId: Q_EQUIPO,
          orden: 0,
          texto: 'Nos apoyamos',
          valor: 'nos_apoyamos',
        },
      ],
    },
  ],
};

/**
 * Respuestas ya cargadas: 6 en el provincial y 2 en el zonal.
 *
 * El corte zonal queda por debajo del umbral a propósito: es el que tiene que
 * volver suprimido.
 */
const RESPUESTAS = [
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `prov-${i}`,
    campaignId: CAMPAIGN_ID,
    etapa: 'PROVINCIAL',
    ventana: 'PRE',
    disciplineId: DISCIPLINA_INDIVIDUAL,
    disciplineType: 'INDIVIDUAL',
    localityId: LOCALIDAD,
    answers: [
      { questionId: Q_TODOS, optionId: i < 4 ? OPT_TODOS_SI : OPT_TODOS_NO },
    ],
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `zonal-${i}`,
    campaignId: CAMPAIGN_ID,
    etapa: 'ZONAL',
    ventana: 'PRE',
    disciplineId: DISCIPLINA_INDIVIDUAL,
    disciplineType: 'INDIVIDUAL',
    localityId: LOCALIDAD,
    answers: [{ questionId: Q_TODOS, optionId: OPT_TODOS_NO }],
  })),
];

type Fila = (typeof RESPUESTAS)[number];

/** ¿La respuesta pasa el `where` que armó el service? */
function coincide(fila: Fila, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([campo, valor]) => {
    if (valor === undefined) return true;
    if (campo === 'answers') {
      const questionId = valor?.some?.questionId;
      return fila.answers.some((a) => a.questionId === questionId);
    }
    return (fila as unknown as Record<string, unknown>)[campo] === valor;
  });
}

describe('Encuesta psicológica (e2e)', () => {
  let app: INestApplication<App>;
  let creadas: Record<string, any>[];

  beforeEach(async () => {
    creadas = [];

    const prisma = {
      surveyCampaign: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === CAMPAIGN_ID ? CAMPAÑA : null),
        ),
        findMany: jest.fn(() => Promise.resolve([CAMPAÑA])),
      },
      surveyResponse: {
        create: jest.fn(({ data }: { data: Record<string, any> }) => {
          creadas.push(data);
          return Promise.resolve({
            enviadaEn: new Date('2026-09-01T10:00:00.000Z'),
          });
        }),
        count: jest.fn(({ where }: { where: Record<string, any> }) =>
          Promise.resolve(RESPUESTAS.filter((r) => coincide(r, where)).length),
        ),
      },
      surveyAnswer: {
        groupBy: jest.fn(
          ({ where }: { where: { response: Record<string, any> } }) => {
            const conteos = new Map<string, number>();
            for (const fila of RESPUESTAS.filter((r) =>
              coincide(r, where.response),
            )) {
              for (const answer of fila.answers) {
                const clave = `${answer.questionId}:${answer.optionId}`;
                conteos.set(clave, (conteos.get(clave) ?? 0) + 1);
              }
            }
            return Promise.resolve(
              [...conteos.entries()].map(([clave, total]) => {
                const [questionId, optionId] = clave.split(':');
                return { questionId, optionId, _count: { _all: total } };
              }),
            );
          },
        ),
      },
      discipline: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === DISCIPLINA_INDIVIDUAL ? { type: 'INDIVIDUAL' } : null,
          ),
        ),
      },
      locality: {
        findUnique: jest.fn(() => Promise.resolve({ id: LOCALIDAD })),
      },
      category: { findUnique: jest.fn(() => Promise.resolve(null)) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [SurveyService, { provide: PrismaService, useValue: prisma }],
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

  /** Envío válido de un deportista de disciplina individual. */
  const envioValido = () => ({
    campaignId: CAMPAIGN_ID,
    etapa: 'PROVINCIAL',
    disciplineType: 'INDIVIDUAL',
    disciplineId: DISCIPLINA_INDIVIDUAL,
    localityId: LOCALIDAD,
    respuestas: [{ questionId: Q_TODOS, optionIds: [OPT_TODOS_SI] }],
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/survey/responses').send(body);

  // -------------------------------------------------
  // 1. Anonimato
  // -------------------------------------------------
  describe('anonimato de SurveyResponse', () => {
    const PROHIBIDOS = [
      'participantId',
      'participant_id',
      'userId',
      'user_id',
      'inscriptionId',
      'inscription_id',
      'dni',
      'email',
      'ip',
      'ipAddress',
      'ip_address',
      'userAgent',
      'user_agent',
    ];

    it('el esquema no tiene ninguna columna que identifique al deportista', () => {
      const schema = readFileSync(
        join(__dirname, '..', 'prisma', 'schema.prisma'),
        'utf-8',
      );

      // El modelo entero, desde su declaración hasta la llave de cierre.
      const modelo = schema.slice(schema.indexOf('model SurveyResponse {'));
      const cuerpo = modelo.slice(0, modelo.indexOf('\n}'));

      // Se mira el cuerpo del modelo y no sólo lo que escribe el service: la
      // columna podría existir y llenarse desde otro lado más adelante.
      for (const campo of PROHIBIDOS) {
        expect(cuerpo).not.toMatch(new RegExp(`^\\s*${campo}\\b`, 'mi'));
      }
    });

    it('POST /survey/responses no persiste ningún identificador', async () => {
      await post(envioValido()).expect(201);

      expect(creadas).toHaveLength(1);
      const data = creadas[0];

      for (const campo of PROHIBIDOS) {
        expect(data).not.toHaveProperty(campo);
      }

      // Lo que sí se guarda: cortes demográficos gruesos y nada más.
      expect(Object.keys(data).sort()).toEqual(
        [
          'answers',
          'campaignId',
          'categoryId',
          'disciplineId',
          'disciplineType',
          'etapa',
          'localityId',
          'sexo',
          'ventana',
        ].sort(),
      );
    });

    it('el acuse no devuelve el id de la respuesta', async () => {
      const res = await post(envioValido()).expect(201);

      // Un id en manos del cliente es un recibo: alguien lo guarda y vuelve a
      // atar un dispositivo a la fila que existe para no estar atada a nadie.
      expect(res.body).toEqual({
        registrada: true,
        enviadaEn: '2026-09-01T10:00:00.000Z',
      });
    });

    it('la ventana se toma de la campaña y no del cliente', async () => {
      await post(envioValido()).expect(201);
      expect(creadas[0].ventana).toBe(CAMPAÑA.ventana);
    });
  });

  // -------------------------------------------------
  // 2. La opción tiene que ser de la pregunta
  // -------------------------------------------------
  describe('validación del envío', () => {
    it('rechaza una opción que pertenece a otra pregunta', async () => {
      const res = await post({
        ...envioValido(),
        respuestas: [{ questionId: Q_TODOS, optionIds: [OPT_EQUIPO_APOYO] }],
      }).expect(400);

      expect(res.body.message).toContain('no pertenece a la pregunta');
      expect(creadas).toHaveLength(0);
    });

    it('rechaza una pregunta que no es de esta campaña', async () => {
      await post({
        ...envioValido(),
        respuestas: [
          {
            questionId: '99999999-9999-4999-8999-999999999999',
            optionIds: [OPT_TODOS_SI],
          },
        ],
      }).expect(400);

      expect(creadas).toHaveLength(0);
    });

    it('rechaza dos opciones en una pregunta de opción única', async () => {
      await post({
        ...envioValido(),
        respuestas: [
          { questionId: Q_TODOS, optionIds: [OPT_TODOS_SI, OPT_TODOS_NO] },
        ],
      }).expect(400);

      expect(creadas).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // 3. Audiencia vs. tipo de disciplina
  // -------------------------------------------------
  describe('audiencia de las preguntas', () => {
    it('rechaza una pregunta de EQUIPO enviada con disciplineType INDIVIDUAL', async () => {
      const res = await post({
        ...envioValido(),
        respuestas: [
          { questionId: Q_TODOS, optionIds: [OPT_TODOS_SI] },
          { questionId: Q_EQUIPO, optionIds: [OPT_EQUIPO_APOYO] },
        ],
      }).expect(400);

      expect(res.body.message).toContain('no corresponde a una disciplina');
      expect(creadas).toHaveLength(0);
    });

    it('el mismo envío sin la pregunta de equipo sí entra', async () => {
      await post(envioValido()).expect(201);
      expect(creadas).toHaveLength(1);
    });
  });

  // -------------------------------------------------
  // 4. k-anonimato
  // -------------------------------------------------
  describe('k-anonimato en las métricas', () => {
    const metrics = (query = '') =>
      request(app.getHttpServer()).get(
        `/survey/campaigns/${CAMPAIGN_ID}/metrics${query}`,
      );

    it('un corte con menos de UMBRAL_K_ANONIMATO respuestas no devuelve desglose', async () => {
      // El zonal tiene 2 respuestas cargadas.
      const res = await metrics('?etapa=ZONAL').expect(200);

      expect(res.body.totalRespuestas).toBeLessThan(UMBRAL_K_ANONIMATO);
      expect(res.body.suprimido).toBe(true);
      expect(res.body.motivo).toBe(MOTIVO_SUPRESION);
      expect(res.body.preguntas).toEqual([]);

      // Y no se filtra ningún conteo por ningún otro camino.
      expect(JSON.stringify(res.body)).not.toContain(OPT_TODOS_SI);
    });

    it('un corte con suficientes respuestas sí devuelve el desglose', async () => {
      const res = await metrics('?etapa=PROVINCIAL').expect(200);

      expect(res.body.totalRespuestas).toBe(6);
      expect(res.body.suprimido).toBe(false);
      expect(res.body.motivo).toBeNull();

      const pregunta = res.body.preguntas.find(
        (p: { questionId: string }) => p.questionId === Q_TODOS,
      );
      const si = pregunta.opciones.find(
        (o: { valor: string }) => o.valor === 'si',
      );

      expect(si.conteo).toBe(4);
      expect(si.porcentaje).toBeCloseTo(66.7, 1);
    });

    it('el umbral viaja en la respuesta para que la UI pueda explicarlo', async () => {
      const res = await metrics().expect(200);
      expect(res.body.umbral).toBe(UMBRAL_K_ANONIMATO);
    });

    it('el cruce disciplina + localidad + etapa tampoco esquiva el umbral', async () => {
      // Es el cruce que reidentifica: pocos chicos de una disciplina en una
      // localidad chica, en una etapa.
      const res = await metrics(
        `?etapa=ZONAL&disciplineId=${DISCIPLINA_INDIVIDUAL}&localityId=${LOCALIDAD}`,
      ).expect(200);

      expect(res.body.suprimido).toBe(true);
      expect(res.body.preguntas).toEqual([]);
    });
  });
});
