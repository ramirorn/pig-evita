// ===========================================
// Valores que faltan: nunca "null" ni "undefined" en pantalla (S10)
//
// La interfaz mostraba "null - null" en el rango de jugadores de una
// disciplina individual, "null por equipo", títulos "Fútbol - undefined" y
// códigos de enum crudos ("EQUIPO", "ROUND_ROBIN"). Este chequeo fija:
//
//   1. Los helpers puros de `lib/format.ts` (bundleados del fuente real).
//   2. Que las pantallas que tenían el problema los usen y no vuelvan a
//      interpolar el dato crudo.
//
// Corre con: npm run check:format
// ===========================================
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-format.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'format.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  SIN_DATO,
  textoOGuion,
  rangoJugadores,
  etiquetaEnum,
  tituloCompuesto,
  DISCIPLINE_TYPE_LABELS,
  RESULT_TYPE_LABELS,
  STAGE_LABELS,
  FORMAT_LABELS,
  SEX_LABELS,
  COMPETITION_STATUS_LABELS,
  INSCRIPTION_STATUS_LABELS,
} = await import(pathToFileURL(SALIDA).href);

const sinNulos = (texto) => !/null|undefined|NaN/.test(texto);

// -------------------------------------------------
// 1. rangoJugadores
// -------------------------------------------------
comprobar('sin mínimo ni máximo es un guion', rangoJugadores(null, null) === SIN_DATO);
comprobar('undefined también es un guion', rangoJugadores(undefined, undefined) === SIN_DATO);
comprobar('iguales muestran un solo número', rangoJugadores(11, 11) === '11');
comprobar('distintos muestran "5 a 7"', rangoJugadores(5, 7) === '5 a 7', rangoJugadores(5, 7));
comprobar('sólo máximo muestra "Hasta 7"', rangoJugadores(null, 7) === 'Hasta 7');
comprobar('sólo mínimo muestra "Desde 5"', rangoJugadores(5, null) === 'Desde 5');
comprobar('el cero es un número válido', rangoJugadores(0, 0) === '0');
comprobar('NaN no se muestra', rangoJugadores(Number.NaN, Number.NaN) === SIN_DATO);

// -------------------------------------------------
// 2. etiquetaEnum
// -------------------------------------------------
comprobar('un enum conocido usa su etiqueta', etiquetaEnum(DISCIPLINE_TYPE_LABELS, 'EQUIPO') === 'Equipo');
comprobar('formato en castellano', etiquetaEnum(FORMAT_LABELS, 'ROUND_ROBIN') === 'Todos contra todos');
comprobar('etapa en castellano', etiquetaEnum(STAGE_LABELS, 'ZONAL') === 'Zonal');
comprobar('sexo en castellano', etiquetaEnum(SEX_LABELS, 'MIXTO') === 'Mixto');
comprobar('estado de competencia en castellano', etiquetaEnum(COMPETITION_STATUS_LABELS, 'ACTIVA') === 'Activa');
comprobar('estado de inscripción en castellano', etiquetaEnum(INSCRIPTION_STATUS_LABELS, 'APROBADA') === 'Aprobada');
comprobar('tipo de resultado en castellano', etiquetaEnum(RESULT_TYPE_LABELS, 'GOLES') === 'Goles');
comprobar('null cae en el guion', etiquetaEnum(STAGE_LABELS, null) === SIN_DATO);
comprobar('undefined cae en el guion', etiquetaEnum(STAGE_LABELS, undefined) === SIN_DATO);
comprobar('vacío cae en el guion', etiquetaEnum(STAGE_LABELS, '') === SIN_DATO);
comprobar(
  'un código desconocido no se muestra crudo',
  etiquetaEnum(STAGE_LABELS, 'NACIONAL') === SIN_DATO,
);
comprobar('el respaldo es configurable', etiquetaEnum(STAGE_LABELS, null, 'Sin etapa') === 'Sin etapa');

// -------------------------------------------------
// 3. textoOGuion y tituloCompuesto
// -------------------------------------------------
comprobar('null es un guion', textoOGuion(null) === SIN_DATO);
comprobar('undefined es un guion', textoOGuion(undefined) === SIN_DATO);
comprobar('sólo espacios es un guion', textoOGuion('   ') === SIN_DATO);
comprobar('el texto se recorta', textoOGuion('  Capital ') === 'Capital');
comprobar('el cero se muestra', textoOGuion(0) === '0');
comprobar('NaN es un guion', textoOGuion(Number.NaN) === SIN_DATO);

