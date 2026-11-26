// ===========================================
// E2E — Privacidad del envío anónimo de la encuesta (relevamiento OWASP 2025)
// ===========================================
//
// `survey-anonimato.e2e-spec.ts` fija lo que guarda `SurveyResponse`. Este spec
// fija lo que queda **alrededor** del envío, que es por donde se reconstruía el
// anonimato desde afuera:
//
//   · VULN-01 — el `AuditInterceptor` global grababa cada envío (cuerpo
//     completo, IP, User-Agent y hora) en `AuditLog`. Acá se monta el
//     interceptor real como `APP_INTERCEPTOR`, igual que en `app.module.ts`, y
//     se mira qué llega a `prisma.auditLog.create`.
//   · VULN-19 — la versión de la campaña subía con cada respuesta: quien
//     consultaba `/version` cada 10 s veía el momento exacto de cada envío.
//     Ahora sube cuando se completa una tanda de 5.
//   · VULN-20 — un volumen inusual de envíos por hora deja una advertencia en
//     el log (sin cortes), sin bloquear a nadie.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditInterceptor } from '../src/modules/audit/audit.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { SurveyController } from '../src/modules/survey/survey.controller';
import { SurveyService } from '../src/modules/survey/survey.service';
import { SurveyVersionCache } from '../src/modules/survey/survey-version.cache';
import {
  ALERTA_RESPUESTAS_POR_HORA,
  claveVersionCampania,
} from '../src/modules/survey/survey.constants';
import { PrismaService } from '../src/database/prisma.service';
import { RedisCacheService } from '../src/common/cache';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const Q_TODOS = '22222222-2222-4222-8222-222222222221';
const OPT_SI = '33333333-3333-4333-8333-333333333331';
const DISCIPLINA = '44444444-4444-4444-8444-444444444441';
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
          id: OPT_SI,
          questionId: Q_TODOS,
          orden: 0,
          texto: 'Sí',
          valor: 'si',
        },
      ],
    },
  ],
};

const ENVIO = {
  campaignId: CAMPAIGN_ID,
  etapa: 'PROVINCIAL',
  disciplineType: 'INDIVIDUAL',
  disciplineId: DISCIPLINA,
  localityId: LOCALIDAD,
  sexo: 'FEMENINO',
  respuestas: [{ questionId: Q_TODOS, optionIds: [OPT_SI] }],
};

/** El interceptor y la versión no se esperan: hay que dejar correr las microtasks. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Encuesta — privacidad alrededor del envío anónimo (e2e)', () => {
  let app: INestApplication<App>;
  let respuestasGuardadas: number;
  let auditLogCreate: jest.Mock;
  let incr: jest.Mock;

  beforeEach(async () => {
    respuestasGuardadas = 0;
    auditLogCreate = jest.fn(() => Promise.resolve({}));
    incr = jest.fn(() => Promise.resolve(1));

    const prisma = {
      surveyCampaign: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === CAMPAIGN_ID ? CAMPAÑA : null),
        ),
      },
      surveyResponse: {
        create: jest.fn(() => {
          respuestasGuardadas += 1;
          return Promise.resolve({
            enviadaEn: new Date('2026-09-01T10:00:00.000Z'),
          });
        }),
        count: jest.fn(() => Promise.resolve(respuestasGuardadas)),
      },
      surveyQuestion: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: '66666666-6666-4666-8666-666666666666',
            ...data,
            options: [],
          }),
        ),
      },
      discipline: {
        findUnique: jest.fn(() => Promise.resolve({ type: 'INDIVIDUAL' })),
      },
      locality: {
        findUnique: jest.fn(() => Promise.resolve({ id: LOCALIDAD })),
      },
      category: { findUnique: jest.fn(() => Promise.resolve(null)) },
      auditLog: { create: auditLogCreate },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SurveyController],
      providers: [
        SurveyService,
        SurveyVersionCache,
        AuditService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisCacheService, useValue: { incr } },
        // El mismo registro que `app.module.ts`: global, no por controller.
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
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
    jest.restoreAllMocks();
    await app.close();
  });

  const enviar = () =>
    request(app.getHttpServer())
      .post('/survey/responses')
      .set('User-Agent', 'Telefono-De-Un-Chico/1.0')
      .send(ENVIO);

  const agregarPregunta = () =>
    request(app.getHttpServer())
      .post(`/survey/campaigns/${CAMPAIGN_ID}/questions`)
      .send({ texto: '¿Cómo te sentiste en el viaje?' });

  // -------------------------------------------------
  // VULN-01 — el envío no queda en la auditoría
  // -------------------------------------------------
  describe('auditoría (VULN-01)', () => {
    it('POST /survey/responses no crea ninguna fila en AuditLog', async () => {
      await enviar().expect(201);
      await flush();

      expect(respuestasGuardadas).toBe(1);
      expect(auditLogCreate).not.toHaveBeenCalled();
    });

    it('las escrituras de quien gestiona la encuesta se siguen auditando', async () => {
      // Control: prueba que el interceptor está activo en este módulo, así el
      // test de arriba no pasa en verde por no auditar nada.
      await agregarPregunta().expect(201);
      await flush();

      expect(auditLogCreate).toHaveBeenCalledTimes(1);
      const [{ data }] = auditLogCreate.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data).toMatchObject({ action: 'CREATE', entity: 'survey' });
    });
  });

  // -------------------------------------------------
  // VULN-19 — la versión sube de a tandas, no con cada envío
  // -------------------------------------------------
  describe('versión de la campaña (VULN-19)', () => {
    const subidasDeVersion = () =>
      incr.mock.calls.filter(
        ([clave]) => clave === claveVersionCampania(CAMPAIGN_ID),
      ).length;

    it('de la 1.ª a la 4.ª respuesta la versión no cambia; la 5.ª la sube una vez', async () => {
      for (let i = 0; i < 4; i += 1) {
        await enviar().expect(201);
        await flush();
      }
      expect(subidasDeVersion()).toBe(0);

      await enviar().expect(201);
      await flush();
      expect(subidasDeVersion()).toBe(1);

      // La 6.ª vuelve a esperar a la tanda siguiente.
      await enviar().expect(201);
      await flush();
      expect(subidasDeVersion()).toBe(1);
    });

    it('editar el cuestionario sigue subiendo la versión al instante', async () => {
      await agregarPregunta().expect(201);
      await flush();
      expect(subidasDeVersion()).toBe(1);
    });
  });

  // -------------------------------------------------
  // VULN-20 — volumen inusual: se avisa, no se bloquea
  // -------------------------------------------------
  describe('integridad de la muestra (VULN-20)', () => {
    it('al llegar al umbral por hora deja una sola advertencia, sin cortes, y sigue aceptando', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      for (let i = 0; i < ALERTA_RESPUESTAS_POR_HORA + 2; i += 1) {
        await enviar().expect(201);
      }

      const avisos = warn.mock.calls
        .map(([mensaje]) => String(mensaje))
        .filter((mensaje) => mensaje.includes('volumen inusual'));
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toContain(CAMPAIGN_ID);
      // Ni localidad, ni disciplina, ni sexo: el aviso no es un corte.
      expect(avisos[0]).not.toContain(LOCALIDAD);
      expect(avisos[0]).not.toContain(DISCIPLINA);
      expect(avisos[0]).not.toContain('FEMENINO');
      expect(respuestasGuardadas).toBe(ALERTA_RESPUESTAS_POR_HORA + 2);
    });
  });
});
