// Métricas de la encuesta contra el stack real: catálogo territorial público,
// localidad en la respuesta, versión en vivo, k-anonimato en el cruce, KPIs y
// permisos por rol.
import { expect, test } from '@playwright/test';
import { Api, anon, as, body, data, freshIp, newCtx, uniq } from '../../lib/api';

const prov = async () => (await as('ADMIN_PROVINCIAL')).api;

/** Campaña publicada con dos preguntas para todos. */
async function campaniaPublicada() {
  const s = await prov();
  const c = await data(
    await s.post('/survey/campaigns', { titulo: uniq('Metr'), anio: 2026, ventana: 'DURANTE', etapa: 'ZONAL' }),
    201,
  );
  const lesion = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Te lesionaste?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true,
      opciones: [
        { texto: 'No', valor: `no_${c.id.slice(0, 6)}` },
        { texto: 'Sí, atendido', valor: `si_atendido_${c.id.slice(0, 6)}` },
        { texto: 'Sí, sin atención', valor: `si_sin_atencion_${c.id.slice(0, 6)}` },
      ],
    }),
    201,
  );
  const estudios = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Seguís estudiando?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true,
      opciones: [
        { texto: 'Sí', valor: `seguir_${c.id.slice(0, 6)}` },
        { texto: 'No', valor: `dejar_${c.id.slice(0, 6)}` },
      ],
    }),
    201,
  );
  await data(await s.post(`/survey/campaigns/${c.id}/publish`));
  return { c, lesion, estudios, s };
}

const opciones = (q: any) => q.options ?? q.opciones;

async function responder(campaignId: string, respuestas: { questionId: string; optionIds: string[] }[], localityId?: string) {
  const r = await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', {
    campaignId, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL', localityId, respuestas,
  });
  expect(r.status(), await r.text()).toBe(201);
}

test.describe('catálogo territorial público', () => {
  test('GET /localities sin sesión: departamentos con localidades y la capital marcada', async () => {
    const api = await anon();
    const catalogo = await data(await api.get('/localities'));
    expect(Array.isArray(catalogo)).toBe(true);
    const formosa = catalogo.find((d: any) => d.name === 'Formosa');
    expect(formosa, 'el seed carga el departamento Formosa').toBeTruthy();
    const capital = formosa.localities.find((l: any) => l.name === 'Formosa');
    expect(capital?.zona).toBe('CAPITAL');
    for (const d of catalogo) {
      for (const l of d.localities) {
        expect(Object.keys(l).sort()).toEqual(['id', 'name', 'zona']);
        if (!(d.name === 'Formosa' && l.name === 'Formosa')) expect(l.zona).toBe('INTERIOR');
      }
    }
  });
});

