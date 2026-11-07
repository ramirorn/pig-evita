// Recorrido completo por la interfaz:
//   login → inscripción por plantel → documento (subir y revisar) → revisión/aprobación de inscripciones
//   → competencia → fixture → resultado → ranking → página pública.
// Datos propios (disciplina de equipo con plantel mínimo de 2 titulares) para no depender del sembrado.
import { Page } from '@playwright/test';
import { knownBug } from '../../lib/bugs';
import { as, data, nextDni, PNG, uniq } from '../../lib/api';
import { elegir, expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

test.describe.configure({ mode: 'serial' });

const RUN = uniq('J');
const DISCIPLINA = `Voley-${RUN}`;
const CATEGORIA = `Cat-${RUN}`;
const EQUIPOS = [`Los Halcones ${RUN}`, `Las Aguilas ${RUN}`, `Los Zorros ${RUN}`];
let competenciaId = '';
let pendienteConAprobar = 0;
let categoriaId = '';
let disciplinaId = '';
const miembros: Array<{ dni: string; nombre: string }> = [];

async function agregarIntegrante(page: Page, n: number, equipo: string, suplente = false) {
  const dni = nextDni();
  const nombre = `Jug${n}`;
  if (suplente) await page.getByRole('button', { name: 'Suplente', exact: true }).click();
  else await page.getByRole('button', { name: 'Titular', exact: true }).click();
  await page.locator('#integrante-dni').fill(dni);
  await page.getByRole('button', { name: 'Masculino' }).click();
  await page.locator('#integrante-nombre').fill(nombre);
  await page.locator('#integrante-apellido').fill(`${equipo.split(' ')[1]}${n}`);
  await page.locator('#integrante-nacimiento').fill('05/05/2012');
  await page.locator('#integrante-localidad').fill('Formosa');
  await page.getByRole('button', { name: 'Agregar al plantel' }).click();
  miembros.push({ dni, nombre });
  return dni;
}

async function inscribirEquipoPorUI(page: Page, equipo: string) {
  await page.goto('/admin/nueva-inscripcion');
  await page.getByRole('button', { name: new RegExp(DISCIPLINA) }).click();
  await page.getByRole('button', { name: new RegExp(CATEGORIA) }).click();
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.locator('#equipo-nombre').fill(equipo);
  await page.locator('#equipo-localidad').fill('Formosa');
  await agregarIntegrante(page, 1, equipo);
  await agregarIntegrante(page, 2, equipo);
  await page.getByRole('button', { name: 'Revisar el plantel' }).click();
  await expect(page.getByText(/Paso 3: Verificación del Plantel/)).toBeVisible();
  await page.getByRole('checkbox').check(); // declaración jurada
  await page.getByRole('button', { name: /Inscribir a los 2 integrantes/ }).click();
  await expect(page.getByText(/EVITA-[A-Z0-9]{8}/).first()).toBeVisible({ timeout: 20_000 });
}

test.describe('recorrido completo', () => {
  test.beforeAll(async () => {
    const s = (await as('SUPER_ADMIN')).api;
    const d = await data(await s.post('/disciplines', { name: DISCIPLINA, type: 'EQUIPO', resultType: 'SETS', titulares: 2, maxSuplentes: 1 }), 201);
    const c = await data(await s.post('/categories', { disciplineId: d.id, name: CATEGORIA, minAge: 10, maxAge: 99, sex: 'MIXTO' }), 201);
    disciplinaId = d.id;
    categoriaId = c.id;
  });

  test('1. inscripción por plantel (3 equipos) desde la pantalla "Nueva inscripción"', async ({ page, loginAs, problems }) => {
    test.setTimeout(180_000);
    await loginAs('DELEGADO');
    for (const equipo of EQUIPOS) await inscribirEquipoPorUI(page, equipo);
    const s = (await as('SUPER_ADMIN')).api;
    const equipos = await data(await s.get(`/teams?categoryId=${categoriaId}&limit=50`));
    expect(equipos.map((e: any) => e.name).sort()).toEqual([...EQUIPOS].sort());
    expect(relevantes(problems), relevantes(problems).join('\n')).toEqual([]);
  });

  test('2. el delegado no puede dar de alta fuera de su departamento desde el formulario (mensaje claro)', async ({ page, loginAs }) => {
    await loginAs('DELEGADO');
    await page.goto('/admin/nueva-inscripcion');
    await page.getByRole('button', { name: new RegExp(DISCIPLINA) }).click();
    await page.getByRole('button', { name: new RegExp(CATEGORIA) }).click();
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await page.locator('#equipo-nombre').fill(`Otro ${RUN}`);
    // el departamento por defecto es Formosa = el del delegado; se intenta con otro
    await elegir(page, page.locator('#equipo-departamento'), 'Pilcomayo');
    await page.locator('#equipo-localidad').fill('Clorinda');
    await agregarIntegrante(page, 1, 'Otro X');
    await agregarIntegrante(page, 2, 'Otro X');
    await page.getByRole('button', { name: 'Revisar el plantel' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Inscribir a los 2 integrantes/ }).click();
    await expect(page.getByRole('alert').or(page.getByText(/no tiene permiso|fuera de su|alcance|No se pudo/i)).first()).toBeVisible({ timeout: 15_000 });
  });

  test('3. documentos: se busca al participante, se sube un archivo y un admin lo aprueba', async ({ page, loginAs }) => {
    test.setTimeout(120_000);
    await loginAs('ADMIN_PROVINCIAL');
    const m = miembros[0];
    await page.goto('/admin/documentos');
    await page.getByRole('searchbox', { name: '¿De quién son los papeles?' }).fill(m.dni);
    await page.getByRole('button', { name: new RegExp(m.nombre) }).first().click();
    const input = page.locator('input[type=file][aria-label^="Elegir archivo para"]').first();
    await input.setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Subir' }).first().click();
    // el archivo quedó en MinIO y el admin lo ve en la API
    const s = (await as('SUPER_ADMIN')).api;
    const p = await data(await s.get(`/participants/dni/${m.dni}`));
    await expect.poll(async () => (await data(await s.get(`/documents/participant/${p.id}`))).length, { timeout: 15_000 }).toBe(1);
    expect((await data(await s.get(`/documents/participant/${p.id}`)))[0].status).toBe('PENDIENTE');
    await page.getByRole('button', { name: /^Revisar .* de / }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
    await expect.poll(async () => (await data(await s.get(`/documents/participant/${p.id}`)))[0].status, { timeout: 15_000 }).toBe('APROBADO');
    // y se puede abrir con el link firmado de MinIO
    const doc = (await data(await s.get(`/documents/participant/${p.id}`)))[0];
    const url: string = doc.url ?? doc.presignedUrl ?? doc.downloadUrl;
    expect((await fetch(url)).status).toBe(200);
  });

  test('4. revisión y aprobación de inscripciones desde el listado y el detalle', async ({ page, loginAs }) => {
    test.setTimeout(180_000);
    await loginAs('ADMIN_PROVINCIAL');
    const s = (await as('SUPER_ADMIN')).api;
    const todas = await data(await s.get(`/inscriptions?limit=100`));
    const delRun = todas.filter((i: any) => i.category?.id === categoriaId);
    expect(delRun.length).toBe(6);
    // una por la interfaz: PENDIENTE → REVISADA → APROBADA
    await page.goto(`/admin/inscripciones/${delRun[0].id}`);
    await page.getByRole('button', { name: /Marcar como Revisada/ }).click();
    await expect(page.getByText('Revisada', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.getByText(/Inscripción Aprobada/)).toBeVisible({ timeout: 15_000 });
    // el listado refleja el nuevo estado
    await page.goto('/admin/inscripciones');
    await expect(page.getByRole('link', { name: `Revisar la inscripción ${delRun[0].qrCode}` })).toBeVisible();
    // una PENDIENTE no debería ofrecer "Aprobar" (el backend exige revisarla antes)
    await page.goto(`/admin/inscripciones/${delRun[1].id}`);
    await expect(page.getByRole('button', { name: /Marcar como Revisada/ })).toBeVisible();
    pendienteConAprobar = await page.getByRole('button', { name: 'Aprobar' }).count();
    // el resto por API (misma regla de negocio, más rápido)
    const api = (await as('ADMIN_PROVINCIAL')).api;
    for (const i of delRun.slice(1)) {
      await data(await api.patch(`/inscriptions/${i.id}/review`, {}));
      await data(await api.patch(`/inscriptions/${i.id}/approve`, {}));
    }
  });

  test('4b. una inscripción PENDIENTE no ofrece el botón Aprobar', async () => {
    knownBug('F-30: el detalle de una inscripción PENDIENTE muestra "Aprobar" aunque el backend sólo aprueba las REVISADA (responde 400)');
    expect(pendienteConAprobar).toBe(0);
  });

  test('5. crear la competencia con los selectores y el selector de fecha propios', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/competencias');
    await page.getByRole('button', { name: 'Crear Competencia' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Nombre de la Competencia (Opcional)').fill(`Torneo ${RUN}`);
    await elegir(page, dlg.getByLabel('Disciplina *'), DISCIPLINA);
    await elegir(page, dlg.getByLabel('Categoría *'), new RegExp(CATEGORIA));
    await elegir(page, dlg.getByLabel('Etapa *'), /Zonal/);
    await elegir(page, dlg.getByLabel('Formato de Competencia *'), /Todos contra todos|Round|Liga/i);
    // fecha por texto
    await dlg.getByLabel('Fecha de Inicio (Opcional)').fill('15/12/2026');
    // fecha por calendario
    await dlg.getByRole('button', { name: /Elegir fecha de fin/ }).click();
    await page.getByRole('grid').getByRole('button', { name: /20 de diciembre/i }).first().click().catch(async () => {
      await page.getByRole('grid').getByRole('button').nth(20).click();
    });
    await dlg.getByRole('button', { name: 'Crear Competencia' }).click();
    await expect(page.getByText(`Torneo ${RUN}`).first()).toBeVisible({ timeout: 15_000 });
    const s = (await as('SUPER_ADMIN')).api;
    const lista = await data(await s.get(`/competitions?disciplineId=${disciplinaId}`));
    expect(lista).toHaveLength(1);
    competenciaId = lista[0].id;
    expect(lista[0].format).toBe('ROUND_ROBIN');
    expect(lista[0].startDate).toMatch(/^2026-12-15/);
  });

  test('6. generar el fixture automático desde el detalle', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/competencias/${competenciaId}`);
    await page.getByRole('button', { name: 'Generar Fixture Automático' }).click();
    await expect(page.getByText(/Fixture generado: 3 partidos/)).toBeVisible({ timeout: 15_000 });
  });

  test('7a. el panel ofrece una forma de cargar el resultado de un partido (HU-C3)', async ({ page, loginAs }) => {
    knownBug('F-32: no existe ninguna pantalla para cargar resultados: MatchCard sólo muestra el marcador y useSubmitMatchResult no se usa en ningún componente');
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/competencias/${competenciaId}`);
    await expect(page.getByText(/Fecha 1/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Cargar resultado|Cargar|Editar resultado|Registrar/ }).first()).toBeVisible({ timeout: 3000 });
  });

  test('7b. el ÁRBITRO llega desde "Resultados" a una pantalla donde puede cargar (no "Acceso Denegado")', async ({ page, loginAs }) => {
    knownBug('F-31: el enlace "Cargar Resultados" de /admin/resultados lleva a /admin/competencias/:id, que el rol ARBITRO no tiene permitido (Acceso Denegado)');
    await loginAs('ARBITRO');
    await page.goto('/admin/resultados');
    await page.getByRole('link', { name: 'Cargar Resultados' }).first().click();
    await expect(page).toHaveURL(/\/admin\/competencias\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Cargando...')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText('Acceso Denegado')).toHaveCount(0);
  });

  test('7c. (por API, como ÁRBITRO) se carga el resultado del primer partido y queda FINALIZADO', async () => {
    const s = (await as('SUPER_ADMIN')).api;
    const comp = await data(await s.get(`/competitions/${competenciaId}`));
    const m = comp.matches[0];
    const payload = m.results.map((r: any, i: number) => ({ resultId: r.id, data: { isWinner: i === 0, scoreData: { sets: i === 0 ? 3 : 1 } } }));
    const done = await data(await (await as('ARBITRO')).api.patch(`/results/match/${m.id}`, payload));
    expect(done.status).toBe('FINALIZADO');
  });

  test('8. la página pública muestra la competencia y una tabla de posiciones con partidos jugados', async ({ page }) => {
    await page.goto(`/competencias/${competenciaId}`);
    await expect(page.getByText(`Torneo ${RUN}`).first()).toBeVisible();
    await expect(page.getByText('Tabla de Posiciones')).toBeVisible();
    const filas = page.locator('table tbody tr');
    await expect(filas).toHaveCount(2);
    await expect(filas.first()).toContainText('3'); // 3 puntos del ganador
    await page.goto('/rankings');
    await expect(page.getByText(`Torneo ${RUN}`).first()).toBeVisible();
  });

  test('8a. la página pública de la competencia no desborda el ancho de la pantalla', async ({ page }) => {
    if (page.viewportSize()!.width < 400) knownBug('F-40: en 375 px la página pública de una competencia desborda horizontalmente (scrollWidth 425 > 375) por la tabla de posiciones');
    await page.goto(`/competencias/${competenciaId}`);
    await expect(page.getByText('Tabla de Posiciones')).toBeVisible();
    await sinDesbordeHorizontal(page);
  });

  test('8b. la tabla pública muestra el NOMBRE de cada equipo y su posición', async ({ page }) => {
    knownBug('F-33: la tabla de posiciones pública muestra "undefined, undefined" en vez del nombre del equipo y deja vacía la columna #');
    await page.goto(`/competencias/${competenciaId}`);
    const celdas = page.locator('table tbody tr').first();
    await expect(celdas).not.toContainText('undefined');
    await expect(celdas).toContainText(/Los Halcones|Las Aguilas|Los Zorros/);
    await expect(celdas.locator('td, th').first()).toHaveText(/S/);
  });

  test('8c. la página pública muestra el fixture con los resultados de cada partido', async ({ page }) => {
    knownBug('F-34: "Fixture y Resultados" de la página pública es un marcador de posición ("estará disponible próximamente"); no lista partidos ni marcadores');
    await page.goto(`/competencias/${competenciaId}`);
    await expect(page.getByText('Fixture y Resultados')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/próximamente/)).toHaveCount(0);
  });

  test('9. el dashboard muestra los totales reales y los reportes se descargan (CSV y Excel)', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    const stats = await data(await (await as('ADMIN_PROVINCIAL')).api.get('/dashboard/stats'));
    await page.goto('/admin/dashboard');
    await expect(page.locator('main h1', { hasText: 'Dashboard' }).or(page.getByRole('heading', { name: 'Dashboard' })).first()).toBeVisible();
    await expect(page.locator('main')).toContainText(String(stats.totalParticipants).replace(/B(?=(d{3})+(?!d))/g, '.'));
    await page.goto('/admin/reportes');
    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar Excel/ }).first().click()]);
    expect(xlsx.suggestedFilename()).toMatch(/.xlsx$/);
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar CSV|CSV/ }).first().click()]);
    expect(csv.suggestedFilename()).toMatch(/.csv$/);
  });

  test('10. una competencia de disciplina individual puede armar su fixture desde la interfaz', async ({ page, loginAs }) => {
    knownBug('F-29: la pantalla de la competencia sólo genera fixture con equipos (teamIds); las competencias de disciplinas individuales no pueden armarse desde el panel');
    const s = (await as('SUPER_ADMIN')).api;
    const ind = (await data(await s.get('/disciplines'))).find((d: any) => d.name === 'Ajedrez');
    const cat = await data(await s.post('/categories', { disciplineId: ind.id, name: uniq('CatInd'), minAge: 10, maxAge: 99, sex: 'MIXTO' }), 201);
    const comp = await data(await s.post('/competitions', { disciplineId: ind.id, categoryId: cat.id, stage: 'ZONAL', format: 'ROUND_ROBIN', name: uniq('Ind') }), 201);
    for (let i = 0; i < 3; i++) {
      const insc = await data(await s.post('/inscriptions', { dni: nextDni(), firstName: `I${i}`, lastName: uniq('Ind'), birthDate: '2012-03-04', sex: 'MASCULINO', locality: 'Formosa', department: 'Formosa', categoryId: cat.id }), 201);
      await s.patch(`/inscriptions/${insc.id}/review`, {});
      await s.patch(`/inscriptions/${insc.id}/approve`, {});
    }
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto(`/admin/competencias/${comp.id}`);
    await expect(page.getByRole('button', { name: 'Generar Fixture Automático' })).toBeEnabled();
  });
});
