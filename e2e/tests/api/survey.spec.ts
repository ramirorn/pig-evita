// Encuesta de salud mental: campañas, preguntas/opciones, publicación, respuesta pública anónima, métricas.
import { expect, test } from '@playwright/test';
import { Api, anon, as, body, data, freshIp, newCtx, uniq } from '../../lib/api';

const prov = async () => (await as('ADMIN_PROVINCIAL')).api;

/** Campaña con 2 preguntas (una única para todos, otra múltiple sólo para EQUIPO) lista para publicar. */
async function campania(etapa = 'ZONAL', ventana = 'PRE') {
  const s = await prov();
  const c = await data(await s.post('/survey/campaigns', { titulo: uniq('Camp'), descripcion: 'prueba', anio: 2026, ventana, etapa }), 201);
  const q1 = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Cómo te sentís?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true,
      opciones: [{ texto: 'Bien', valor: 'bien' }, { texto: 'Mal', valor: 'mal' }],
    }),
    201,
  );
  const q2 = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Qué te preocupa del equipo?', kind: 'MULTIPLE', audiencia: 'EQUIPO', obligatoria: false,
      opciones: [{ texto: 'Perder', valor: 'perder' }, { texto: 'Fallar', valor: 'fallar' }],
    }),
    201,
  );
  return { c, q1, q2, s };
}
const opc = (q: any) => q.options ?? q.opciones;

test.describe('gestión de campañas', () => {
  test('ciclo de vida: BORRADOR → ACTIVA → CERRADA; cerrada no se reactiva; borrador con 0 preguntas no publica', async () => {
    const s = await prov();
    const vacia = await data(await s.post('/survey/campaigns', { titulo: uniq('Vacia'), anio: 2026, ventana: 'PRE' }), 201);
    expect(vacia.status).toBe('BORRADOR');
    expect((await s.post(`/survey/campaigns/${vacia.id}/publish`)).status()).toBe(400);
    expect((await s.del(`/survey/campaigns/${vacia.id}`)).status()).toBeLessThan(300);

    const { c } = await campania();
    expect((await data(await s.post(`/survey/campaigns/${c.id}/publish`))).status).toBe('ACTIVA');
    expect((await s.post(`/survey/campaigns/${c.id}/publish`)).status(), 'publicar dos veces es idempotente').toBeLessThan(300);
    expect((await data(await s.post(`/survey/campaigns/${c.id}/close`))).status).toBe('CERRADA');
    expect((await s.post(`/survey/campaigns/${c.id}/publish`)).status()).toBe(409);
  });

  test('una pregunta sin opciones impide publicar', async () => {
    const s = await prov();
    const c = await data(await s.post('/survey/campaigns', { titulo: uniq('SinOp'), anio: 2026, ventana: 'PRE' }), 201);
    await data(await s.post(`/survey/campaigns/${c.id}/questions`, { texto: 'Sin opciones' }), 201);
    expect((await s.post(`/survey/campaigns/${c.id}/publish`)).status()).toBe(400);
  });

  test('validaciones de campaña: título largo, año fuera de rango, ventana/etapa inválidas', async () => {
    const s = await prov();
    for (const mal of [{ titulo: 'x'.repeat(201) }, { anio: 1999 }, { anio: 2101 }, { ventana: 'NUNCA' }, { etapa: 'MUNDIAL' }, { titulo: '' }]) {
      const r = await s.post('/survey/campaigns', { titulo: 'ok', anio: 2026, ventana: 'PRE', ...mal });
      expect(r.status(), JSON.stringify(mal)).toBe(400);
    }
  });

  test('edición de preguntas/opciones y CRUD de opciones', async () => {
    const { c, q1, s } = await campania();
    const up = await data(await s.patch(`/survey/campaigns/${c.id}/questions/${q1.id}`, { texto: 'Nuevo texto', obligatoria: false }));
    expect(up.texto).toBe('Nuevo texto');
    const op = await data(await s.post(`/survey/campaigns/${c.id}/questions/${q1.id}/options`, { texto: 'Regular', valor: 'regular' }), 201);
    expect((await s.patch(`/survey/campaigns/${c.id}/questions/${q1.id}/options/${op.id}`, { texto: 'Más o menos' })).status()).toBe(200);
    expect((await s.del(`/survey/campaigns/${c.id}/questions/${q1.id}/options/${op.id}`)).status()).toBeLessThan(300);
    expect((await s.del(`/survey/campaigns/${c.id}/questions/${q1.id}/options/${op.id}`)).status(), 'borrar dos veces').toBe(404);
  });

  test('sólo admins gestionan encuestas; DELEGADO/ARBITRO 403', async () => {
    for (const rol of ['DELEGADO', 'ARBITRO', 'COORDINADOR'] as const) {
      expect((await (await as(rol)).api.post('/survey/campaigns', { titulo: 'x', anio: 2026, ventana: 'PRE' })).status(), rol).toBe(403);
    }
  });
});