test.describe('métricas en vivo', () => {
  test('la respuesta guarda la localidad, la versión sube y el cruce por zona respeta el umbral', async () => {
    const { c, lesion, estudios, s } = await campaniaPublicada();
    const catalogo = await data(await (await anon()).get('/localities'));
    const capital = catalogo.find((d: any) => d.name === 'Formosa').localities.find((l: any) => l.name === 'Formosa');
    const interior = catalogo.find((d: any) => d.name !== 'Formosa' && d.localities.length > 0).localities[0];

    const v0 = (await data(await s.get(`/metrics/survey/${c.id}/version`))).version;

    // 8 del interior (sin atención) y 2 de la capital (atendidos): 10, dos tandas.
    for (let i = 0; i < 8; i++) {
      await responder(c.id, [
        { questionId: lesion.id, optionIds: [opciones(lesion)[2].id] },
        { questionId: estudios.id, optionIds: [opciones(estudios)[1].id] },
      ], interior.id);
    }
    for (let i = 0; i < 2; i++) {
      await responder(c.id, [
        { questionId: lesion.id, optionIds: [opciones(lesion)[1].id] },
        { questionId: estudios.id, optionIds: [opciones(estudios)[0].id] },
      ], capital.id);
    }

    const v1 = (await data(await s.get(`/metrics/survey/${c.id}/version`))).version;
    expect(v1, 'cada tanda de 5 respuestas sube la versión').toBeGreaterThan(v0);

    const overview = await data(await s.get(`/metrics/survey/${c.id}/overview`));
    expect(overview.totalRespuestas).toEqual({ suprimido: false, conteo: 10 });
    const porZona = Object.fromEntries(overview.porZona.map((z: any) => [z.zona, z]));
    // Capital 2 y total 10: con el interior visible, 10 − 8 despejaría la
    // capital; por eso el interior también se oculta (supresión por masa).
    expect(porZona.INTERIOR).toMatchObject({ suprimido: true, conteo: null });
    expect(porZona.CAPITAL).toMatchObject({ suprimido: true, conteo: null });

    const cruce = await data(await s.get(`/metrics/survey/${c.id}/cross?pregunta=${lesion.id}&por=zona`));
    const filaInterior = cruce.filas.find((f: any) => f.clave === 'INTERIOR');
    const filaCapital = cruce.filas.find((f: any) => f.clave === 'CAPITAL');
    expect(filaInterior.totalFila, 'mismo criterio que el resumen por zona').toMatchObject({ suprimido: true, conteo: null });
    expect(filaCapital.totalFila, 'dos respuestas de la capital no se publican').toMatchObject({ suprimido: true, conteo: null });
    expect(JSON.stringify(filaCapital)).not.toContain('"conteo":2');

    // Filtrar por interior tampoco se publica: en el cruce por zona su fila
    // está oculta (10 − 8 despejaría la capital), y el filtro sigue esa regla.
    const soloInterior = await data(await s.get(`/metrics/survey/${c.id}/overview?zona=INTERIOR`));
    expect(soloInterior.totalRespuestas).toMatchObject({ suprimido: true, conteo: null });

    // Más de 2 filtros a la vez: 400.
    const tres = await s.get(`/metrics/survey/${c.id}/overview?zona=INTERIOR&sexo=FEMENINO&etapa=ZONAL`);
    expect(tres.status()).toBe(400);
    expect(await tres.text()).toContain('hasta 2 filtros');

    // Cada consulta a las métricas queda registrada: quién y con qué filtros.
    const auditoria = await body(await (await prov()).get(`/audit?action=READ_METRICS&entityId=${c.id}&limit=50`));
    expect(
      auditoria.data.some((fila: any) => fila.changes?.zona === 'INTERIOR'),
      'la consulta filtrada por interior quedó en la auditoría',
    ).toBe(true);

    // La capital tiene 2: su total no se publica y su cruce no deja ceros
    // que permitan despejar por resta qué contestaron.
    const soloCapital = await data(await s.get(`/metrics/survey/${c.id}/overview?zona=CAPITAL`));
    expect(soloCapital.totalRespuestas).toMatchObject({ suprimido: true, conteo: null });
    const cruceCapital = await data(await s.get(`/metrics/survey/${c.id}/cross?pregunta=${lesion.id}&por=ventana&zona=CAPITAL`));
    expect(cruceCapital.totalRespuestas).toMatchObject({ suprimido: true, conteo: null });
    expect(cruceCapital.filas, 'sin una tanda completa no sale ninguna fila').toEqual([]);

    // Una respuesta más (la 11.ª) no cambia nada hasta completar la tanda.
    await responder(c.id, [
      { questionId: lesion.id, optionIds: [opciones(lesion)[2].id] },
      { questionId: estudios.id, optionIds: [opciones(estudios)[1].id] },
    ], interior.id);
    const otraVez = await data(await s.get(`/metrics/survey/${c.id}/overview`));
    expect(otraVez.totalRespuestas, 'la 11.ª espera a la tanda siguiente').toEqual({ suprimido: false, conteo: 10 });

    // Un rango con hora se redondea al día: no aísla minutos.
    const hoy = new Date().toISOString().slice(0, 10);
    const ahora = new Date().toISOString();
    const conHora = await data(await s.get(`/metrics/survey/${c.id}/overview?desde=${encodeURIComponent(ahora)}&hasta=${encodeURIComponent(ahora)}`));
    expect(conHora.filtros).toMatchObject({ desde: hoy, hasta: hoy });
    expect(conHora.totalRespuestas).toEqual({ suprimido: false, conteo: 10 });

    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('cruce: dimensión inválida → 400; pregunta ajena → 404', async () => {
    const { c, lesion, s } = await campaniaPublicada();
    expect((await s.get(`/metrics/survey/${c.id}/cross?pregunta=${lesion.id}&por=edad`)).status()).toBe(400);
    expect((await s.get(`/metrics/survey/${c.id}/cross?pregunta=${c.id}&por=zona`)).status()).toBe(404);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});

test.describe('KPIs', () => {
  test('crear, evaluar, editar y borrar un indicador; el cociente sólo se publica con ambos lados visibles', async () => {
    const { c, lesion, estudios, s } = await campaniaPublicada();
    const [no, atendido, sinAtencion] = opciones(lesion);
    // Las dos preguntas son obligatorias: cada envío contesta también la de estudios.
    const sigue = { questionId: estudios.id, optionIds: [opciones(estudios)[0].id] };
    for (let i = 0; i < 6; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [atendido.id] }, sigue]);
    for (let i = 0; i < 5; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [sinAtencion.id] }, sigue]);
    // 6 + 5 + 4 = 15: tres tandas completas, todo publicado.
    for (let i = 0; i < 4; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [no.id] }, sigue]);

    expect(
      (await s.post('/metrics/kpis', { nombre: 'Malo', definicion: { numerador: [], denominador: 'todas', formato: 'conteo' } })).status(),
      'definición sin numerador',
    ).toBe(400);

    const kpi = await data(
      await s.post('/metrics/kpis', {
        campaignId: c.id,
        nombre: uniq('Atendidos'),
        definicion: {
          numerador: [{ valores: [atendido.valor] }],
          denominador: [{ valores: [atendido.valor, sinAtencion.valor] }],
          formato: 'porcentaje',
        },
      }),
      201,
    );

    const evaluados = await data(await s.get(`/metrics/survey/${c.id}/kpis`));
    const propio = evaluados.kpis.find((k: any) => k.id === kpi.id);
    expect(propio).toMatchObject({ numerador: { conteo: 6 }, denominador: { conteo: 11 }, valor: 54.5 });

    // Con un filtro que deja el corte chico, el valor no se publica.
    const chico = await data(await s.get(`/metrics/survey/${c.id}/kpis?zona=CAPITAL`));
    expect(chico.kpis.find((k: any) => k.id === kpi.id).valor).toBeNull();

    await data(await s.patch(`/metrics/kpis/${kpi.id}`, { nombre: `${kpi.nombre} (editado)` }));
    expect((await s.del(`/metrics/kpis/${kpi.id}`)).status()).toBeLessThan(300);
    const despues = await data(await s.get(`/metrics/survey/${c.id}/kpis`));
    expect(despues.kpis.some((k: any) => k.id === kpi.id)).toBe(false);

    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});

