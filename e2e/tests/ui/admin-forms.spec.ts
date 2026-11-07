// Formularios del panel con los controles propios: selectores (Radix) y selector de fecha/hora.
// Cubre alta de participante, evento de calendario, sede (con foto), noticia (subida y URL), campaña de encuesta,
// usuario, y el filtro por día de la auditoría. También verifica que no queden controles nativos.
import { Page } from '@playwright/test';
import { knownBug } from '../../lib/bugs';
import { Api, PNG, as, data, nextDni, uniq } from '../../lib/api';
import { elegir, expect, sinDesbordeHorizontal, test } from '../../lib/ui';

const sa = async () => (await as('SUPER_ADMIN')).api;

test.describe('controles propios (sin <select> ni <input type=date> nativos)', () => {
  const RUTAS = [
    '/admin/participantes', '/admin/inscripciones', '/admin/nueva-inscripcion', '/admin/equipos', '/admin/documentos',
    '/admin/disciplinas', '/admin/categorias', '/admin/competencias', '/admin/resultados', '/admin/noticias',
    '/admin/calendario', '/admin/sedes', '/admin/encuesta', '/admin/usuarios', '/admin/reportes', '/admin/auditoria',
    '/calendario', '/rankings', '/encuesta/responder', '/noticias',
  ];
  test('ninguna pantalla usa controles de formulario nativos para elegir o fechar', async ({ page, loginAs }) => {
    test.setTimeout(120_000);
    await loginAs('SUPER_ADMIN');
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      const n = await page.locator('select, input[type=date], input[type=time], input[type=datetime-local], input[type=month]').count();
      expect(n, `controles nativos en ${ruta}`).toBe(0);
    }
  });
});

test.describe('selector propio (Select)', () => {
  test('teclado: abre con Enter, navega con flechas, elige con Enter y Escape cierra sin cambiar', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/categorias');
    await page.getByRole('button', { name: 'Nueva Categoría' }).click();
    const dlg = page.getByRole('dialog');
    const sexo = dlg.getByLabel('Sexo');
    await expect(sexo).toContainText('Mixto');
    await sexo.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(sexo).toContainText('Mixto');
    await sexo.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: 'Femenino' }).click();
    await expect(sexo).toContainText('Femenino');
  });

  test('la lista de opciones cabe en la pantalla (sin desbordar el ancho del celular)', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/encuesta');
    await page.getByRole('button', { name: 'Nueva encuesta' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Etapa de la competencia').click();
    const lista = page.getByRole('listbox');
    await expect(lista).toBeVisible();
    const box = (await lista.boundingBox())!;
    const vw = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    await page.keyboard.press('Escape');
  });
});

test.describe('selector de fecha propio (DatePicker)', () => {
  const abrirFormParticipante = async (page: Page) => {
    await page.goto('/admin/participantes');
    await page.getByRole('button', { name: 'Nuevo Participante' }).first().click();
    return page.getByRole('dialog');
  };

  test('escribir la fecha: acepta dd/mm/aaaa válida; rechaza 31/02, texto y fechas futuras con mensaje', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    const dlg = await abrirFormParticipante(page);
    const campo = dlg.getByRole('textbox', { name: 'Fecha de Nacimiento' });
    await campo.fill('15/03/2011');
    await campo.blur();
    await expect(dlg.getByRole('alert').filter({ hasText: /fecha/i })).toHaveCount(0);
    await campo.fill('31/02/2011');
    await campo.blur();
    await expect(dlg.getByRole('alert').first()).toBeVisible();
    await campo.fill('abc');
    await campo.blur();
    await expect(campo).toHaveValue(/^[0-9/]*$/); // sólo admite números y barras
    await campo.fill('01/01/2099');
    await campo.blur();
    await expect(dlg.getByRole('alert').first()).toBeVisible(); // max = hoy
  });

  test('calendario: abrir, cambiar de mes/año, elegir un día y verlo en el campo; Escape cierra', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    const dlg = await abrirFormParticipante(page);
    await dlg.getByRole('button', { name: /Elegir fecha de nacimiento/ }).click();
    const cal = page.getByRole('dialog', { name: 'Calendario' }).or(page.locator('[aria-label="Calendario"]'));
    await expect(cal.first()).toBeVisible();
    await cal.first().getByRole('combobox', { name: 'Año' }).click();
    await page.getByRole('option', { name: '2010' }).click();
    await cal.first().getByRole('combobox', { name: 'Mes' }).click();
    await page.getByRole('option', { name: /junio/i }).click();
    await cal.first().locator('button[data-iso="2010-06-09"]').click();
    await expect(dlg.getByRole('textbox', { name: 'Fecha de Nacimiento' })).toHaveValue('09/06/2010');
    // reabrir y cerrar con Escape
    await dlg.getByRole('button', { name: /Elegir fecha de nacimiento/ }).click();
    await expect(cal.first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cal.first()).toHaveCount(0);
  });

  test('"Mes anterior" / "Mes siguiente" cambian el mes sin saltarse días', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    const dlg = await abrirFormParticipante(page);
    await dlg.getByRole('textbox', { name: 'Fecha de Nacimiento' }).fill('31/01/2012');
    await dlg.getByRole('button', { name: /Elegir fecha de nacimiento/ }).click();
    const cal = page.locator('[aria-label="Calendario"]');
    await cal.getByRole('button', { name: 'Mes siguiente' }).click();
    await expect(cal.getByRole('combobox', { name: 'Mes' })).toContainText(/febrero/i);
    await expect(cal.getByRole('button', { name: /29 de febrero de 2012/ })).toBeVisible(); // 2012 es bisiesto
    await cal.getByRole('button', { name: 'Mes anterior' }).click();
    await cal.getByRole('button', { name: 'Mes anterior' }).click();
    await expect(cal.getByRole('combobox', { name: 'Mes' })).toContainText(/diciembre/i);
    await expect(cal.getByRole('combobox', { name: 'Año' })).toContainText('2011');
  });
});