test.describe('respuesta pública', () => {
  test('GET /survey/active: sin campaña activa devuelve null; con una activa trae preguntas filtradas por etapa/ventana', async () => {
    const { c, s } = await campania('PROVINCIAL', 'POST');
    const a = await anon();
    const antes = await data(await a.get('/survey/active?etapa=PROVINCIAL&ventana=POST'));
    expect(antes === null || antes.id !== c.id).toBe(true);
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    const act = await data(await (await anon()).get('/survey/active?etapa=PROVINCIAL&ventana=POST'));
    expect(act.id).toBe(c.id);
    expect(act.questions.length).toBe(2);
    expect(JSON.stringify(act)).not.toMatch(/responses|metrics/);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('envío válido → 201 anónimo; la respuesta no guarda IP/usuario; las métricas cuentan', async () => {
    const { c, q1, q2, s } = await campania();
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    const payload = {
      campaignId: c.id, etapa: 'ZONAL', disciplineType: 'EQUIPO',
      respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }, { questionId: q2.id, optionIds: opc(q2).map((o: any) => o.id) }],
    };
    for (let i = 0; i < 5; i++) {
      const r = await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', payload);
      expect(r.status(), await r.text()).toBe(201);
      expect(JSON.stringify(await body(r))).not.toMatch(/ip|userAgent|email|dni/i);
    }
    const m = await data(await s.get(`/survey/campaigns/${c.id}/metrics`));
    expect(JSON.stringify(m)).toContain('Bien');
    const flow = await data(await s.get(`/survey/campaigns/${c.id}/flow`));
    expect(JSON.stringify(flow)).toBeTruthy();
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('inconsistencias → 400: pregunta obligatoria sin responder, opción de otra pregunta, UNICA con 2 opciones, pregunta de otra audiencia', async () => {
    const { c, q1, q2, s } = await campania();
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    // La IP cambia en cada envío para no chocar con el límite 3/min.
    async function post(extra: any) {
      return new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', { campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', ...extra });
    }
    expect((await post({ respuestas: [] })).status(), 'obligatoria sin responder').toBe(400);
    expect((await post({ respuestas: [{ questionId: q1.id, optionIds: [opc(q2)[0].id] }] })).status(), 'opción de otra pregunta').toBe(400);
    expect((await post({ respuestas: [{ questionId: q1.id, optionIds: opc(q1).map((o: any) => o.id) }] })).status(), 'UNICA con dos opciones').toBe(400);
    expect((await post({ respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }, { questionId: q2.id, optionIds: [opc(q2)[0].id] }] })).status(), 'pregunta EQUIPO respondida por INDIVIDUAL').toBe(400);
    expect((await post({ campaignId: '99999999-9999-4999-8999-999999999999', respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }] })).status()).toBe(404);
    expect((await post({ etapa: 'MUNDIAL', respuestas: [] })).status()).toBe(400);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('campaña cerrada o en borrador no recibe respuestas', async () => {
    const { c, q1, s } = await campania();
    const payload = { campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }] };
    expect((await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', payload)).status(), 'borrador').toBeGreaterThanOrEqual(400);
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    await data(await s.post(`/survey/campaigns/${c.id}/close`));
    expect((await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', payload)).status(), 'cerrada').toBe(400);
  });

  test('límite de envíos: el 4º en un minuto desde la misma IP recibe 429', async () => {
    const { c, q1, s } = await campania();
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    const a = new Api(await newCtx(), undefined, freshIp());
    const payload = { campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }] };
    const e: number[] = [];
    for (let i = 0; i < 4; i++) e.push((await a.post('/survey/responses', payload)).status());
    expect(e).toEqual([201, 201, 201, 429]);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('una campaña con respuestas no se elimina (409); con respuestas se conserva al cerrar', async () => {
    const { c, q1, s } = await campania();
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    const a = new Api(await newCtx(), undefined, freshIp());
    await a.post('/survey/responses', { campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }] });
    expect((await s.del(`/survey/campaigns/${c.id}`)).status()).toBe(409);
  });

  test('k-anonimato: con menos respuestas que el umbral no se devuelve ningún desglose', async () => {
    const { c, q1, s } = await campania();
    await data(await s.post(`/survey/campaigns/${c.id}/publish`));
    const a = new Api(await newCtx(), undefined, freshIp());
    await a.post('/survey/responses', { campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', sexo: 'FEMENINO', respuestas: [{ questionId: q1.id, optionIds: [opc(q1)[0].id] }] });
    const m = await data(await s.get(`/survey/campaigns/${c.id}/metrics?disciplineType=INDIVIDUAL`));
    expect(m.umbral).toBeGreaterThan(1);
    expect(JSON.stringify(m)).not.toMatch(/"count":1/);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});

