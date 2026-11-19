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

/**
 * En celular los filtros de los listados viven plegados detrás del botón
 * "Filtros" (FilterPanel). En celular espera el botón y despliega cada panel
 * cerrado; en escritorio (desde 768 px, `md`) no hace nada porque los controles
 * se muestran siempre.
 */
export async function abrirFiltros(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 768) return;
  const botones = page.getByRole('button', { name: /^Filtros/ });
  await expect(botones.first()).toBeVisible();
  for (const boton of await botones.all()) {
    if (!(await boton.isVisible())) continue;
    if ((await boton.getAttribute('aria-expanded')) !== 'true') await boton.click();
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
  }
}

/**
 * Filas visibles de un listado: las de la tabla en escritorio o las tarjetas
 * (`<ul aria-label="Lista de …">`) que DataTable muestra en celular.
 */
export const filas = (page: Page) =>
  page.locator('table tbody tr:visible, ul[aria-label^="Lista de"] > li:visible');