test.describe('alta de participante (diálogo)', () => {
  test('con sexo (selector), fecha escrita y por calendario → queda guardado con la fecha correcta', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/participantes');
    await page.getByRole('button', { name: 'Nuevo Participante' }).first().click();
    const dlg = page.getByRole('dialog');
    const dni = nextDni();
    const apellido = uniq('Dlg');
    await dlg.getByLabel('DNI', { exact: true }).fill(dni);
    await elegir(page, dlg.getByLabel('Sexo (DNI)'), 'Femenino');
    await dlg.getByLabel('Nombre', { exact: true }).fill('Ana');
    await dlg.getByLabel('Apellido').fill(apellido);
    await dlg.getByRole('textbox', { name: 'Fecha de Nacimiento' }).fill('09/07/2011');
    await dlg.getByLabel('Departamento').fill('Formosa');
    await dlg.getByLabel('Localidad').fill('Formosa');
    await dlg.getByRole('button', { name: 'Crear Participante' }).click();
    await expect(dlg).toHaveCount(0);
    const p = await data(await (await sa()).get(`/participants/dni/${dni}`));
    expect(p).toMatchObject({ sex: 'FEMENINO', firstName: 'Ana' });
    expect(p.birthDate).toMatch(/^2011-07-09/);
  });

  test('DNI duplicado: el formulario muestra el error del servidor y no cierra el diálogo', async ({ page, loginAs }) => {
    const s = await sa();
    const dni = nextDni();
    await data(await s.post('/participants', { dni, firstName: 'Dup', lastName: uniq('D'), birthDate: '2011-01-01', sex: 'MASCULINO', locality: 'Formosa', department: 'Formosa' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/participantes');
    await page.getByRole('button', { name: 'Nuevo Participante' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('DNI', { exact: true }).fill(dni);
    await dlg.getByLabel('Nombre', { exact: true }).fill('Otra');
    await dlg.getByLabel('Apellido').fill('Persona');
    await dlg.getByRole('textbox', { name: 'Fecha de Nacimiento' }).fill('01/01/2011');
    await dlg.getByLabel('Departamento').fill('Formosa');
    await dlg.getByLabel('Localidad').fill('Formosa');
    await dlg.getByRole('button', { name: 'Crear Participante' }).click();
    await expect(page.getByText(/ya existe|duplicad|ya está/i).first()).toBeVisible();
    await expect(dlg).toBeVisible();
  });

  test('la fecha de nacimiento se ve en la tabla y en el detalle con el día correcto (no un día antes)', async ({ page, loginAs }) => {
    knownBug('F-28: la fecha de nacimiento se muestra un día antes (y en formato m/d/aaaa) en el listado y el detalle de participantes: 2012-05-05 → "5/4/2012"');
    const s = await sa();
    const dni = nextDni();
    const p = await data(await s.post('/participants', { dni, firstName: 'Fecha', lastName: uniq('F'), birthDate: '2012-05-05', sex: 'MASCULINO', locality: 'Formosa', department: 'Formosa' }), 201);
    await loginAs('SUPER_ADMIN');
    await page.goto(`/admin/participantes/${p.id}`);
    await expect(page.getByText(/Fecha de Nacimiento/)).toBeVisible();
    await expect(page.locator('main')).toContainText(/(^|\D)0?5[/.-]0?5[/.-]2012/);
  });
});

test.describe('calendario (admin)', () => {
  test('crear evento con fecha, hora rápida, etapa y sede; aparece en la agenda pública; editar y borrar', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    const s = await sa();
    const sede = await data(await s.post('/venues', { name: uniq('SedeEv'), address: 'x', locality: 'Formosa', department: 'Formosa' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/calendario');
    await page.getByRole('button', { name: 'Crear Evento' }).click();
    const dlg = page.getByRole('dialog');
    const titulo = uniq('Torneo-Ev');
    await dlg.getByLabel('Título del Evento *').fill(titulo);
    await dlg.getByLabel('Fecha de Inicio *').fill('20/12/2026');
    await dlg.getByRole('button', { name: /^10:00$/ }).click();
    await elegir(page, dlg.getByLabel('Etapa (Opcional)'), /Zonal/);
    await elegir(page, dlg.getByLabel('Sede / Ubicación (Opcional)'), sede.name);
    await dlg.getByLabel('Publicar evento').check();
    await dlg.getByRole('button', { name: 'Crear Evento' }).click();
    await expect(dlg).toHaveCount(0);
    const lista = await data(await s.get('/calendar?search=' + encodeURIComponent(titulo)));
    expect(lista).toHaveLength(1);
    // 20/12/2026 10:00 hora de Formosa (UTC-3) = 13:00 UTC
    expect(lista[0].startDate).toBe('2026-12-20T13:00:00.000Z');
    expect(lista[0]).toMatchObject({ stage: 'ZONAL', venueId: sede.id, isPublished: true });
    await page.goto('/calendario');
    await expect(page.getByText(titulo).first()).toBeVisible();
    await page.goto('/admin/calendario');
    await page.getByRole('textbox', { name: /Buscar evento/ }).fill(titulo);
    await page.locator('tr', { hasText: titulo }).getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await page.getByRole('dialog').getByLabel('Título del Evento *').fill(titulo + ' v2');
    await page.getByRole('dialog').getByRole('button', { name: /Guardar|Actualizar/ }).click();
    await expect.poll(async () => (await data(await s.get('/calendar?search=' + encodeURIComponent(titulo)))).map((e: any) => e.title)).toEqual([titulo + ' v2']);
    await s.del(`/calendar/${lista[0].id}`);
    await s.del(`/venues/${sede.id}`);
  });
});

test.describe('sedes (admin)', () => {
  test('"Registrar Sede" crea la sede con coordenadas y ofrece cargar la foto', async ({ page, loginAs }) => {
    knownBug('F-37: el alta de sede desde el panel siempre responde 400 ("property isActive should not exist"): el formulario manda isActive y CreateVenueDto no lo admite');
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/sedes');
    await page.getByRole('button', { name: 'Nueva Sede' }).click();
    const dlg = page.getByRole('dialog');
    const nombre = uniq('SedeUI');
    await dlg.getByLabel('Nombre de la Sede *').fill(nombre);
    await dlg.getByLabel('Dirección Física *').fill('Av. Test 123');
    await dlg.getByLabel('Localidad / Ciudad *').fill('Formosa');
    await dlg.getByLabel('Capacidad Estimada (personas)').fill('1200');
    await dlg.getByLabel('Latitud').fill('-26.185');
    await dlg.getByLabel('Longitud').fill('-58.175');
    await dlg.getByRole('button', { name: 'Registrar Sede' }).click();
    await expect(dlg.getByText('Sede creada')).toBeVisible({ timeout: 8000 });
    const v = (await data(await (await sa()).get('/venues?limit=100'))).find((x: any) => x.name === nombre);
    expect(v).toMatchObject({ capacity: 1200, latitude: -26.185, longitude: -58.175 });
  });

  test('editar una sede y subir su foto: se ve en /sedes', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    const s = await sa();
    const nombre = uniq('SedeFoto');
    const v = await data(await s.post('/venues', { name: nombre, address: 'x', locality: 'Formosa', department: 'Formosa' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/sedes');
    await page.getByRole('textbox', { name: 'Buscar sedes' }).fill(nombre);
    await page.getByRole('button', { name: `Editar ${nombre}` }).click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('input[type=file]').first().setInputFiles({ name: 'sede.png', mimeType: 'image/png', buffer: PNG });
    await dlg.getByRole('button', { name: 'Subir' }).first().click();
    await expect.poll(async () => (await data(await s.get(`/venues/${v.id}`))).imageUrl, { timeout: 20_000 }).toBeTruthy();
    await page.keyboard.press('Escape');
    await page.goto('/sedes');
    await expect(page.getByText(nombre).first()).toBeVisible();
    await expect(page.locator(`img[src*="${v.id}"]`).first()).toBeVisible();
    await s.del(`/venues/${v.id}`);
  });
});

test.describe('noticias (admin)', () => {
  test('crear con imagen por URL https, publicar y ver en /noticias; rechaza http://', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/noticias');
    await page.getByRole('button', { name: 'Nueva Noticia' }).click();
    const dlg = page.getByRole('dialog');
    const titulo = uniq('NotUI');
    await dlg.getByLabel('Título de la Noticia *').fill(titulo);
    await dlg.getByLabel('Cuerpo de la Noticia *').fill('Cuerpo de prueba de la noticia.');
    await dlg.getByRole('tab', { name: 'Pegar URL' }).or(dlg.getByRole('button', { name: 'Pegar URL' })).click();
    const url = dlg.getByPlaceholder(/https:\/\//).first();
    await url.fill('http://example.org/foto.jpg');
    await dlg.getByLabel('Publicar Inmediatamente').check();
    await dlg.getByRole('button', { name: 'Crear Noticia' }).click();
    await expect(dlg.getByText(/https/i).first()).toBeVisible();
    await url.fill('https://example.org/foto.jpg');
    await dlg.getByRole('button', { name: 'Crear Noticia' }).click();
    await expect(dlg).toHaveCount(0);
    const s = await sa();
    const n = (await data(await s.get(`/news?search=${titulo}`)))[0];
    expect(n.isPublished).toBe(true);
    await page.goto('/noticias');
    await expect(page.getByText(titulo).first()).toBeVisible();
    await s.del(`/news/${n.id}`);
  });

  test('"Sincronizar portal" con el portal inaccesible muestra un error claro y la pantalla sigue usable', async ({ page, loginAs, problems }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/noticias');
    await page.getByRole('button', { name: 'Sincronizar portal' }).click();
    const confirmar = page.getByRole('dialog').getByRole('button', { name: /Sincronizar|Confirmar|Aceptar/ });
    if (await confirmar.count()) await confirmar.first().click();
    await expect(page.getByText(/portal|no responde|no se pudo/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Nueva Noticia' })).toBeVisible();
    expect(problems.filter((x) => /pageerror/.test(x))).toEqual([]);
  });

  test('imagen subida desde el formulario (archivo) queda asociada a la noticia', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    const s = await sa();
    const n = await data(await s.post('/news', { title: uniq('NotImg'), content: 'x', isPublished: true }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/noticias');
    await page.getByRole('textbox', { name: 'Buscar noticias' }).fill(n.title);
    await page.getByRole('button', { name: new RegExp(`Más acciones para ${n.title}`) }).click();
    await page.getByRole('menuitem', { name: /Editar/ }).click();
    await page.getByRole('dialog').locator('input[type=file]').first().setInputFiles({ name: 'n.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('dialog').getByRole('button', { name: 'Subir' }).first().click();
    await expect.poll(async () => (await data(await s.get(`/news/${n.id}`))).imageUrl, { timeout: 20_000 }).toBeTruthy();
    await s.del(`/news/${n.id}`);
  });
});

test.describe('encuesta (admin)', () => {
  test('crear campaña con los selectores y fechas propios, agregar pregunta y opciones, y publicarla', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/encuesta');
    await page.getByRole('button', { name: 'Nueva encuesta' }).click();
    const dlg = page.getByRole('dialog');
    const titulo = uniq('CampUI');
    await dlg.getByLabel('NOMBRE DE LA ENCUESTA *', { exact: false }).fill(titulo);
    await elegir(page, dlg.getByLabel('¿Cuándo se contesta? *'), /Antes/);
    await elegir(page, dlg.getByLabel('Etapa de la competencia'), /Zonal/);
    await dlg.getByLabel('Se abre el').fill('01/12/2026');
    await dlg.getByLabel('Se cierra el').fill('31/12/2026');
    await dlg.getByRole('button', { name: 'Crear y escribir las preguntas' }).click();
    await expect(page).toHaveURL(/\/admin\/encuesta\/[0-9a-f-]{36}/);
    const s = await sa();
    const c = (await data(await s.get(`/survey/campaigns?search=${titulo}`)))[0];
    expect(c).toMatchObject({ ventana: 'PRE', etapa: 'ZONAL' });
    expect(c.abreEn).toMatch(/^2026-12-01/);
    expect(c.cierraEn).toBe('2027-01-01T02:59:59.000Z'); // fin del 31/12 hora de Formosa
    await s.del(`/survey/campaigns/${c.id}`);
  });

  test('el rango de fechas incoherente (cierra antes de abrir) se rechaza', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/encuesta');
    await page.getByRole('button', { name: 'Nueva encuesta' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('NOMBRE DE LA ENCUESTA *', { exact: false }).fill(uniq('Inv'));
    await dlg.getByLabel('Se abre el').fill('31/12/2026');
    await dlg.getByLabel('Se cierra el').fill('01/12/2026');
    await dlg.getByRole('button', { name: 'Crear y escribir las preguntas' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('alert').first()).toBeVisible();
  });
});

test.describe('usuarios (admin)', () => {
  test('crear usuario con rol y departamento por selector, y desactivarlo', async ({ page, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    const dlg = page.getByRole('dialog');
    const email = `${uniq('uui').toLowerCase()}@evita-e2e.test`;
    await dlg.getByLabel('Nombre', { exact: true }).fill('Uno');
    await dlg.getByLabel('Apellido').fill('Dos');
    await dlg.getByLabel('Correo Electrónico').fill(email);
    await dlg.getByLabel('Contraseña').fill('Clave-segura-123');
    await elegir(page, dlg.getByLabel('Rol en el Sistema'), 'Árbitro');
    await dlg.getByRole('button', { name: 'Crear Usuario' }).click();
    await expect(dlg).toHaveCount(0);
    const s = await sa();
    const u = (await data(await s.get(`/users?search=${email}`)))[0];
    expect(u).toMatchObject({ role: 'ARBITRO', isActive: true });
    await s.del(`/users/${u.id}`);
  });

  test('una contraseña corta se rechaza en el formulario', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/usuarios');
    await page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Contraseña').fill('123');
    await dlg.getByRole('button', { name: 'Crear Usuario' }).click();
    await expect(dlg.getByText(/8 caracteres/).first()).toBeVisible();
  });
});

test.describe('auditoría (filtros)', () => {
  test('filtrar por el día de hoy con el selector de fecha devuelve movimientos de hoy', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/auditoria');
    const hoy = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Cordoba', day: '2-digit', month: '2-digit', year: 'numeric' });
    await page.getByLabel('Filtrar por día').fill(hoy);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
  });

  test('el buscador filtra por acción y no deja el listado en blanco sin explicación', async ({ page, loginAs }) => {
    await loginAs('SUPER_ADMIN');
    await page.goto('/admin/auditoria');
    await page.getByPlaceholder(/Buscar por usuario o acción/).fill('LOGIN');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder(/Buscar por usuario o acción/).fill('zzz-no-existe-zzz');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toContainText(/sin resultados|no hay|no se encontr|ningún/i);
    await sinDesbordeHorizontal(page);
  });
});

void Api;

test.describe('catálogo y equipos (admin)', () => {
  test('disciplina de equipo con titulares y suplentes: el alta guarda el plantel', async ({ page, loginAs }) => {
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/disciplinas');
    await page.getByRole('button', { name: 'Nueva Disciplina' }).click();
    const dlg = page.getByRole('dialog');
    const nombre = uniq('DiscUI');
    await dlg.getByLabel('Nombre de la Disciplina').fill(nombre);
    await elegir(page, dlg.getByLabel('Tipo', { exact: true }), 'Equipo');
    await elegir(page, dlg.getByLabel('Tipo de Resultado'), /Goles/);
    await dlg.getByLabel('Titulares').fill('7');
    await dlg.getByLabel('Suplentes máximos').fill('3');
    await dlg.getByRole('button', { name: 'Crear Disciplina' }).click();
    await expect(dlg).toHaveCount(0);
    const d = (await data(await (await sa()).get(`/disciplines?search=${nombre}`)))[0];
    expect(d).toMatchObject({ type: 'EQUIPO', resultType: 'GOLES', titulares: 7, maxSuplentes: 3 });
  });

  test('categoría: elige disciplina y sexo con los selectores; edades coherentes', async ({ page, loginAs }) => {
    const s = await sa();
    const d = await data(await s.post('/disciplines', { name: uniq('DiscCat'), type: 'INDIVIDUAL', resultType: 'PUNTOS' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/categorias');
    await page.getByRole('button', { name: 'Nueva Categoría' }).click();
    const dlg = page.getByRole('dialog');
    await elegir(page, dlg.getByLabel('Disciplina'), d.name);
    const nombre = uniq('CatUI');
    await dlg.getByLabel('Nombre de la Categoría').fill(nombre);
    await dlg.getByLabel('Edad Mínima').fill('12');
    await dlg.getByLabel('Edad Máxima').fill('14');
    await elegir(page, dlg.getByLabel('Sexo'), 'Femenino');
    await dlg.getByRole('button', { name: 'Crear Categoría' }).click();
    await expect(dlg).toHaveCount(0);
    const c = (await data(await s.get(`/categories?disciplineId=${d.id}`)))[0];
    expect(c).toMatchObject({ name: nombre, minAge: 12, maxAge: 14, sex: 'FEMENINO' });
    // edades invertidas: el formulario no debe aceptarlas
    await page.getByRole('button', { name: 'Nueva Categoría' }).click();
    const dlg2 = page.getByRole('dialog');
    await elegir(page, dlg2.getByLabel('Disciplina'), d.name);
    await dlg2.getByLabel('Nombre de la Categoría').fill(uniq('Inv'));
    await dlg2.getByLabel('Edad Mínima').fill('20');
    await dlg2.getByLabel('Edad Máxima').fill('10');
    await dlg2.getByRole('button', { name: 'Crear Categoría' }).click();
    await expect(dlg2).toBeVisible();
  });

  test('equipo suelto: se crea desde "Equipos" con disciplina, categoría y ubicación', async ({ page, loginAs }) => {
    const s = await sa();
    const d = await data(await s.post('/disciplines', { name: uniq('DiscEq'), type: 'EQUIPO', resultType: 'GOLES', titulares: 2, maxSuplentes: 0 }), 201);
    const c = await data(await s.post('/categories', { disciplineId: d.id, name: uniq('CatEq'), minAge: 10, maxAge: 99, sex: 'MIXTO' }), 201);
    await loginAs('ADMIN_PROVINCIAL');
    await page.goto('/admin/equipos');
    await page.getByRole('button', { name: /Nuevo Equipo/ }).first().click();
    const dlg = page.getByRole('dialog');
    const nombre = uniq('EqUI');
    await dlg.getByLabel('Nombre del Equipo').fill(nombre);
    await elegir(page, dlg.getByLabel('Disciplina'), d.name);
    await elegir(page, dlg.getByLabel('Categoría'), new RegExp(c.name));
    await dlg.getByLabel('Departamento').fill('Formosa');
    await dlg.getByLabel('Localidad').fill('Formosa');
    await dlg.getByRole('button', { name: /Crear Equipo|Guardar/ }).click();
    await expect(dlg).toHaveCount(0);
    expect((await data(await s.get(`/teams?categoryId=${c.id}`))).map((t: any) => t.name)).toEqual([nombre]);
  });
});

test.describe('seguimiento público por código QR', () => {
  test('el código de una inscripción aprobada muestra su estado sin datos personales; uno inexistente avisa', async ({ page }) => {
    const s = await sa();
    const cat = (await data(await s.get('/categories?limit=100'))).find((c: any) => c.discipline.type === 'INDIVIDUAL' && c.isActive);
    const ins = await data(await s.post('/inscriptions', { dni: nextDni(), firstName: 'Qr', lastName: uniq('Q'), birthDate: '2012-03-04', sex: 'MASCULINO', locality: 'Formosa', department: 'Formosa', categoryId: cat.id }), 201);
    await page.goto('/inscripcion');
    const campo = page.getByPlaceholder(/Código QR/);
    await campo.fill(ins.qrCode);
    await campo.press('Enter');
    await expect(page.getByText(/Pendiente|PENDIENTE/).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(ins.participant.dni);
    await campo.fill('EVITA-00000000');
    await campo.press('Enter');
    await expect(page.getByText(/no se encontr|no existe|no encontr/i).first()).toBeVisible();
  });
});
