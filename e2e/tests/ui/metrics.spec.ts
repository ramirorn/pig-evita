// Panel de Métricas: carga con una campaña con respuestas, muestra indicadores
// y un gráfico, y explica la supresión por k-anonimato en vez de pintar ceros.
import { Api, as, data, freshIp, newCtx, uniq } from '../../lib/api';
import { expect, relevantes, test } from '../../lib/ui';

async function campaniaConRespuestas(cantidad: number) {
  const s = (await as('ADMIN_PROVINCIAL')).api;
  const c = await data(
    await s.post('/survey/campaigns', { titulo: uniq('MetrUI'), anio: 2026, ventana: 'DURANTE', etapa: 'ZONAL' }),
    201,
  );
  const q = await data(
    await s.post(`/survey/campaigns/${c.id}/questions`, {
      texto: '¿Cómo te fue?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true,
      opciones: [{ texto: 'Bien', valor: 'bien_ui' }, { texto: 'Mal', valor: 'mal_ui' }],
    }),
    201,
  );
  await data(await s.post(`/survey/campaigns/${c.id}/publish`));
  const opcion = (q.options ?? q.opciones)[0].id;
  for (let i = 0; i < cantidad; i++) {
    const r = await new Api(await newCtx(), undefined, freshIp()).post('/survey/responses', {
      campaignId: c.id, etapa: 'ZONAL', disciplineType: 'INDIVIDUAL',
      respuestas: [{ questionId: q.id, optionIds: [opcion] }],
    });
    expect(r.status()).toBe(201);
  }
  return { c, s };
}

test.describe('panel de Métricas', () => {
  test('con respuestas: resumen, indicadores, constructor de gráficos e indicador en vivo', async ({ page, loginAs, problems }) => {
    const { c, s } = await campaniaConRespuestas(6);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/metricas?campania=${c.id}`);

    await expect(page.getByRole('heading', { name: 'Métricas', level: 1 })).toBeVisible();
    await expect(page.getByTestId('metricas-total')).toHaveText('6');
    await expect(page.getByRole('heading', { name: 'Indicadores' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Explorar las respuestas' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /En vivo/ })).toBeVisible();
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
    await expect(page.getByTestId('metricas-total')).toHaveText('2');
    await expect(page.locator('main')).toContainText(/anonimato|sin publicar|Sin publicar/i);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});
