// ===========================================
// Etiquetas de la pantalla de auditoría (S8)
//
// La pantalla mostraba datos inventados y en inglés ("LOGIN", "Competition").
// Ahora lee `GET /audit` y traduce la acción y la entidad. Este chequeo fija lo
// que se rompe sin que nadie lo note:
//
//   1. Toda acción de `AuditAction` (el enum REAL del backend, bundleado) tiene
//      etiqueta en castellano. Si se agrega una allá, este chequeo falla.
//   2. Ninguna etiqueta es el código crudo.
//   3. Lo desconocido cae en un texto legible, nunca en el código tal cual.
//   4. El autor sin usuario es "Sistema" y el rango de días es de hora local.
//
// Se bundlea el fuente real con esbuild, igual que check-survey.mjs.
//
// Corre con: npm run check:audit
// ===========================================
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-audit.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'audit.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_FILTERS,
  etiquetaAccion,
  etiquetaEntidad,
  tonoAccion,
  autorAuditoria,
  rangoAuditoria,
  AuditAction,
} = await import(pathToFileURL(SALIDA).href);

// -------------------------------------------------
// 1. Cobertura contra el enum del backend
// -------------------------------------------------
const accionesBackend = Object.values(AuditAction);
comprobar('el enum AuditAction del backend se pudo leer', accionesBackend.length >= 16);

const sinEtiqueta = accionesBackend.filter((a) => !AUDIT_ACTION_LABELS[a]);
comprobar(
  'toda acción del backend tiene etiqueta en castellano',
  sinEtiqueta.length === 0,
  sinEtiqueta.join(', '),
);

const sobrantes = Object.keys(AUDIT_ACTION_LABELS).filter((a) => !accionesBackend.includes(a));
comprobar(
  'no hay etiquetas de acciones que el backend no tiene',
  sobrantes.length === 0,
  sobrantes.join(', '),
);

const sinTono = accionesBackend.filter((a) => tonoAccion(a) === 'neutro');
comprobar('toda acción del backend tiene un tono asignado', sinTono.length === 0, sinTono.join(', '));

// -------------------------------------------------
// 2. Ninguna etiqueta es el código crudo
// -------------------------------------------------
for (const [clave, etiqueta] of Object.entries(AUDIT_ACTION_LABELS)) {
  comprobar(
    `la acción ${clave} no se muestra como su código`,
    etiqueta !== clave && etiqueta.trim() !== '',
  );
  comprobar(`etiquetaAccion(${clave}) usa la etiqueta`, etiquetaAccion(clave) === etiqueta);
}
for (const [clave, etiqueta] of Object.entries(AUDIT_ENTITY_LABELS)) {
  comprobar(
    `la entidad ${clave} no se muestra como su clave`,
    etiqueta !== clave && etiqueta.trim() !== '',
  );
  comprobar(`etiquetaEntidad(${clave}) usa la etiqueta`, etiquetaEntidad(clave) === etiqueta);
}

const entidadesEsperadas = [
  'venues', 'inscriptions', 'calendar', 'news', 'participants', 'competitions',
  'results', 'teams', 'users', 'documents', 'categories', 'disciplines',
  'survey', 'zones', 'metrics', 'User',
];
const entidadesFaltantes = entidadesEsperadas.filter((e) => !AUDIT_ENTITY_LABELS[e]);
comprobar(
  'toda entidad auditada conocida tiene etiqueta',
  entidadesFaltantes.length === 0,
  entidadesFaltantes.join(', '),
);
comprobar(
  'el filtro de entidad no ofrece "User" (se pisa con "users")',
  !AUDIT_ENTITY_FILTERS.includes('User'),
);
comprobar('la entidad se resuelve sin importar mayúsculas', etiquetaEntidad('VENUES') === 'Sedes');
comprobar(
  'la acción se resuelve sin importar mayúsculas',
  etiquetaAccion('login') === 'Inicio de sesión',
);

// -------------------------------------------------
// 3. Respaldo legible
// -------------------------------------------------
comprobar(
  'acción desconocida cae en texto legible',
  etiquetaAccion('BULK_IMPORT') === 'Bulk import',
  etiquetaAccion('BULK_IMPORT'),
);
comprobar(
  'entidad desconocida cae en texto legible',
  etiquetaEntidad('team-roles') === 'Team roles',
  etiquetaEntidad('team-roles'),
);
comprobar('acción vacía muestra un guion', etiquetaAccion('') === '—' && etiquetaAccion(null) === '—');
comprobar('entidad vacía muestra un guion', etiquetaEntidad(undefined) === '—');
comprobar('acción desconocida queda neutra', tonoAccion('BULK_IMPORT') === 'neutro');
comprobar(
  'los rechazos y bajas son de tono peligro',
  tonoAccion('REJECT_INSCRIPTION') === 'peligro' && tonoAccion('DELETE') === 'peligro',
);
comprobar('las altas son de tono éxito', tonoAccion('CREATE') === 'exito');

// -------------------------------------------------
// 4. Autor y rango de fechas
// -------------------------------------------------
comprobar(
  'sin usuario el autor es "Sistema"',
  autorAuditoria(null).nombre === 'Sistema' && autorAuditoria(null).email === null,
);
{
  const a = autorAuditoria({ email: 'ana@evita.gob.ar', firstName: 'Ana', lastName: 'Pérez' });
  comprobar(
    'con usuario se muestra nombre y email',
    a.nombre === 'Ana Pérez' && a.email === 'ana@evita.gob.ar',
  );
  const b = autorAuditoria({ email: 'sin@nombre.ar', firstName: null, lastName: '' });
  comprobar(
    'usuario sin nombre muestra el email una sola vez',
    b.nombre === 'sin@nombre.ar' && b.email === null,
  );
  comprobar(
    'el nombre no muestra "null"',
    autorAuditoria({ email: 'x@y.z', firstName: 'Ana', lastName: null }).nombre === 'Ana',
  );
}
{
  comprobar('sin fechas no se filtra', Object.keys(rangoAuditoria('', '')).length === 0);
  comprobar(
    'una fecha mal formada no filtra',
    Object.keys(rangoAuditoria('15/11/2026', 'x')).length === 0,
  );
  const r = rangoAuditoria('2026-11-15', '2026-11-15');
  const desde = new Date(r.fromDate);
  const hasta = new Date(r.toDate);
  comprobar(
    'el inicio del rango es la medianoche local del día',
    desde.getFullYear() === 2026 &&
      desde.getMonth() === 10 &&
      desde.getDate() === 15 &&
      desde.getHours() === 0 &&
      desde.getMinutes() === 0,
    r.fromDate,
  );
  comprobar(
    'el fin del rango es el último milisegundo local del día',
    hasta.getDate() === 15 && hasta.getHours() === 23 && hasta.getMilliseconds() === 999,
    r.toDate,
  );
  const soloDesde = rangoAuditoria('2026-11-15', '');
  comprobar('sólo "desde" manda sólo fromDate', soloDesde.fromDate && !('toDate' in soloDesde));
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en las etiquetas de auditoría:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Toda acción y entidad de auditoría se muestra en castellano.');
