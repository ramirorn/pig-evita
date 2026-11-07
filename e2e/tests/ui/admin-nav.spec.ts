// Login por la interfaz y navegación del panel por rol: menú, aterrizaje y accesos denegados.
import { Page } from '@playwright/test';
import { ROLES, RoleName, roleEmail } from '../../lib/api';
import { PASSWORD } from '../../lib/env';
import { knownBug } from '../../lib/bugs';
import { expect, relevantes, sinDesbordeHorizontal, test } from '../../lib/ui';

const ADMIN: RoleName[] = ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL'];
const SOLO_PROV: RoleName[] = ['SUPER_ADMIN', 'ADMIN_PROVINCIAL'];
const INSC: RoleName[] = [...ADMIN, 'DELEGADO'];
const PART: RoleName[] = [...ADMIN, 'DELEGADO', 'COORDINADOR'];

/** ruta → etiqueta del menú → roles que deben verla (espejo de lib/adminRoutes.ts + lib/roles.ts). */
const MAPA: Array<{ ruta: string; menu: string; roles: RoleName[] }> = [
  { ruta: '/admin/dashboard', menu: 'Dashboard', roles: [...ADMIN, 'COORDINADOR'] },
  { ruta: '/admin/mapa', menu: 'Mapa de impacto', roles: [...ADMIN, 'COORDINADOR'] },
  { ruta: '/admin/participantes', menu: 'Participantes', roles: PART },
  { ruta: '/admin/inscripciones', menu: 'Inscripciones', roles: INSC },
  { ruta: '/admin/nueva-inscripcion', menu: 'Nueva Inscripción', roles: INSC },
  { ruta: '/admin/equipos', menu: 'Equipos', roles: PART },
  { ruta: '/admin/documentos', menu: 'Documentos', roles: PART },
  { ruta: '/admin/disciplinas', menu: 'Disciplinas', roles: SOLO_PROV },
  { ruta: '/admin/categorias', menu: 'Categorías', roles: SOLO_PROV },
  { ruta: '/admin/competencias', menu: 'Competencias', roles: ADMIN },
  { ruta: '/admin/resultados', menu: 'Resultados', roles: [...ADMIN, 'ARBITRO'] },
  { ruta: '/admin/noticias', menu: 'Noticias', roles: ADMIN },
  { ruta: '/admin/calendario', menu: 'Calendario', roles: ADMIN },
  { ruta: '/admin/sedes', menu: 'Sedes', roles: ADMIN },
  { ruta: '/admin/encuesta', menu: 'Encuesta', roles: ADMIN },
  { ruta: '/admin/usuarios', menu: 'Usuarios', roles: SOLO_PROV },
  { ruta: '/admin/reportes', menu: 'Reportes', roles: INSC },
  { ruta: '/admin/auditoria', menu: 'Auditoría', roles: SOLO_PROV },
];

async function loginPorFormulario(page: Page, rol: RoleName) {
  await page.goto('/admin/login');
  await page.locator('#login-email').fill(roleEmail(rol));
  await page.locator('#login-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
}
async function abrirMenuMovil(page: Page) {
  const b = page.getByRole('button', { name: 'Abrir menú' });
  if (await b.isVisible()) await b.click();
}

test.describe('login', () => {
  test('credenciales incorrectas muestran un error y no entran', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#login-email').fill(roleEmail('SUPER_ADMIN'));
    await page.locator('#login-password').fill('contraseña-incorrecta');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('campos vacíos / email inválido no envían la solicitud', async ({ page }) => {
    let enviadas = 0;
    page.on('request', (r) => { if (r.url().includes('/auth/login')) enviadas++; });
    await page.goto('/admin/login');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await page.locator('#login-email').fill('no-es-email');
    await page.locator('#login-password').fill('x');
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await page.waitForTimeout(500);
    expect(enviadas).toBe(0);
  });

  test('mostrar/ocultar contraseña', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  });

  test('sin sesión, cualquier ruta del panel redirige al login', async ({ page }) => {
    for (const r of ['/admin', '/admin/participantes', '/admin/usuarios']) {
      await page.goto(r);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test('login válido → aterriza en el dashboard; cerrar sesión vuelve al login y la sesión no se recupera', async ({ page }) => {
    await loginPorFormulario(page, 'SUPER_ADMIN');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await abrirMenuMovil(page);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/admin\/login|\/$/);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('la sesión sobrevive a recargar la página (refresh por cookie httpOnly)', async ({ page }) => {
    await loginPorFormulario(page, 'ADMIN_PROVINCIAL');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toMatch(/eyJ/); // ningún JWT en localStorage
  });
});

for (const rol of ['ENTRENADOR', 'OPERADOR_MESA'] as RoleName[]) {
  test(`${rol}: tras iniciar sesión recibe una explicación (no cae mudo en la portada pública)`, async ({ page }) => {
    knownBug('F-42: ENTRENADOR y OPERADOR_MESA se pueden crear e iniciar sesión pero no tienen ninguna pantalla del panel: el login los deja en la portada pública sin ningún mensaje');
    await loginPorFormulario(page, rol);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // el panel redirige a la portada tras evaluar el rol: se espera a que se asiente
    const conMensaje = (await page.getByText(/no tenés acceso|sin acceso|no tiene acceso|no hay pantallas|no tenés permisos|Acceso Denegado/i).count()) > 0;
    expect(conMensaje).toBe(true);
  });
}

for (const rol of ROLES) {
  test.describe(`rol ${rol}`, () => {
    test('aterrizaje, menú lateral y accesos coinciden con los permisos', async ({ page, problems }) => {
      await loginPorFormulario(page, rol);
      const permitidas = MAPA.filter((m) => m.roles.includes(rol));
      if (permitidas.length === 0) {
        // ENTRENADOR / OPERADOR_MESA no pertenecen a ningún grupo del panel.
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveURL(/\/admin\/(dashboard|participantes)/);
        return;
      }
      await expect(page).toHaveURL(/\/admin\/(dashboard|resultados|inscripciones|participantes)/);
      await sinDesbordeHorizontal(page);
      await abrirMenuMovil(page);
      for (const m of MAPA) {
        const link = page.getByRole('navigation').getByRole('link', { name: m.menu, exact: true });
        if (m.roles.includes(rol)) await expect(link.first(), `${rol} debería ver "${m.menu}"`).toBeVisible();
        else await expect(link, `${rol} NO debería ver "${m.menu}"`).toHaveCount(0);
      }
      expect(relevantes(problems), relevantes(problems).join('\n')).toEqual([]);
    });

    test('abrir por URL cada pantalla: permitida carga, no permitida muestra "Acceso Denegado"', async ({ page, loginAs }) => {
      await loginAs(rol);
      for (const m of MAPA) {
        await page.goto(m.ruta);
        await expect(page.getByText('Cargando...')).toHaveCount(0, { timeout: 15_000 });
        if (m.roles.includes(rol)) {
          await expect(page.getByText('Acceso Denegado'), `${rol} en ${m.ruta}`).toHaveCount(0);
          await expect(page.locator('main').first()).toBeVisible();
        } else {
          await expect
            .poll(async () => (await page.getByText('Acceso Denegado').count()) > 0 || new URL(page.url()).pathname !== m.ruta, { message: `${rol} no debería poder usar ${m.ruta}` })
            .toBe(true);
        }
      }
    });
  });
}
