// Panel de Métricas: tarjetas, destacados en lenguaje simple, pregunta en
// foco por departamento, constructor plegado, modo presentación y supresión
// por k-anonimato en vez de ceros.
import { Api, anon, as, data, freshIp, newCtx, uniq } from '../../lib/api';
import { expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

const NECESIDADES = ['transporte', 'indumentaria', 'entrenador', 'lugar'];

/**
 * Campaña publicada con una pregunta de opción única y una de necesidades
 * (múltiple). Las respuestas se reparten entre las localidades indicadas.
 */
async function campaniaConRespuestas(cantidad: number, localidades: (string | undefined)[] = [undefined]) {
  const s = (await as('ADMIN_PROVINCIAL')).api;
  const c = await data(
    await s.post('/survey/campaigns', { titulo: uniq('MetrUI'), anio: 2026, ventana: 'DURANTE', etapa: 'ZONAL' }),
    201,
  );
  const sufijo = c.id.slice(0, 6);
  const q = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Cómo te fue?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true,
      opciones: [{ texto: 'Bien', valor: `bien_${sufijo}` }, { texto: 'Mal', valor: `mal_${sufijo}` }],
    }),
    201,
  );
  const nec = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Qué necesitás?', kind: 'MULTIPLE', audiencia: 'TODOS', obligatoria: true,
      opciones: NECESIDADES.map((n) => ({ texto: n[0]!.toUpperCase() + n.slice(1), valor: `nec_${n}_${sufijo}` })),
    }),
    201,
  );
  await data(await s.post(`/survey/campaigns/${c.id}/publish`));
  const opcionesQ = q.options ?? q.opciones;
  const opcionesNec = nec.options ?? nec.opciones;
  for (let i = 0; i < cantidad; i++) {
    // Transporte lo elige casi la mitad; el resto se reparte.
    const necesidad = opcionesNec[i % 9 < 4 ? 0 : 1 + (i % 3)];
    const r = await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', {
      campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL',
      localityId: localidades[i % localidades.length],
      respuestas: [
        { questionId: q.id, optionIds: [opcionesQ[i % 2].id] },
        { questionId: nec.id, optionIds: [necesidad.id] },
      ],
    });
    expect(r.status(), await r.text()).toBe(201);
  }
  return { c, s, nec: opcionesNec as { valor: string }[] };
}

test.describe('panel de Métricas', () => {
  test('con respuestas: tarjetas, indicador en vivo y constructor plegado', async ({ page, loginAs, problems }) => {
    const { c, s } = await campaniaConRespuestas(6);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/metricas?campania=${c.id}`);

    await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible();
    await expect(page.getByTestId('metricas-total')).toHaveText('6');
    await expect(page.getByRole('heading', { name: 'Indicadores' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lo más importante' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /En vivo/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Presentar' })).toHaveAttribute('href', new RegExp(`campania=${c.id}`));

    // El constructor arranca plegado y se abre a pedido.
    await expect(page.getByRole('heading', { name: 'Explorar las respuestas' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Explorar en detalle' }).click();
    await expect(page.getByRole('heading', { name: 'Explorar las respuestas' })).toBeVisible();
    // El gráfico (chunk lazy de recharts) termina dibujándose.
    await expect(page.getByTestId('metrics-chart').locator('svg').first()).toBeVisible({ timeout: 15_000 });
    // Nunca se muestra "null" ni "undefined".
    await expect(page.locator('main')).not.toContainText(/\bnull\b|\bundefined\b/);
    expect(relevantes(problems)).toEqual([]);

    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('un corte chico se informa como "sin publicar", no como cero', async ({ page, loginAs }) => {
    const { c, s } = await campaniaConRespuestas(2);
    await loginAs('COORDINADOR');
    await page.goto(`/admin/metricas?campania=${c.id}`);
    // Dos respuestas: ni el total se publica (con el total, los ceros despejarían la celda oculta).
    await expect(page.getByTestId('metricas-total')).toContainText('Sin publicar');
    await expect(page.locator('main')).toContainText(/anonimato|sin publicar|Sin publicar/i);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('destacado: ranking con frase en lenguaje simple y modo presentación', async ({ page, loginAs, problems }) => {
    test.setTimeout(120_000);
    const { c, s, nec } = await campaniaConRespuestas(36);
    const titulo = uniq('Lo que más necesitan');
    const destacado = await data(
      await s.post('/metrics/highlights', {
        campaignId: c.id,
        titulo,
        definicion: { opciones: nec.map((o) => o.valor), top: 3 },
      }),
      201,
    );
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/metricas?campania=${c.id}`);

    const tarjeta = page.getByRole('article').filter({ hasText: titulo });
    await expect(tarjeta).toBeVisible();
    // 16 de 36 eligieron transporte (44 %): la frase no exagera a "la mitad".
    await expect(tarjeta).toContainText('4 de cada 10 eligieron «Transporte»');
    await expect(tarjeta).toContainText(/Sobre 36 respuestas · datos al \d\d\/\d\d \d\d:\d\d/);
    await expect(tarjeta.getByRole('list', { name: 'Ranking' }).getByRole('listitem')).toHaveCount(3);

    // El modo presentación, sin menú lateral, con el mismo corte.
    const href = await page.getByRole('link', { name: 'Presentar' }).getAttribute('href');
    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(c.titulo);
    await expect(page.getByRole('article').filter({ hasText: titulo })).toContainText('4 de cada 10');
    await expect(page.getByRole('link', { name: 'Salir de la presentación' })).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    expect(relevantes(problems)).toEqual([]);

    await s.del(`/metrics/highlights/${destacado.id}`);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('por departamento: barras horizontales con los nombres sin encimarse', async ({ page, loginAs }) => {
    test.setTimeout(120_000);
    const catalogo = await data(await (await anon()).get('/localities'));
    const localidades = catalogo
      .filter((d: any) => d.localities.length > 0)
      .slice(0, 8)
      .map((d: any) => d.localities[0].id);
    expect(localidades.length, 'el seed carga al menos 6 departamentos con localidades').toBeGreaterThanOrEqual(6);
    const { c, s } = await campaniaConRespuestas(localidades.length * 5, localidades);

    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/metricas?campania=${c.id}`);
    const nombres = catalogo
      .filter((d: any) => d.localities.length > 0)
      .slice(0, 8)
      .map((d: any) => d.name as string);
    const tarjeta = page.locator('section[aria-labelledby="titulo-territorio"]');
    // Las etiquetas del eje son los nombres de los departamentos (o su recorte).
    const etiquetas = tarjeta
      .locator('svg text')
      .filter({ hasText: new RegExp(`^(${nombres.map((n: string) => n.slice(0, 6)).join('|')})`) });
    await expect(etiquetas.first()).toBeVisible({ timeout: 15_000 });
    const cajas = await etiquetas.evaluateAll((nodos) =>
      nodos.map((n) => {
        const r = (n as SVGGraphicsElement).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
    );
    expect(cajas.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < cajas.length; i++) {
      for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i]!;
        const b = cajas[j]!;
        const seCruzan = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(seCruzan, `etiquetas ${i} y ${j} encimadas`).toBe(false);
      }
    }
    await sinDesbordeHorizontal(page);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});
