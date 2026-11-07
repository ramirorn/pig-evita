import { expect, test as base, Page } from '@playwright/test';
import { freshIp, RoleName, roleEmail } from './api';
import { PASSWORD } from './env';

type Fixtures = {
  /** IP de cliente propia de este test (header x-test-ip sólo hacia /api/). */
  ip: string;
  /** Errores de consola y respuestas >= 500 vistas por la página durante el test. */
  problems: string[];
  loginAs: (role: RoleName) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  ip: async ({}, use) => use(freshIp()),
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on('response', (r) => {
      if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`);
    });
    await use(problems);
  },
  page: async ({ page, ip }, use) => {
    await page.route('**/api/v1/**', (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-test-ip': ip } }),
    );
    await use(page);
  },
  loginAs: async ({ page, ip }, use) => {
    await use(async (role: RoleName) => {
      const r = await page.request.post('/api/v1/auth/login', {
        data: { email: roleEmail(role), password: PASSWORD },
        headers: { 'x-test-ip': ip },
      });
      expect(r.status(), `login ${role}`).toBe(200);
    });
  },
});
export { expect };

/** Ignora ruido conocido y ajeno a la app (p. ej. favicon, mapas externos). */
export const relevantes = (problems: string[]) =>
  problems.filter((p) => !/favicon|tile\.openstreetmap|Failed to load resource: the server responded with a status of 4\d\d/.test(p));

/** Marca de desborde horizontal: en 375 px no debe haber scroll lateral. */
export async function sinDesbordeHorizontal(page: Page) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(w.sw, `scrollWidth ${w.sw} > clientWidth ${w.cw}`).toBeLessThanOrEqual(w.cw + 1);
}

/** Elige una opción en un selector propio (Radix): abre el combobox y hace clic en la opción por nombre. */
export async function elegir(page: Page, combo: import('@playwright/test').Locator, opcion: string | RegExp) {
  await combo.click();
  await page.getByRole('option', { name: opcion }).first().click();
}
