// ===========================================
// Red de la paleta
//
// Falla si aparece una familia de color cruda de Tailwind (red-600, amber-100,
// emerald-50, slate-200, etc.) en `src/**/*.{ts,tsx,css}`. La app usa sólo los
// tokens de marca y semánticos de `@theme` en `src/index.css`:
//   primary / celeste / secondary / accent / muted / surface / heat
//   destructive (rojo) · success (verde) · warning (ámbar)
//
// Modo: ESTRICTO en todo `src/` desde 2026-11-08; un hallazgo hace salir con
// código 1. (Mientras se migraban las páginas, `src/pages/**` era sólo reporte.)
//
// Corre con: npm run check:palette
// ===========================================
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const PAGINAS = path.join(SRC, 'pages') + path.sep;
const MODO_PAGINAS_ESTRICTO = true; // src/pages/** ya quedó limpio: estricto en todo src/

const FAMILIAS = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'slate', 'gray', 'zinc', 'neutral', 'stone',
];
// `heat-green` / `border-green-…` no existen: se exige el sufijo numérico.
const PATRON = new RegExp(`(?<![\w-])(?:${FAMILIAS.join('|')})-(?:50|[1-9]00|950)(?![\w-])`, 'g');

async function archivos(dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await archivos(ruta)));
    else if (/\.(ts|tsx|css)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

const estrictos = [];
const soloReporte = [];

for (const archivo of await archivos(SRC)) {
  const lineas = (await readFile(archivo, 'utf8')).split(/\r?\n/);
  lineas.forEach((linea, indice) => {
    const coincidencias = linea.match(PATRON);
    if (!coincidencias) return;
    const entrada = `${path.relative(RAIZ, archivo)}:${indice + 1} (${[...new Set(coincidencias)].join(', ')})`;
    const enPaginas = archivo.startsWith(PAGINAS);
    (enPaginas && !MODO_PAGINAS_ESTRICTO ? soloReporte : estrictos).push(entrada);
  });
}

if (soloReporte.length > 0) {
  console.warn(`\n⚠️  ${soloReporte.length} color(es) crudo(s) en src/pages/** (sólo reporte):\n`);
  for (const h of soloReporte) console.warn(`  · ${h}`);
}

if (estrictos.length > 0) {
  console.error(`\n❌ ${estrictos.length} color(es) crudo(s) de Tailwind. Usá los tokens de src/index.css:\n`);
  for (const h of estrictos) console.error(`  · ${h}`);
  process.exit(1);
}

console.log('✅ Paleta: sin familias de color crudas en src/.');
