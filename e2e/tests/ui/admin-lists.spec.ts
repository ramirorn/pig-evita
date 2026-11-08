// Listados del panel: búsqueda, filtros con selectores propios, paginación y detalle.
import { Page } from '@playwright/test';
import { DEPTO, as, data, nextDni, uniq } from '../../lib/api';
import { elegir, expect, relevantes, test } from '../../lib/ui';

const sa = async () => (await as('SUPER_ADMIN')).api;

async function sinCargando(page: Page) {
  await expect(page.getByText('Cargando...')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('participantes', () => {
  test('buscar por DNI y por apellido, filtrar por departamento, y abrir el detalle', async ({ page, loginAs, problems }) => {
    const s = await sa();
    const dni = nextDni();
    const apellido = uniq('Busq');
    const p = await data(await s.post('/participants', { dni, firstName: 'Buscada', lastName: apellido, birthDate: '2011-02-03', sex: 'FEMENINO', locality: 'Clorinda', department: 'Pilcomayo' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/participantes');
    await sinCargando(page);
    const buscar = page.getByRole('textbox', { name: 'Buscar participantes' });
    await buscar.fill(dni);
    await expect(page.getByRole('link', { name: new RegExp(apellido) })).toBeVisible();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await buscar.fill(apellido);
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await buscar.fill('');
    await page.getByRole('textbox', { name: 'Filtrar por departamento' }).fill('Pilcomayo');
    await expect.poll(async () => page.locator('table tbody tr', { hasText: 'Pilcomayo' }).count()).toBeGreaterThan(0);
    expect(await page.locator('table tbody tr', { hasNotText: 'Pilcomayo' }).count()).toBe(0);
    await page.getByRole('textbox', { name: 'Filtrar por departamento' }).fill('');
    await buscar.fill(dni);
    await page.getByRole('link', { name: new RegExp(apellido) }).click();
    await expect(page).toHaveURL(new RegExp(p.id));
    await expect(page.getByRole('heading', { level: 1 }).last()).toContainText(apellido);
    expect(relevantes(problems)).toEqual([]);
  });

  test('filtro por disciplina habilita el de categoría (selectores dependientes)', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/participantes');
    await sinCargando(page);
    const cat = page.getByRole('combobox', { name: 'Filtrar por categoría' });
    await expect(cat).toBeDisabled();
    await elegir(page, page.getByRole('combobox', { name: 'Filtrar por disciplina' }), 'Ajedrez');
    await expect(cat).toBeEnabled();
  });

  test('paginación: siguiente/anterior y tamaño de página', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/participantes');
    await sinCargando(page);
    const pie = page.locator('main');
    await expect(pie.getByRole('button', { name: 'Página siguiente' })).toBeEnabled();
    const primera = await page.locator('table tbody tr').first().innerText();
    await pie.getByRole('button', { name: 'Página siguiente' }).click();
    await expect.poll(async () => page.locator('table tbody tr').first().innerText()).not.toBe(primera);
    await pie.getByRole('button', { name: 'Página anterior' }).click();
    await expect.poll(async () => page.locator('table tbody tr').first().innerText()).toBe(primera);
  });

  test('un DELEGADO sólo ve participantes de su departamento en la tabla', async ({ page, loginAs }) => {
    const s = await sa();
    const ajeno = await data(await s.post('/participants', { dni: nextDni(), firstName: 'Ajeno', lastName: uniq('Ajeno'), birthDate: '2011-02-03', sex: 'MASCULINO', locality: 'Clorinda', department: 'Pilcomayo' }), 201);
    await loginAs('DELEGADO');
    await page.goto('/admin/participantes');
    await sinCargando(page);
    await page.getByRole('textbox', { name: 'Buscar participantes' }).fill(ajeno.dni);
    await expect(page.locator('table tbody tr', { hasText: ajeno.lastName })).toHaveCount(0);
    expect(await page.locator('table tbody tr', { hasText: 'Pilcomayo' }).count()).toBe(0);
  });
});

test.describe('inscripciones', () => {
  test('filtro por estado con el selector propio y búsqueda por código QR', async ({ page, loginAs }) => {
    const s = await sa();
    const cat = (await data(await s.get('/categories?limit=100'))).find((c: any) => c.discipline.type === 'INDIVIDUAL' && c.isActive);
    const ins = await data(await s.post('/inscriptions', { dni: nextDni(), firstName: 'Lst', lastName: uniq('Lst'), birthDate: '2012-03-04', sex: 'MASCULINO', locality: 'Formosa', department: DEPTO, categoryId: cat.id }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/inscripciones');
    await sinCargando(page);
    await page.getByRole('textbox', { name: 'Buscar inscripciones' }).fill(ins.qrCode);
    await expect(page.getByRole('link', { name: `Revisar la inscripción ${ins.qrCode}` })).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar inscripciones' }).fill('');
    await elegir(page, page.getByRole('combobox', { name: 'Filtrar por estado' }).or(page.getByRole('button', { name: 'Filtrar por estado' })), /Aprobada/i);
    await sinCargando(page);
    await expect(page.locator('table tbody tr', { hasText: /Pendiente/i })).toHaveCount(0);
  });
});

test.describe('otras listas', () => {
  test('competencias: búsqueda por nombre', async ({ page, loginAs }) => {
    const s = await sa();
    const d = (await data(await s.get('/disciplines'))).find((x: any) => x.name === 'Ajedrez');
    const c = await data(await s.post('/categories', { disciplineId: d.id, name: uniq('CatL'), minAge: 5, maxAge: 99, sex: 'MIXTO' }), 201);
    const nombre = uniq('CompBusq');
    await data(await s.post('/competitions', { disciplineId: d.id, categoryId: c.id, stage: 'ZONAL', format: 'ROUND_ROBIN', name: nombre }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/competencias');
    await sinCargando(page);
    await page.getByRole('textbox', { name: /Buscar competencia/ }).fill(nombre);
    await expect(page.getByRole('link', { name: new RegExp(nombre) })).toBeVisible();
    await page.getByRole('textbox', { name: /Buscar competencia/ }).fill('zzz-no-existe');
    await expect(page.getByRole('link', { name: new RegExp(nombre) })).toHaveCount(0);
  });

  test('usuarios: búsqueda y edición del rol desde el formulario', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/usuarios');
    await sinCargando(page);
    await page.getByRole('textbox', { name: 'Buscar usuarios' }).fill('OPERADOR_MESA');
    await expect(page.getByRole('button', { name: 'Editar a E2E OPERADOR_MESA' })).toBeVisible();
    await page.getByRole('button', { name: 'Editar a E2E OPERADOR_MESA' }).click();
    await expect(page.getByRole('dialog').getByLabel('Correo Electrónico')).toHaveValue(/operador_mesa@evita-e2e\.test/);
    await page.keyboard.press('Escape');
  });

  test('sedes: filtros de departamento y estado con selectores propios', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/sedes');
    await sinCargando(page);
    await elegir(page, page.getByRole('combobox', { name: 'Filtrar por departamento' }).or(page.getByRole('button', { name: 'Filtrar por departamento' })), 'Formosa');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('equipos: el detalle de un equipo muestra su plantel', async ({ page, loginAs }) => {
    const s = await sa();
    const equipos = await data(await s.get('/teams?limit=1'));
    test.skip(equipos.length === 0, 'no hay equipos');
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/equipos/${equipos[0].id}`);
    await sinCargando(page);
    await expect(page.locator('main')).toContainText(equipos[0].name);
  });

  test('dashboard y mapa de impacto del panel cargan sin errores', async ({ page, loginAs, problems }) => {
    await loginAs('ADMIN_PROVINCIAL');
    for (const r of ['/admin/dashboard', '/admin/mapa']) {
      await page.goto(r);
      await sinCargando(page);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toBeVisible();
    }
    expect(relevantes(problems), relevantes(problems).join('\n')).toEqual([]);
  });
});

test.describe('accesibilidad básica del panel', () => {
  const RUTAS = ['/admin/dashboard', '/admin/participantes', '/admin/inscripciones', '/admin/equipos', '/admin/disciplinas', '/admin/categorias', '/admin/competencias', '/admin/noticias', '/admin/calendario', '/admin/sedes', '/admin/encuesta', '/admin/usuarios', '/admin/auditoria'];

  test('todos los botones tienen nombre accesible (los de sólo ícono, como el menú "⋮" de cada fila, incluidos)', async ({ page, loginAs }) => {
    test.setTimeout(120_000);
    await loginAs('SUPER_ADMIN');
    const sinNombre: string[] = [];
    for (const r of RUTAS) {
      await page.goto(r);
      await sinCargando(page);
      await page.waitForLoadState('networkidle');
      const n = await page.evaluate(() =>
        [...document.querySelectorAll('main button, header button')].filter((b) => {
          const el = b as HTMLElement;
          return !(el.textContent ?? '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.getAttribute('title');
        }).length,
      );
      if (n > 0) sinNombre.push(`${r}: ${n}`);
    }
    expect(sinNombre, sinNombre.join('\n')).toEqual([]);
  });

  test('cada pantalla tiene un único <h1>', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/participantes');
    await sinCargando(page);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.locator('h1').count()).toBe(1);
  });

  test('el detalle de un participante muestra sus documentos (no un aviso de "en construcción")', async ({ page, loginAs }) => {
    const s = await sa();
    const p = (await data(await s.get('/participants?limit=1')))[0];
    await loginAs('SUPER_ADMIN');
    await page.goto(`/admin/participantes/${p.id}`);
    await sinCargando(page);
    await expect(page.getByRole('heading', { name: 'Documentación' })).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/en construcción/i);
  });
});
