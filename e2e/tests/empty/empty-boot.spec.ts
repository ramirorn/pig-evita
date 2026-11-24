// Primer arranque con la base VACÍA (SEED_ON_START=false): migraciones aplicadas, sin usuarios ni datos.
// Se corre con E2E_EMPTY=1 contra un stack recién creado (ver `npm run stack:empty`).
import { expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';
import { Api, body, newCtx } from '../../lib/api';

const PUBLICAS = ['/', '/disciplinas', '/noticias', '/calendario', '/sedes', '/rankings', '/mapa', '/encuesta', '/encuesta/responder', '/inscripcion'];

test.describe('API con la base vacía', () => {
  test('health ok y los listados públicos devuelven vacío (no 500)', async () => {
    const api = new Api(await newCtx());
    expect((await api.get('/health')).status()).toBe(200);
    for (const ruta of ['/disciplines', '/categories', '/venues', '/news', '/calendar', '/competitions']) {
      const r = await api.get(ruta);
      expect(r.status(), ruta).toBe(200);
      expect((await body(r)).data, ruta).toEqual([]);
    }
    const stats = await body(await api.get('/stats/localities'));
    expect(stats.data.localities).toEqual([]);
    expect((await body(await api.get('/survey/active'))).data).toBeNull();
  });

  test('sin usuarios no se puede iniciar sesión (401, no 500) y las rutas privadas piden token', async () => {
    const api = new Api(await newCtx());
    expect((await api.post('/auth/login', { email: 'admin@evita-e2e.test', password: 'Cualquiera-123' })).status()).toBe(401);
    expect((await api.get('/participants')).status()).toBe(401);
  });
});

test.describe('sitio público con la base vacía', () => {
  for (const ruta of PUBLICAS) {
    test(`${ruta} se ve con estados vacíos, sin errores ni desborde`, async ({ page, problems }) => {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText(/undefined|NaN|\[object Object\]/);
      await expect(page.locator('header, nav').first()).toBeVisible();
      await sinDesbordeHorizontal(page);
      expect(relevantes(problems), relevantes(problems).join('\n')).toEqual([]);
    });
  }

  test('el mapa explica que todavía no hay participación (sin círculos ni errores)', async ({ page }) => {
    await page.goto('/mapa');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/Mapa de los Juegos/);
    await expect(page.locator('body')).not.toContainText(/Infinity|NaN/);
  });

  test('la encuesta sin campaña activa lo dice con claridad', async ({ page }) => {
    await page.goto('/encuesta/responder');
    await expect(page.locator('main, body').first()).toContainText(/no hay|todavía|disponible|abierta/i);
  });
});

test.describe('panel con la base vacía', () => {
  test('el login con cualquier credencial muestra un error claro (no se cuelga)', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#login-email').fill('admin@evita-e2e.test');
    await page.locator('#login-password').fill('Cualquiera-123');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('las rutas del panel sin sesión redirigen al login', async ({ page }) => {
    for (const r of ['/admin', '/admin/dashboard', '/admin/participantes']) {
      await page.goto(r);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });
});
