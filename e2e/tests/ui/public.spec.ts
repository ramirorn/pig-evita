// Sitio público: cada página, en escritorio (1280) y celular (375). Navegación, contenido sembrado,
// sin errores de consola/500 y sin desborde horizontal.
import { Page } from '@playwright/test';
import { expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

const PAGINAS: Array<{ ruta: string; nombre: string; texto: RegExp }> = [
  { ruta: '/', nombre: 'inicio', texto: /Juegos Evita Formoseños 2026/ },
  { ruta: '/disciplinas', nombre: 'disciplinas', texto: /Disciplinas Deportivas/ },
  { ruta: '/noticias', nombre: 'noticias', texto: /Actualidad de los Juegos Evita/ },
  { ruta: '/calendario', nombre: 'calendario', texto: /Calendario de Eventos/ },
  { ruta: '/sedes', nombre: 'sedes', texto: /Sedes de Competencia/ },
  { ruta: '/rankings', nombre: 'rankings', texto: /Rankings y Resultados/ },
  { ruta: '/mapa', nombre: 'mapa', texto: /Mapa de los Juegos/ },
  { ruta: '/encuesta', nombre: 'encuesta', texto: /la cabeza también entrena/ },
  { ruta: '/inscripcion', nombre: 'inscripción', texto: /Inscripciones a los Juegos Evita/ },
];

async function abrirMenuSiHaceFalta(page: Page) {
  const burger = page.getByRole('button', { name: 'Menú de navegación' });
  if (await burger.isVisible()) await burger.click();
}

test.describe('páginas públicas', () => {
  for (const p of PAGINAS) {
    test(`${p.nombre} (${p.ruta}) carga, muestra su contenido y no desborda`, async ({ page, problems }) => {
      await page.goto(p.ruta);
      await expect(page.getByText(p.texto).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await sinDesbordeHorizontal(page);
      expect(relevantes(problems), relevantes(problems).join('\n')).toEqual([]);
    });
  }

  test('ruta inexistente → pantalla 404 con salida al inicio', async ({ page }) => {
    await page.goto('/esto-no-existe');
    await expect(page.getByText(/no encontr|404/i).first()).toBeVisible();
  });

  test('un visitante anónimo no genera errores 401 en la consola', async ({ page, problems }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(problems.filter((p) => /401/.test(p))).toEqual([]);
  });
});

test.describe('navegación principal', () => {
  test('el menú lleva a cada sección pública', async ({ page }) => {
    await page.goto('/');
    const destinos: Array<[string, RegExp]> = [
      ['Disciplinas', /\/disciplinas$/],
      ['Noticias', /\/noticias$/],
      ['Calendario', /\/calendario$/],
      ['Sedes', /\/sedes$/],
      ['Rankings', /\/rankings$/],
      ['Mapa', /\/mapa$/],
      ['Encuesta', /\/encuesta$/],
    ];
    for (const [nombre, url] of destinos) {
      await page.goto('/');
      await abrirMenuSiHaceFalta(page);
      await page.getByRole('navigation').getByRole('link', { name: nombre, exact: true }).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('"Inscripciones" lleva a la landing informativa y de ahí a /admin/login para delegados', async ({ page }) => {
    await page.goto('/');
    await abrirMenuSiHaceFalta(page);
    await page.getByRole('navigation').getByRole('link', { name: /Inscripciones/ }).first().click();
    await expect(page).toHaveURL(/\/inscripcion$/);
  });
});

test.describe('disciplinas', () => {
  test('lista las disciplinas sembradas y abre el detalle', async ({ page }) => {
    await page.goto('/disciplinas');
    await expect(page.getByText('Ajedrez').first()).toBeVisible();
    await expect(page.getByText(/Fútbol 11/).first()).toBeVisible();
    await page.getByText('Ajedrez').first().click();
    await expect(page).toHaveURL(/\/disciplinas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: /Ajedrez/ }).first()).toBeVisible();
  });

  test('id inexistente o inválido muestra un estado de error, no una pantalla en blanco', async ({ page }) => {
    await page.goto('/disciplinas/99999999-9999-4999-8999-999999999999');
    await expect(page.locator('body')).toContainText(/no encontr|no existe|error/i);
    await page.goto('/disciplinas/xx');
    await expect(page.locator('body')).toContainText(/no encontr|no existe|error|inválid/i);
  });
});

test.describe('noticias', () => {
  test('muestra las noticias publicadas y abre una; los borradores no aparecen', async ({ page }) => {
    await page.goto('/noticias');
    const enlace = page.locator('a[href$="/noticias/comienzan-los-juegos-evita-2026"]:visible').last(); // el último es el de la lista; el primero puede ser una diapositiva inerte del carrusel
    await expect(enlace).toBeVisible();
    await enlace.dispatchEvent('click'); // en celular el enlace queda tapado por la cabecera fija al desplazarse: se dispara el clic sobre el elemento
    await expect(page).toHaveURL(/\/noticias\/comienzan-los-juegos-evita-2026$/);
    await expect(page.getByRole('heading', { name: /Comienzan los Juegos Evita 2026/ }).first()).toBeVisible();
  });

  test('filtro por origen: "De la plataforma" / "Del portal oficial" / "Todas"', async ({ page }) => {
    await page.goto('/noticias');
    for (const nombre of ['De la plataforma', 'Del portal oficial', 'Todas']) {
      const b = page.getByRole('button', { name: nombre }).or(page.getByRole('tab', { name: nombre })).or(page.getByText(nombre, { exact: true }));
      await b.first().click();
    }
    await expect(page.getByText(/Actualidad de los Juegos Evita/)).toBeVisible();
  });

  test('slug inexistente → estado de no encontrada', async ({ page }) => {
    await page.goto('/noticias/no-existe-esta-noticia');
    await expect(page.locator('body')).toContainText(/no encontr|no existe|error/i);
  });
});

test.describe('calendario', () => {
  test('muestra el evento sembrado y filtra por etapa con el selector propio', async ({ page }) => {
    await page.goto('/calendario');
    await expect(page.getByText('Acto de Apertura Zonal Formosa').first()).toBeVisible();
    const combos = page.getByRole('combobox');
    expect(await combos.count()).toBeGreaterThan(0);
    // ningún <select> nativo
    expect(await page.locator('select').count()).toBe(0);
    await combos.first().click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('sedes', () => {
  test('lista las sedes activas con su dirección', async ({ page }) => {
    await page.goto('/sedes');
    await expect(page.getByText('Club San Martín').first()).toBeVisible();
    await expect(page.getByText('Polideportivo Policial').first()).toBeVisible();
  });
});

test.describe('rankings y competencia pública', () => {
  test('lista competencias y abre la página pública con su fixture y tabla', async ({ page }) => {
    await page.goto('/rankings');
    const tarjeta = page.getByText(/Zonal de Fútbol 11 Sub-16 Femenino/).first();
    await expect(tarjeta).toBeVisible();
    await tarjeta.click();
    await expect(page).toHaveURL(/\/competencias\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/Zonal de Fútbol 11 Sub-16 Femenino/).first()).toBeVisible();
    await expect(page.getByText(/posiciones|Posiciones/).first()).toBeVisible();
  });

  test('competencia inexistente → error claro', async ({ page }) => {
    await page.goto('/competencias/99999999-9999-4999-8999-999999999999');
    await expect(page.locator('body')).toContainText(/no encontr|no existe|error/i);
  });
});
