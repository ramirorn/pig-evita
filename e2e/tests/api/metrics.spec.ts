// Métricas de la encuesta contra el stack real: catálogo territorial público,
// localidad en la respuesta, versión en vivo, k-anonimato en el cruce, KPIs y
// permisos por rol.
import { expect, test } from '@playwright/test';
import { Api, anon, as, data, freshIp, newCtx, uniq } from '../../lib/api';

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

    // 5 del interior (sin atención) y 2 de la capital (atendidos).
    for (let i = 0; i < 5; i++) {
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
    expect(v1, 'cada respuesta sube la versión').toBeGreaterThan(v0);

    const overview = await data(await s.get(`/metrics/survey/${c.id}/overview`));
    expect(overview.totalRespuestas).toBe(7);
    const porZona = Object.fromEntries(overview.porZona.map((z: any) => [z.zona, z]));
    expect(porZona.INTERIOR).toMatchObject({ suprimido: false, conteo: 5 });
    expect(porZona.CAPITAL).toMatchObject({ suprimido: true, conteo: null });

    const cruce = await data(await s.get(`/metrics/survey/${c.id}/cross?pregunta=${lesion.id}&por=zona`));
    const filaInterior = cruce.filas.find((f: any) => f.clave === 'INTERIOR');
    const filaCapital = cruce.filas.find((f: any) => f.clave === 'CAPITAL');
    expect(filaInterior.totalFila).toMatchObject({ suprimido: false, conteo: 5 });
    expect(filaCapital.totalFila, 'dos respuestas de la capital no se publican').toMatchObject({ suprimido: true, conteo: null });
    expect(JSON.stringify(filaCapital)).not.toContain('"conteo":2');

    // Filtrar por zona en el backend da lo mismo que la fila del cruce.
    const soloInterior = await data(await s.get(`/metrics/survey/${c.id}/overview?zona=INTERIOR`));
    expect(soloInterior.totalRespuestas).toBe(5);

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
    await responder(c.id, [{ questionId: lesion.id, optionIds: [no.id] }, sigue]);

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
