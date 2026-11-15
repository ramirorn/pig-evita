// ===========================================
// Red de los controles propios
//
// Fija que fuera de `src/components/ui/` no vuelve ningún control nativo del
// navegador ni diálogo del sistema:
//
//   - `<select>`, `<option>`, `<datalist>`
//   - `<input type="checkbox|radio|number|date|time|datetime-local">`
//   - `window.confirm(` / `alert(` / `prompt(`
//
// Se ven distinto en cada navegador, no siguen el estilo del sitio y no tienen
// el área táctil de 44 px. Se usan `SelectField`, `DatePicker`, `ClockTimePicker`,
// `Checkbox`, `Switch`, `RadioGroup`, `NumberField` y `ConfirmDialog`.
//
// Se permite `<input type="file">` oculto (el selector de archivos no tiene
// reemplazo posible). Los componentes de `src/components/ui/` son la única
// excepción: ahí vive la implementación.
//
// Corre con: npm run check:controls
// ===========================================
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const UI = path.join(SRC, 'components', 'ui') + path.sep;

const TIPOS_NATIVOS = ['checkbox', 'radio', 'number', 'date', 'time', 'datetime-local'];
const tipo = (nombre) =>
  new RegExp(`\\btype\\s*=\\s*(?:\\{\\s*)?["'\`]${nombre}["'\`]`);

const PATRONES = [
  { nombre: '<select>', patron: /<select\b/ },
  { nombre: '<option>', patron: /<option\b/ },
  { nombre: '<datalist>', patron: /<datalist\b/ },
  ...TIPOS_NATIVOS.map((nombre) => ({ nombre: `type="${nombre}"`, patron: tipo(nombre) })),
  // `type={cond ? 'checkbox' : 'radio'}` (tipo dinámico)
  {
    nombre: 'type={… checkbox/radio/number/date/time …}',
    patron: new RegExp(
      `\\btype\\s*=\\s*\\{[^}]*["'\`](?:${TIPOS_NATIVOS.join('|')})["'\`]`,
    ),
  },
  { nombre: 'window.confirm(', patron: /\bwindow\s*\.\s*(?:confirm|alert|prompt)\s*\(/ },
  // `confirm(`, `alert(` o `prompt(` sueltos (no `.confirm(` de otro objeto ni `onConfirm(`).
  { nombre: 'confirm( / alert( / prompt(', patron: /(?<![\w.$])(?:confirm|alert|prompt)\s*\(/ },
];

async function archivosFuente(dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await archivosFuente(ruta)));
    else if (/\.tsx$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

const hallazgos = [];
let revisados = 0;

for (const archivo of await archivosFuente(SRC)) {
  if (archivo.startsWith(UI)) continue;
  revisados += 1;
  const lineas = (await readFile(archivo, 'utf8')).split('\n');
  lineas.forEach((linea, indice) => {
    // Los comentarios que explican por qué ya no se usa el control nativo no cuentan.
    const codigo = linea.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (/^\s*\*/.test(linea) || codigo.trim() === '') return;
    for (const { nombre, patron } of PATRONES) {
      if (patron.test(codigo)) {
        hallazgos.push(`${path.relative(RAIZ, archivo)}:${indice + 1} (${nombre})`);
      }
    }
  });
}

if (hallazgos.length > 0) {
  console.error(`\n❌ ${hallazgos.length} control(es) nativo(s) fuera de src/components/ui/:\n`);
  for (const hallazgo of hallazgos) console.error(`  · ${hallazgo}`);
  console.error(
    '\nUsá SelectField, DatePicker, ClockTimePicker, Checkbox, Switch, RadioGroup, NumberField o ConfirmDialog.\n',
  );
  process.exit(1);
}

console.log(`Archivos revisados: ${revisados}`);
console.log('✅ Sin controles nativos fuera de src/components/ui/ (select, checkbox, radio, number, fecha, hora, confirm).');