comprobar('título completo', tituloCompuesto(['Fútbol', 'Sub 14']) === 'Fútbol - Sub 14');
comprobar('sin categoría no queda " - undefined"', tituloCompuesto(['Fútbol', undefined]) === 'Fútbol');
comprobar('sin disciplina no queda "null - "', tituloCompuesto([null, 'Sub 14']) === 'Sub 14');
comprobar('sin nada es un guion', tituloCompuesto([null, undefined, '  ']) === SIN_DATO);
comprobar('separador configurable', tituloCompuesto(['Ana', 'Pérez'], ' ') === 'Ana Pérez');

for (const valor of [null, undefined, '', 'X']) {
  comprobar(
    `ningún helper devuelve "null"/"undefined" (${String(valor)})`,
    sinNulos(textoOGuion(valor)) &&
      sinNulos(etiquetaEnum(STAGE_LABELS, valor)) &&
      sinNulos(tituloCompuesto([valor, valor])) &&
      sinNulos(rangoJugadores(valor ?? null, valor ?? null)),
  );
}

// -------------------------------------------------
// 4. Las pantallas que tenían el problema usan los helpers
// -------------------------------------------------
const leer = (relativo) => readFile(path.join(SRC, relativo), 'utf8');
const CRUDO_TITULO = /`\$\{competition\.discipline\?\.name\} - \$\{competition\.category\?\.name\}`/;

{
  // Las columnas salieron de la página a su archivo en la Fase 7.
  const f = await leer('pages/admin/disciplines/disciplineColumns.tsx');
  comprobar(
    'la tabla de disciplinas usa rangoJugadores',
    f.includes('rangoJugadores(') && !f.includes('${discipline.minPlayers} - ${discipline.maxPlayers}'),
  );
}
{
  const f = await leer('pages/public/DisciplineDetailPage.tsx');
  comprobar(
    'DisciplineDetailPage no muestra el tipo ni el resultado crudos',
    !/\{discipline\.(type|resultType)\}/.test(f) && !f.includes('{category.sex}'),
  );
  comprobar(
    'DisciplineDetailPage no arma "null por equipo"',
    f.includes('rangoJugadores(') && !f.includes('`${discipline.minPlayers} por equipo`'),
  );
}
for (const rel of [
  'pages/admin/CompetitionsPage.tsx',
  'pages/admin/ResultsPage.tsx',
  'pages/admin/CompetitionDetailPage.tsx',
  'pages/admin/competition-detail/CompetitionHeader.tsx',
]) {
  const f = await leer(rel);
  comprobar(`${rel} arma el título con tituloCompuesto`, f.includes('tituloCompuesto(') && !CRUDO_TITULO.test(f));
}
for (const rel of [
  'pages/admin/CompetitionsPage.tsx',
  'pages/admin/ResultsPage.tsx',
  'pages/admin/competition-detail/CompetitionHeader.tsx',
  'pages/public/CompetitionPublicPage.tsx',
]) {
  const f = await leer(rel);
  comprobar(
    `${rel} no muestra etapa, formato ni estado crudos`,
    !/\{competition\.(stage|format|status)\}/.test(f) &&
      !/\|\| competition\.(stage|format)\}/.test(f) &&
      !/\?\? competition\.status/.test(f),
  );
}
{
  const f = await leer('pages/public/inscription/StepReview.tsx');
  comprobar(
    'StepReview muestra sexo, modalidad y puntuación en castellano',
    !f.includes('{formData.sex}') && !/\{selectedDiscipline\?\.(type|resultType)\}/.test(f),
  );
}
{
  const f = await leer('pages/public/inscription/StepSportSelection.tsx');
  comprobar(
    'StepSportSelection muestra modalidad y rama en castellano',
    !f.includes('{discipline.type}') && !f.includes('{category.sex}'),
  );
}
{
  const f = await leer('pages/public/inscription/TrackInscription.tsx');
  comprobar('TrackInscription muestra el estado en castellano', !f.includes('{trackedInscription.status}'));
}
{
  const f = await leer('pages/admin/DelegateInscriptionPage.tsx');
  comprobar(
    'DelegateInscriptionPage no arma "undefined undefined" como responsable',
    !f.includes('${user?.firstName} ${user?.lastName}'),
  );
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) de formato:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Ningún valor faltante se muestra como "null" o "undefined".');