test.describe('destacados', () => {
  test('ranking publicable, sin opciones chicas, y ABM sólo para quien gestiona la encuesta', async () => {
    const { c, lesion, estudios, s } = await campaniaPublicada();
    const [no, atendido, sinAtencion] = opciones(lesion);
    const sigue = { questionId: estudios.id, optionIds: [opciones(estudios)[0].id] };
    // 24 No, 9 atendidos, 2 sin atención (base 35): el 2 se oculta y, como la
    // pregunta es de opción única, también el 9 (35 − 24 lo despejaría).
    for (let i = 0; i < 24; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [no.id] }, sigue]);
    for (let i = 0; i < 9; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [atendido.id] }, sigue]);
    for (let i = 0; i < 2; i++) await responder(c.id, [{ questionId: lesion.id, optionIds: [sinAtencion.id] }, sigue]);

    const coord = (await as('COORDINADOR')).api;
    const definicion = { opciones: [no.valor, atendido.valor, sinAtencion.valor], top: 3 };
    expect((await coord.post('/metrics/highlights', { titulo: 'X', definicion })).status()).toBe(403);
    expect((await s.post('/metrics/highlights', { titulo: 'Sin opciones', definicion: { opciones: [], top: 3 } })).status()).toBe(400);

    const destacado = await data(
      await s.post('/metrics/highlights', { campaignId: c.id, titulo: uniq('Lesiones'), definicion }),
      201,
    );
    const res = await data(await coord.get(`/metrics/survey/${c.id}/highlights`));
    const propio = res.destacados.find((d: any) => d.id === destacado.id);
    expect(propio.base).toMatchObject({ suprimido: false, conteo: 35 });
    expect(propio.opciones.map((o: any) => o.valor)).toEqual([no.valor]);
    expect(propio.ocultas).toBe(2);
    expect(propio.puedeAfirmar).toBe(true);
    expect(JSON.stringify(propio)).not.toMatch(/"conteo":(2|9)[,}]/);

    expect((await s.del(`/metrics/highlights/${destacado.id}`)).status()).toBeLessThan(300);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});

test.describe('permisos', () => {
  test('COORDINADOR lee métricas pero no edita KPIs; DELEGADO y anónimo no entran', async () => {
    const { c, s } = await campaniaPublicada();
    const coord = (await as('COORDINADOR')).api;
    expect((await coord.get('/metrics/catalog')).status()).toBe(200);
    expect((await coord.get(`/metrics/survey/${c.id}/overview`)).status()).toBe(200);
    expect(
      (await coord.post('/metrics/kpis', { nombre: 'X', definicion: { numerador: [{ valores: ['a'] }], denominador: 'todas', formato: 'conteo' } })).status(),
    ).toBe(403);

    const delegado = (await as('DELEGADO')).api;
    expect((await delegado.get('/metrics/catalog')).status()).toBe(403);
    expect((await (await anon()).get('/metrics/catalog')).status()).toBe(401);

    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});
