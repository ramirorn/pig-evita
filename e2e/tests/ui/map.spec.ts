// Mapa de impacto: datos, zoom, restablecer, detalle de localidad y pantalla completa NATIVA.
import { expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

test.describe('mapa público /mapa', () => {
  test('muestra totales, el mapa SVG y la tabla con los mismos datos', async ({ page, problems }) => {
    await page.goto('/mapa');
    await expect(page.getByRole('img', { name: /Mapa de calor de/ }).or(page.locator('svg[aria-label^="Mapa de calor"]')).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Totales de la provincia' }).or(page.locator('[aria-label="Totales de la provincia"]'))).toBeVisible();
    await expect(page.getByText('Clorinda').first()).toBeVisible();
    await sinDesbordeHorizontal(page);
    expect(relevantes(problems)).toEqual([]);
  });

  test('zoom: Acercar / Alejar / Restablecer cambian la vista y respetan los límites', async ({ page }) => {
    await page.goto('/mapa');
    const grupo = page.getByRole('group', { name: 'Zoom del mapa' });
    const acercar = grupo.getByRole('button', { name: 'Acercar' });
    const alejar = grupo.getByRole('button', { name: 'Alejar' });
    const reset = grupo.getByRole('button', { name: 'Restablecer vista' });
    await expect(acercar).toBeVisible();
    await expect(alejar).toBeDisabled();
    await expect(reset).toBeDisabled();
    const aviso = page.locator('p.sr-only[aria-live="polite"]');
    await expect(aviso).toContainText(/provincia entera/);
    await acercar.click();
    await expect(aviso).toContainText(/Zoom/);
    await expect(alejar).toBeEnabled();
    await expect(reset).toBeEnabled();
    // hasta el máximo: el botón se deshabilita
    for (let i = 0; i < 30 && (await acercar.isEnabled()); i++) await acercar.click({ timeout: 1500 }).catch(() => undefined); // puede deshabilitarse justo antes del clic
    await expect(acercar).toBeDisabled();
    await reset.click();
    await expect(aviso).toContainText(/provincia entera/);
    await expect(alejar).toBeDisabled();
  });

  test('seleccionar una localidad abre su detalle y se puede cerrar', async ({ page }) => {
    await page.goto('/mapa');
    const nodo = page.getByRole('button', { name: /^Clorinda, / });
    await nodo.scrollIntoViewIfNeeded();
    await nodo.click();
    await expect(page.getByText(/Clorinda/).first()).toBeVisible();
    // Escritorio: el detalle va en el panel lateral ("Volver al Top 5"); celular: ventana con "Cerrar el detalle de …".
    const salida = page.getByRole('button', { name: /^Cerrar el detalle de / }).or(page.getByRole('button', { name: /Volver al Top/ }));
    await expect(salida.first()).toBeVisible();
    await expect(page.getByText('Posiciones obtenidas').or(page.getByText(/Atletas/)).first()).toBeVisible();
    await salida.first().click();
    await expect(salida).toHaveCount(0);
  });

  test('pantalla completa nativa: entra, el contenedor es el fullscreenElement, y sale', async ({ page }) => {
    await page.goto('/mapa');
    const entrar = page.getByRole('button', { name: 'Ver mapa en pantalla completa' });
    await expect(entrar).toBeVisible();
    await entrar.click();
    await expect(page.getByRole('button', { name: 'Salir de pantalla completa' })).toBeVisible();
    const nativo = await page.evaluate(() => Boolean(document.fullscreenElement));
    const overlay = await page.getByLabel('Mapa de participación en pantalla completa').count();
    expect(nativo || overlay > 0, 'o es Fullscreen API nativa o la capa de reserva').toBe(true);
    expect(nativo, 'en Chromium debería usarse la Fullscreen API nativa').toBe(true);
    // el zoom sigue funcionando dentro de pantalla completa
    await page.getByRole('group', { name: 'Zoom del mapa' }).getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Salir de pantalla completa' }).click();
    await expect(page.getByRole('button', { name: 'Ver mapa en pantalla completa' })).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  });

  test('pantalla completa: Escape del navegador sincroniza el estado de la interfaz', async ({ page }) => {
    await page.goto('/mapa');
    await page.getByRole('button', { name: 'Ver mapa en pantalla completa' }).click();
    await expect(page.getByRole('button', { name: 'Salir de pantalla completa' })).toBeVisible();
    // Salida "externa": lo que hace el navegador al apretar Escape.
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.getByRole('button', { name: 'Ver mapa en pantalla completa' })).toBeVisible();
  });

  test('las localidades sin ubicación se listan aparte (no se pierden)', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page.locator('section[aria-labelledby="sin-ubicacion"]')).toBeAttached();
  });
});
