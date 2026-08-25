// ===========================================
// Chequeo de sincronización del menú admin (R08)
//
// El bug que cierra: el `Sidebar` había quedado fuera de la migración de T14.
// El router declaraba `allowedRoles` desde `@/lib/roles`, pero el menú importaba
// un `ADMIN_ROLES` duplicado de `@/lib/constants` y armaba listas inline. Dos
// fuentes de verdad que divergían en las dos direcciones: un ARBITRO veía siete
// links y seis le respondían "Acceso Denegado", y un ADMIN_PROVINCIAL podía
// entrar a Usuarios sin ver nunca el link.
//
// El arreglo estructural es que `NAV_ITEMS` ya no declara roles: cada ítem lleva
// un `path` y la visibilidad se deriva de `ADMIN_ROUTE_ROLES`, que es lo mismo
// que consume el router. Este chequeo fija esa propiedad para que nadie la
// deshaga agregando un `roles:` inline "por conveniencia".
//
// R22 lo extiende de la pantalla a la **acción**: `adminActions.ts` espeja el
// mapa `ACCIONES` del backend y este chequeo compara los dos, bundleando el
// archivo real del backend. Así, si allá cambia un `@Roles(...)` y acá no,
// esto se pone en rojo antes de que un botón visible devuelva 403.
//
// Corre con: npm run check:nav
// ===========================================
import { execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-nav-roles.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

// -------------------------------------------------
// Se bundlea el fuente REAL, no una copia de la lógica
// -------------------------------------------------
// Se usa el CLI y no la API: `esbuild` no es dependencia directa del proyecto
// (Vite 8 usa rolldown), así que no hay paquete que importar.
const ENTRADA = path.join(RAIZ, 'scripts', 'nav-roles.entry.ts');
const SRC = path.join(RAIZ, 'src');

execSync(
  [
    'npx esbuild',
    `"${ENTRADA}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --jsx=automatic --log-level=error',
    `"--alias:@=${SRC}"`,
    // Los iconos de lucide son JSX que acá no se renderiza; que resuelva alcanza.
    '--external:react --external:react/jsx-runtime --external:lucide-react',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

// El espejo se compara contra el archivo REAL del backend, bundleado aparte.
const ENTRADA_BACKEND = path.join(RAIZ, 'scripts', 'backend-actions.entry.ts');
const SALIDA_BACKEND = path.join(
  RAIZ,
  'node_modules',
  '.cache',
  'check-nav-backend-actions.mjs',
);

execSync(
  [
    'npx esbuild',
    `"${ENTRADA_BACKEND}"`,
    `"--outfile=${SALIDA_BACKEND}"`,
    '--bundle --format=esm --platform=node --log-level=error',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const { ACCIONES: ACCIONES_BACKEND } = await import(
  pathToFileURL(SALIDA_BACKEND).href
);

const {
  navItemsParaRol,
  ADMIN_ROUTE_ROLES,
  puedeVerRuta,
  rutaInicialPara,
  destinoPostLogin,
  QUICK_ACTIONS,
  quickActionsParaRol,
  ADMIN_AREA_ROLES,
  ACTION_ROLES,
  ACCIONES_POR_PANTALLA,
  puedeAccion,
  ROLES_CON_ALCANCE_PROVINCIAL,
  ROUTES,
  UserRole,
} = await import(pathToFileURL(SALIDA).href);

const ROLES = Object.values(UserRole);

/**
 * Rutas del panel que **a propósito** no tienen entrada en el menú.
 *
 * Son las de detalle —a las que se llega desde un listado, no desde el menú— y
 * la raíz del área, que redirige. Está explícita y no inferida: si mañana alguien
 * agrega una pantalla nueva al router y se olvida del link, tiene que decidir
 * conscientemente que va acá, en vez de que el chequeo lo deje pasar en silencio.
 */
const SIN_ENTRADA_EN_EL_MENU = new Set([
  ROUTES.ADMIN,
  ROUTES.PARTICIPANT_DETAIL,
  ROUTES.INSCRIPTION_DETAIL,
  ROUTES.TEAM_DETAIL,
  ROUTES.COMPETITION_DETAIL,
]);

// -------------------------------------------------
// 1. El DoD: menú y router no pueden divergir, en ninguna dirección
// -------------------------------------------------
for (const role of ROLES) {
  const visibles = navItemsParaRol(role);

  // Dirección A: nada visible puede estar cerrado.
  for (const item of visibles) {
    comprobar(
      `[${role}] el link "${item.label}" lleva a una ruta que puede abrir`,
      puedeVerRuta(role, item.path),
    );
  }

  // Dirección B: nada abierto puede estar oculto. Ésta es la que se olvida, y
  // es la que dejaba a un ADMIN_PROVINCIAL sin ver Usuarios.
  //
  // Se recorren las rutas del **router**, no `NAV_ITEMS`: recorrer el menú sólo
  // detecta ítems mal filtrados, no un ítem que directamente no existe. Con la
  // versión anterior de este chequeo, borrar "Reportes" del menú pasaba en
  // verde — comprobado.
  const rutasVisibles = new Set(visibles.map((i) => i.path));
  for (const path of Object.keys(ADMIN_ROUTE_ROLES)) {
    if (SIN_ENTRADA_EN_EL_MENU.has(path)) continue;

    verificaciones.push(`[${role}] la ruta ${path} está en el menú ⇔ es alcanzable`);
    if (puedeVerRuta(role, path) && !rutasVisibles.has(path)) {
      problemas.push(
        `[${role}] puede entrar a ${path} pero el menú no se lo muestra`,
      );
    }
  }
}

// -------------------------------------------------
// 2. Que no vuelva a existir una segunda fuente de verdad
// -------------------------------------------------
const fuenteNavItems = await readFile(
  path.join(RAIZ, 'src', 'components', 'layout', 'navItems.tsx'),
  'utf8',
);
comprobar(
  'NAV_ITEMS no declara roles inline: la visibilidad se deriva de ADMIN_ROUTE_ROLES',
  !/^\s*roles:\s*\[/m.test(fuenteNavItems),
  'apareció un `roles: [...]` en navItems.tsx',
);

const fuenteConstants = await readFile(
  path.join(RAIZ, 'src', 'lib', 'constants.ts'),
  'utf8',
);
comprobar(
  'constants.ts ya no exporta su ADMIN_ROLES duplicado',
  !/export\s+const\s+ADMIN_ROLES/.test(fuenteConstants),
);

const fuenteSidebar = await readFile(
  path.join(RAIZ, 'src', 'components', 'layout', 'Sidebar.tsx'),
  'utf8',
);
comprobar(
  'el Sidebar no arma su propia lista: consume navItemsParaRol',
  fuenteSidebar.includes('navItemsParaRol'),
);

// -------------------------------------------------
// 3. Cada rol aterriza donde efectivamente puede entrar
// -------------------------------------------------
for (const role of ROLES) {
  const destino = rutaInicialPara(role);
  const esDelPanel = Object.hasOwn(ADMIN_ROUTE_ROLES, destino);

  comprobar(
    `[${role}] aterriza post-login en una ruta que puede ver (${destino})`,
    !esDelPanel || puedeVerRuta(role, destino),
  );

  // Un rol sin ninguna pantalla del panel va a la home, no a un cartel de
  // "Acceso Denegado".
  const tienePanel = ADMIN_AREA_ROLES.includes(role);
  if (!tienePanel) {
    comprobar(
      `[${role}] no tiene panel, así que aterriza en la home`,
      destino === ROUTES.HOME,
      `aterriza en ${destino}`,
    );
  }
}

// El caso que originó la tarea, explícito para que se lea en el output.
comprobar(
  'ARBITRO no aterriza en el dashboard, que no puede ver',
  rutaInicialPara(UserRole.ARBITRO) !== ROUTES.DASHBOARD,
);
comprobar(
  'ARBITRO aterriza en Resultados, su única pantalla real',
  rutaInicialPara(UserRole.ARBITRO) === ROUTES.RESULTS,
);

// -------------------------------------------------
// 4. La ruta intentada antes del login se respeta sólo si es alcanzable
// -------------------------------------------------
comprobar(
  'se respeta la ruta intentada cuando el rol puede verla',
  destinoPostLogin(UserRole.SUPER_ADMIN, ROUTES.USERS) === ROUTES.USERS,
);
comprobar(
  'se descarta la ruta intentada cuando el rol NO puede verla',
  destinoPostLogin(UserRole.ARBITRO, ROUTES.USERS) !== ROUTES.USERS,
);
comprobar(
  'una ruta con :id resuelve contra su patrón (no se escapa por el uuid)',
  destinoPostLogin(UserRole.ARBITRO, '/admin/inscripciones/abc-123') !==
    '/admin/inscripciones/abc-123',
);
comprobar(
  'una ruta fuera del panel se respeta tal cual',
  destinoPostLogin(UserRole.ARBITRO, '/noticias') === '/noticias',
);

// -------------------------------------------------
// 5. Los accesos rápidos del dashboard, que se pintaban sin filtrar
// -------------------------------------------------
for (const role of ROLES) {
  for (const accion of quickActionsParaRol(role)) {
    comprobar(
      `[${role}] el acceso rápido "${accion.label}" lleva a una ruta que puede abrir`,
      puedeVerRuta(role, accion.link),
    );
  }
}

comprobar(
  'un COORDINADOR no ve los 4 accesos rápidos: 3 le daban Acceso Denegado',
  quickActionsParaRol(UserRole.COORDINADOR).length < QUICK_ACTIONS.length,
);

// -------------------------------------------------
// 6. Los separadores se arrastran al primer ítem visible del grupo
// -------------------------------------------------
for (const role of ROLES) {
  const visibles = navItemsParaRol(role);
  comprobar(
    `[${role}] el menú no arranca con un separador colgado`,
    visibles.length === 0 || visibles[0].showSeparator === false,
  );
}


// -------------------------------------------------
// 7. R22 — el espejo de permisos no puede divergir del backend
// -------------------------------------------------
//
// Ésta es la comparación que hace que `adminActions.ts` valga: se bundlea
// `backend/src/common/constants/index.ts` y se compara acción por acción. Sin
// esto, el espejo es un comentario que dice "acordate de actualizarlo".
{
  const normalizar = (roles) => [...roles].sort().join(',');
  const accionesBackend = Object.keys(ACCIONES_BACKEND).sort();
  const accionesFrontend = Object.keys(ACTION_ROLES).sort();

  comprobar(
    'el frontend espeja exactamente las mismas acciones que el backend',
    accionesBackend.join('|') === accionesFrontend.join('|'),
    `backend: ${accionesBackend.length} acciones, frontend: ${accionesFrontend.length}`,
  );

  for (const accion of accionesBackend) {
    const enBackend = normalizar(ACCIONES_BACKEND[accion]);
    const enFrontend = ACTION_ROLES[accion]
      ? normalizar(ACTION_ROLES[accion])
      : '(no existe en el frontend)';

    comprobar(
      `[${accion}] los roles del frontend coinciden con los del backend`,
      enBackend === enFrontend,
      `backend: [${enBackend}] · frontend: [${enFrontend}]`,
    );
  }
}

// -------------------------------------------------
// 8. R22 — ninguna acción permitida queda inalcanzable
// -------------------------------------------------
//
// La dirección que se olvida, igual que en el menú: un rol puede tener el
// permiso y no tener ninguna pantalla donde ejercerlo. El permiso queda
// decorativo y nadie se entera, porque no falla nada.
for (const [pantalla, acciones] of Object.entries(ACCIONES_POR_PANTALLA)) {
  for (const accion of acciones) {
    for (const role of ROLES) {
      if (!puedeAccion(role, accion)) continue;

      verificaciones.push(
        `[${role}] puede ${accion} y llega a ${pantalla}, donde está el botón`,
      );
      if (!puedeVerRuta(role, pantalla)) {
        problemas.push(
          `[${role}] puede ejecutar ${accion} pero no puede entrar a ${pantalla}, ` +
            'que es donde vive ese botón',
        );
      }
    }
  }
}

// -------------------------------------------------
// 9. R22 — las pantallas con acciones restringidas consultan el permiso
// -------------------------------------------------
//
// El mapa puede estar perfecto y la pantalla pintar el botón igual. Se
// verifica en el fuente, que es donde está el riesgo: son los archivos donde
// el grupo de roles de la ruta es MÁS ANCHO que el de la acción, o sea los
// que producían el 403.
const PANTALLAS_QUE_FILTRAN = [
  ['src/pages/admin/ParticipantsPage.tsx', ['PARTICIPANT_CREATE', 'PARTICIPANT_UPDATE']],
  ['src/pages/admin/TeamsAdminPage.tsx', ['TEAM_CREATE', 'TEAM_UPDATE', 'TEAM_DELETE']],
  ['src/pages/admin/UsersPage.tsx', ['USER_MANAGE']],
  ['src/pages/admin/DocumentsPage.tsx', ['DOCUMENT_REVIEW']],
  [
    'src/pages/admin/inscription-detail/InscriptionReviewPanel.tsx',
    ['INSCRIPTION_APPROVE'],
  ],
];

for (const [archivo, acciones] of PANTALLAS_QUE_FILTRAN) {
  const fuente = await readFile(path.join(RAIZ, archivo), 'utf8');

  comprobar(
    `${archivo} consulta los permisos con usePermisos`,
    fuente.includes('usePermisos'),
    'no importa el hook de permisos',
  );

  for (const accion of acciones) {
    comprobar(
      `${archivo} decide el botón de ${accion} por permiso`,
      fuente.includes(`'${accion}'`),
      `no aparece ${accion} en el fuente`,
    );
  }
}

// -------------------------------------------------
// 10. R05 — la UI no ofrece filtros territoriales que el rol no puede usar
// -------------------------------------------------
{
  const acotados = ROLES.filter(
    (role) => !ROLES_CON_ALCANCE_PROVINCIAL.includes(role),
  );
  comprobar(
    'hay roles acotados por territorio (red de seguridad del propio chequeo)',
    acotados.length > 0,
  );

  for (const archivo of [
    'src/pages/admin/participants/ParticipantsToolbar.tsx',
    'src/pages/admin/teams/TeamsToolbar.tsx',
    'src/pages/admin/reports/ReportFiltersPanel.tsx',
  ]) {
    const fuente = await readFile(path.join(RAIZ, archivo), 'utf8');
    comprobar(
      `${archivo} condiciona el filtro de departamento al alcance`,
      fuente.includes('mostrarFiltroDepartamento'),
      'el filtro de departamento se pinta siempre',
    );
  }
}

await rm(SALIDA_BACKEND, { force: true });

await rm(SALIDA, { force: true });

// -------------------------------------------------
console.log(`Chequeos ejecutados: ${verificaciones.length}`);

if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} divergencia(s) entre el menú y el router:\n`);
  for (const p of problemas) console.error(`   · ${p}`);
  process.exit(1);
}

console.log('✅ Menú, accesos rápidos y aterrizaje post-login sincronizados con el router.');
