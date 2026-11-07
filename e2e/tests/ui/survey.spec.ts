// Encuesta pública: landing, cuestionario por QR, validaciones, borrador y cola sin conexión.
import { knownBug } from '../../lib/bugs';
import { Api, as, data, newCtx, uniq } from '../../lib/api';
import { elegir, expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

const prov = async () => (await as('ADMIN_PROVINCIAL')).api;

async function cerrarActivas(s: Api) {
  const activas = await data(await s.get('/survey/campaigns?status=ACTIVA&limit=100'));
  for (const c of activas) await s.post(`/survey/campaigns/${c.id}/close`);
}
async function campaniaActiva(s: Api) {
  await cerrarActivas(s);
  const c = await data(await s.post('/survey/campaigns', { titulo: uniq('UI'), anio: 2026, ventana: 'PRE', etapa: 'ZONAL' }), 201);
  await data(await s.post(`/survey/campaigns/${c.id}/questions`, { texto: '¿Cómo llegás hoy?', kind: 'UNICA', audiencia: 'TODOS', obligatoria: true, opciones: [{ texto: 'Tranquilo', valor: 'tranquilo' }, { texto: 'Nervioso', valor: 'nervioso' }] }), 201);
  await data(await s.post(`/survey/campaigns/${c.id}/questions`, { texto: '¿Qué te preocupa del equipo?', kind: 'MULTIPLE', audiencia: 'EQUIPO', obligatoria: false, opciones: [{ texto: 'Perder', valor: 'perder' }] }), 201);
  await data(await s.post(`/survey/campaigns/${c.id}/publish`));
  return c;
}
const total = async (s: Api, id: string) => (await data(await s.get(`/survey/campaigns/${id}/metrics`))).totalRespuestas as number;

test.describe.configure({ mode: 'serial' });

test.describe('encuesta pública', () => {
  test('landing: explica la encuesta y el botón lleva al formulario', async ({ page, problems }) => {
    await page.goto('/encuesta');
    await expect(page.getByText(/la cabeza también entrena/)).toBeVisible();
    await sinDesbordeHorizontal(page);
    await page.getByRole('link', { name: /Responder la encuesta/ }).first().click();
    await expect(page).toHaveURL(/\/encuesta\/responder$/);
    expect(relevantes(problems)).toEqual([]);
  });

  test('sin campaña activa el formulario lo dice con claridad (no queda en blanco)', async ({ page }) => {
    await cerrarActivas(await prov());
    await page.goto('/encuesta/responder');
    await expect(page.locator('main, body').first()).toContainText(/no hay|todavía|cerrad|disponible|abierta/i);
  });

  test('flujo completo: contexto → preguntas filtradas por audiencia → gracias, y la respuesta llega al servidor', async ({ page }) => {
    const s = await prov();
    const c = await campaniaActiva(s);
    const antes = await total(s, c.id);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), 'Ajedrez');
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await expect(page.locator('fieldset', { hasText: '¿Cómo llegás hoy?' })).toBeVisible();
    // Ajedrez es individual: la pregunta de EQUIPO no se muestra
    await expect(page.locator('fieldset', { hasText: '¿Qué te preocupa del equipo?' })).toHaveCount(0);
    await sinDesbordeHorizontal(page);
    await page.getByLabel('Tranquilo').check();
    await page.getByRole('button', { name: /Mandar mis respuestas/ }).click();
    await expect(page.getByText('¡Gracias por contestar!')).toBeVisible();
    await expect.poll(() => total(s, c.id)).toBe(antes + 1);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('para una disciplina de EQUIPO aparece la pregunta de equipo', async ({ page }) => {
    const s = await prov();
    const c = await campaniaActiva(s);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), /Fútbol 11/);
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await expect(page.locator('fieldset', { hasText: '¿Qué te preocupa del equipo?' })).toBeVisible();
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('enviar sin contestar lo obligatorio marca la pregunta y no envía', async ({ page }) => {
    const s = await prov();
    const c = await campaniaActiva(s);
    const antes = await total(s, c.id);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), 'Ajedrez');
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await page.getByRole('button', { name: /Mandar mis respuestas/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: /hay que contestarla/ })).toBeVisible();
    expect(await total(s, c.id)).toBe(antes);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('borrador: lo contestado sobrevive a recargar la página', async ({ page }) => {
    const s = await prov();
    const c = await campaniaActiva(s);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), 'Ajedrez');
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await page.getByLabel('Nervioso').check();
    await page.reload();
    await expect(page.getByText(/Recuperamos lo que habías contestado/)).toBeVisible();
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await expect(page.getByLabel('Nervioso')).toBeChecked();
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('red caída (la request falla): la respuesta queda en cola en el teléfono y se envía sola al volver la señal', async ({ page }) => {
    const s = await prov();
    const c = await campaniaActiva(s);
    const antes = await total(s, c.id);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), 'Ajedrez');
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await page.getByLabel('Tranquilo').check();
    // Un corte "a medias": el navegador cree estar en línea pero la request no llega.
    const corte = (route: import('@playwright/test').Route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.fallback());
    await page.route('**/api/v1/survey/responses', corte);
    await page.getByRole('button', { name: /Mandar mis respuestas/ }).click();
    await expect(page.getByText('Quedaron guardadas en este teléfono')).toBeVisible();
    const cola = await page.evaluate(() => localStorage.getItem('evita_encuesta_pendientes_v1'));
    expect(cola && JSON.parse(cola).length).toBe(1);
    expect(await total(s, c.id)).toBe(antes);
    await page.unroute('**/api/v1/survey/responses', corte);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => total(s, c.id), { timeout: 30_000 }).toBe(antes + 1);
    await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('evita_encuesta_pendientes_v1'))) ?? '[]').length).toBe(0);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });

  test('sin conexión real (navigator.onLine=false): la respuesta se encola en el teléfono, no queda "Mandando…" para siempre', async ({ page, context }) => {
    knownBug('F-27: sin conexión la mutación de TanStack Query queda en pausa ("Mandando…") y nunca llega a encolarse en localStorage; si se cierra la pestaña, la respuesta se pierde');
    const s = await prov();
    const c = await campaniaActiva(s);
    await page.goto('/encuesta/responder');
    await elegir(page, page.locator('#survey-disciplina'), 'Ajedrez');
    await page.getByRole('button', { name: /Empezar la encuesta/ }).click();
    await page.getByLabel('Tranquilo').check();
    await context.setOffline(true);
    await page.getByRole('button', { name: /Mandar mis respuestas/ }).click();
    await expect(page.getByText('Quedaron guardadas en este teléfono')).toBeVisible({ timeout: 5000 });
    await context.setOffline(false);
    await s.post(`/survey/campaigns/${c.id}/close`);
  });
});
void newCtx;
