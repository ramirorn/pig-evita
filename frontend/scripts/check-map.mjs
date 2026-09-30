// ===========================================
// Chequeo del mapa de impacto por localidad
//
// Lo que fija, y por qué importa:
//
//   1. **Emparejamiento nombre → mapa.** `Participant.locality` es texto libre.
//      Si "Ingeniero Juárez" deja de encontrar a "Ingeniero Guillermo Nicasio
//      Juárez", el mapa pinta gris una localidad con atletas y nadie se entera:
//      no falla nada, sólo miente.
//   2. **Nada se descarta en silencio.** Toda localidad del seed se ubica en el
//      mapa o queda en "Sin ubicación en el mapa" con sus datos. La lista de
//      las que no se ubican está escrita acá: cambiarla es una decisión
//      consciente, no un efecto colateral.
//   3. **Escala de color.** Cuantiles con rangos contiguos y legibles, sin
//      clases vacías; todo en cero o un único valor no rompen la leyenda.
//   4. **Módulo geográfico generado.** 37 áreas con nombre, paths válidos y un
//      tamaño acotado (el objetivo es que viaje en un chunk liviano).
//
// Bundlea el fuente REAL con esbuild, igual que los otros check-*.mjs.
//
// Corre con: npm run check:map
// ===========================================
import { execSync } from 'node:child_process';
import { readFile, rm, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const ENTRADA = path.join(RAIZ, 'scripts', 'map.entry.ts');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-map.mjs');
const SEED = path.join(RAIZ, '..', 'backend', 'prisma', 'seed.ts');
const GENERADO = path.join(SRC, 'lib', 'geo', 'formosa.generated.ts');

/** Techo del módulo geográfico. Hoy pesa ~18 KB; "pocas decenas" es el objetivo. */
const TECHO_KB = 60;

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${ENTRADA}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  normalizeLocalityName,
  LOCALITY_ALIASES,
  matchLocality,
  buildLocalityMap,
  provinceTotals,
  localityRows,
  topLocalities,
  computeHeatClasses,
  heatColor,
  HEAT_COLORS,
  NO_DATA_COLOR,
  MAX_HEAT_CLASSES,
  HEAT_RAMP,
  NO_DATA_TOKEN,
  NO_DATA_LABEL,
  BUBBLE_RAMP,
  BUBBLE_RAMP_TOKENS,
  BUBBLE_OUTLINE,
  rampIndices,
  clampView,
  zoomAt,
  panBy,
  centerOn,
  toScreen,
  toMap,
  inverseScale,
  bubblesOnScreen,
  lerpView,
  isVisible,
  MIN_ZOOM,
  MAX_ZOOM,
  IDENTITY_VIEW,
  themeColor,
  featureAnchor,
  departmentTotals,
  matchDepartment,
  bubbleRadius,
  buildBubbles,
  bubbleLegendValues,
  separateBubbles,
  BUBBLE_MAX_OVERLAP,
  BUBBLE_MAX_SHIFT,
  placeBubbleLabels,
  labelBoxSize,
  BUBBLE_LABEL_SIZE,
  pickDepartmentAnchor,
  boxesOverlap,
  boxTouchesCircle,
  BUBBLE_MIN_RADIUS,
  BUBBLE_MAX_RADIUS,
  GEO_AREAS,
  GEO_POINTS,
  GEO_DEPARTMENTS,
  GEO_VIEWBOX,
  GEO_SOURCE,
  localityStatsSchema,
} = await import(pathToFileURL(SALIDA).href);

/** Una fila del endpoint con valores de relleno para los chequeos. */
const fila = (locality, department, extra = {}) => ({
  locality,
  department,
  athletes: 1,
  delegations: 1,
  disciplines: 1,
  categories: 1,
  podiums: { first: 0, second: 0, third: 0 },
  wins: 0,
  ...extra,
});

// -------------------------------------------------
// 1. Normalización
// -------------------------------------------------
for (const [entrada, esperado] of [
  ['Riacho He-Hé', 'riacho he he'],
  ['  Misión   Tacaaglé ', 'mision tacaagle'],
  ['GRAL. BELGRANO', 'general belgrano'],
  ['Ing. Juárez', 'ingeniero juarez'],
  ['Mayor Vicente Villafañe', 'mayor vicente villafane'],
  ['Villa General Güemes', 'villa general guemes'],
  ['Fortín Sargento 1º Leyes', 'fortin sargento 1 leyes'],
  ['Cte. Fontana', 'comandante fontana'],
]) {
  const real = normalizeLocalityName(entrada);
  comprobar(`normaliza "${entrada}" → "${esperado}"`, real === esperado, `dio "${real}"`);
}

// -------------------------------------------------
// 2. Alias
// -------------------------------------------------
for (const [clave, destino] of Object.entries(LOCALITY_ALIASES)) {
  comprobar(
    `la clave de alias "${clave}" ya está normalizada`,
    normalizeLocalityName(clave) === clave,
    `normalizada sería "${normalizeLocalityName(clave)}"`,
  );
  const f = matchLocality(destino);
  comprobar(
    `el alias "${clave}" apunta a un gobierno local que existe en el mapa (${destino})`,
    f !== null && f.feature.name === destino,
  );
}

// Los casos que pidió la tarea, explícitos para que se lean en el output.
for (const [entrada, oficial] of [
  ['Ingeniero Juárez', 'Ingeniero Guillermo Nicasio Juárez'],
  ['General Belgrano', 'General Manuel Belgrano'],
  ['Riacho He-Hé', 'Riacho He He'],
  ['Misión Laishí', 'Misión San Francisco de Laishi'],
  ['San Francisco de Laishí', 'Misión San Francisco de Laishi'],
  ['Mansilla', 'General Lucio Victorio Mansilla'],
  ['Mayor Vicente Villafañe', 'Mayor Villafañe'],
  ['formosa', 'Formosa'],
]) {
  const f = matchLocality(entrada);
  comprobar(
    `"${entrada}" se ubica como "${oficial}"`,
    f?.feature.name === oficial,
    `se ubicó como ${f ? `"${f.feature.name}"` : 'nada'}`,
  );
}

comprobar(
  'una junta vecinal sin ejido se ubica como punto (Mariano Boedo)',
  matchLocality('Mariano Boedo')?.type === 'point',
);
comprobar(
  'un municipio se ubica como área (Clorinda)',
  matchLocality('Clorinda')?.type === 'area',
);
comprobar(
  'lo que no existe no se ubica "en la más parecida" (Puerto Pilcomayo)',
  matchLocality('Puerto Pilcomayo') === null,
);
comprobar(
  '"Colonia Campo Villafañe" NO se confunde con "Mayor Villafañe"',
  matchLocality('Colonia Campo Villafañe') === null,
);

// -------------------------------------------------
// 3. Toda localidad del seed se ubica o queda listada
// -------------------------------------------------
const fuenteSeed = await readFile(SEED, 'utf8');
const bloque = /const FORMOSA_GEOGRAPHY[^=]*=\s*\{([\s\S]*?)\n\};/.exec(fuenteSeed);
comprobar('se encontró FORMOSA_GEOGRAPHY en el seed', bloque !== null);

const filasSeed = [];
if (bloque) {
  for (const [, conComillas, sinComillas, lista] of bloque[1].matchAll(
    // Las claves sin comillas pueden llevar tilde (`Laishí:`): `\w` no alcanza.
    /(?:'([^']+)'|(\p{L}+)):\s*\[([^\]]*)\]/gu,
  )) {
    const depto = conComillas ?? sinComillas;
    for (const [, loc] of lista.matchAll(/'([^']+)'/g)) filasSeed.push(fila(loc, depto));
  }
}
// Las localidades sueltas del seed (equipos, participantes, sedes).
const deptoDe = new Map(filasSeed.map((f) => [f.locality, f.department]));
for (const [, loc] of fuenteSeed.matchAll(/locality:\s*'([^']+)'/g)) {
  if (!deptoDe.has(loc)) filasSeed.push(fila(loc, '(sin departamento en el seed)'));
}

comprobar('el seed trae localidades para chequear', filasSeed.length >= 40, `${filasSeed.length}`);

/**
 * Localidades del seed que NO están en el mapa del IGN. Escritas a mano a
 * propósito: si una deja de ubicarse (o una nueva aparece), esto se pone rojo y
 * alguien decide si hace falta un alias o si de verdad no está en el mapa.
 */
const SIN_UBICACION_ESPERADAS = new Set([
  'Colonia Aquino',
  'Colonia Campo Villafañe',
  'Puerto Pilcomayo',
  'Guadalcázar',
  'Lamadrid',
  'General Mosconi',
  'General E. Mosconi',
]);

{
  const modelo = buildLocalityMap(filasSeed);
  const ubicadas = [...modelo.mapped.values()].reduce((n, m) => n + m.sourceNames.length, 0);

  comprobar(
    'ninguna fila del seed se pierde: ubicadas + sin ubicación = total',
    ubicadas + modelo.unmapped.length === filasSeed.length,
    `${ubicadas} + ${modelo.unmapped.length} ≠ ${filasSeed.length}`,
  );

  const sinUbicacion = new Set(modelo.unmapped.map((f) => f.locality));
  for (const loc of sinUbicacion) {
    comprobar(
      `"${loc}" queda sin ubicación y eso está previsto`,
      SIN_UBICACION_ESPERADAS.has(loc),
      '¿falta un alias? Si de verdad no está en el mapa del IGN, sumala a SIN_UBICACION_ESPERADAS',
    );
  }
  for (const loc of SIN_UBICACION_ESPERADAS) {
    comprobar(
      `"${loc}" (esperada sin ubicación) sigue listada en el bloque "Sin ubicación"`,
      sinUbicacion.has(loc),
      'ahora se ubica: sacala de SIN_UBICACION_ESPERADAS si el emparejamiento es correcto',
    );
  }

  const filas = localityRows(modelo);
  comprobar(
    'la tabla accesible incluye también las localidades sin ubicación',
    filas.filter((f) => !f.onMap).length === modelo.unmapped.length,
  );

  console.log(
    `Seed: ${filasSeed.length} filas → ${modelo.mapped.size} localidades en el mapa, ` +
      `${modelo.unmapped.length} sin ubicación (${[...sinUbicacion].join(', ')})`,
  );
}

// -------------------------------------------------
// 4. Agregación y totales
// -------------------------------------------------
{
  const datos = [
    fila('Clorinda', 'Pilagás', { athletes: 10, disciplines: 3, podiums: { first: 1, second: 0, third: 2 }, wins: 4 }),
    fila('Clorinda', 'Pilcomayo', { athletes: 5, disciplines: 4, podiums: { first: 0, second: 1, third: 0 }, wins: 1 }),
    fila('Puerto Pilcomayo', 'Pilagás', { athletes: 7 }),
  ];
  const modelo = buildLocalityMap(datos);
  const clorinda = modelo.mapped.get(matchLocality('Clorinda').feature.id);

  comprobar('dos filas de la misma localidad se juntan en una', modelo.mapped.size === 1);
  comprobar('los atletas se suman', clorinda?.figures.athletes === 15);
  comprobar(
    'las disciplinas NO se suman (se toma el máximo, cota inferior cierta)',
    clorinda?.figures.disciplines === 4,
  );
  comprobar('los podios se suman por puesto', clorinda?.figures.podiums.first === 1 && clorinda?.figures.podiums.second === 1 && clorinda?.figures.podiums.third === 2);

  const t = provinceTotals(datos);
  comprobar('los totales provinciales incluyen las sin ubicación', t.athletes === 22);
  comprobar('las localidades participantes se cuentan una vez cada una', t.localities === 2, `${t.localities}`);
  comprobar('los podios provinciales suman los tres puestos', t.podiums === 4);

  const top = topLocalities(localityRows(modelo), 'athletes');
  comprobar('el top ordena de mayor a menor', top[0]?.name === 'Clorinda' && top[1]?.name === 'Puerto Pilcomayo');
  comprobar('el top excluye las localidades en cero para la métrica', topLocalities(localityRows(modelo), 'podiums').length === 1);
}

// -------------------------------------------------
// 5. Escala de color
// -------------------------------------------------
{
  comprobar('todo en cero → ninguna clase', computeHeatClasses([0, 0, 0]).length === 0);
  comprobar('sin datos → ninguna clase', computeHeatClasses([]).length === 0);
  comprobar('cero se pinta "sin participación"', heatColor(0, computeHeatClasses([1, 2, 3])) === NO_DATA_COLOR);
  comprobar('sin clases, todo es "sin participación"', heatColor(5, []) === NO_DATA_COLOR);
  comprobar('"sin participación" no es un tono de la rampa', !HEAT_COLORS.includes(NO_DATA_COLOR));

  const uno = computeHeatClasses([0, 7]);
  comprobar(
    'un solo valor → una clase "7"',
    uno.length === 1 && uno[0].from === 7 && uno[0].to === 7 && uno[0].label === '7',
    JSON.stringify(uno),
  );
  comprobar('un solo valor se pinta con un tono de la rampa', HEAT_COLORS.includes(heatColor(7, uno)));

  const repetidos = computeHeatClasses([3, 3, 3, 3]);
  comprobar('valores repetidos → una sola clase, sin clases vacías', repetidos.length === 1);

  const dos = computeHeatClasses([1, 1, 1, 50]);
  comprobar('dos valores distintos → dos clases', dos.length === 2, JSON.stringify(dos));

  const valores = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 0, 0];
  const clases = computeHeatClasses(valores);
  comprobar(`con muchos valores hay ${MAX_HEAT_CLASSES} clases`, clases.length === MAX_HEAT_CLASSES, JSON.stringify(clases));
  comprobar('la primera clase arranca en el mínimo positivo', clases[0]?.from === 1);
  comprobar('la última clase termina en el máximo', clases.at(-1)?.to === 144);
  comprobar(
    'los rangos son contiguos y no se pisan',
    clases.every((c, i) => c.from <= c.to && (i === 0 || c.from === clases[i - 1].to + 1)),
    JSON.stringify(clases.map((c) => [c.from, c.to])),
  );
  comprobar('los rangos se leen "de a" (p. ej. "1 a 2")', /^\d+( a \d+)?$/.test(clases[0]?.label ?? ''));
  comprobar(
    'los colores de las clases son todos distintos',
    new Set(clases.map((c) => c.color)).size === clases.length,
  );

  const orden = valores
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
    .map((v) => HEAT_COLORS.indexOf(heatColor(v, clases)));
  comprobar(
    'más valor nunca es un tono más claro (la escala es monótona)',
    orden.every((idx, i) => idx >= 0 && (i === 0 || idx >= orden[i - 1])),
    JSON.stringify(orden),
  );
}

// -------------------------------------------------
// 6. Módulo geográfico generado
// -------------------------------------------------
{
  comprobar('el mapa tiene las 37 áreas del IGN', GEO_AREAS.length === 37, `${GEO_AREAS.length}`);
  comprobar(
    'todas las áreas tienen nombre, tipo, departamento y path',
    GEO_AREAS.every((a) => a.name.trim() !== '' && a.kind && a.department && /^M[\d.]/.test(a.d)),
  );
  comprobar('los ids de las áreas son únicos', new Set(GEO_AREAS.map((a) => a.id)).size === GEO_AREAS.length);
  comprobar(
    'los nombres (normalizados) no chocan entre áreas y puntos',
    new Set([...GEO_AREAS, ...GEO_POINTS].map((f) => normalizeLocalityName(f.name))).size ===
      GEO_AREAS.length + GEO_POINTS.length,
  );
  comprobar('están los 9 departamentos', GEO_DEPARTMENTS.length === 9, `${GEO_DEPARTMENTS.length}`);
  comprobar(
    'los puntos son juntas vecinales (y Pozo de Maza, comisión sin ejido en el IGN)',
    GEO_POINTS.length > 0 &&
      GEO_POINTS.every((p) => p.kind === 'JUNTA_VECINAL' || p.name === 'Pozo de Maza'),
  );
  const dentro = (x, y) => x >= 0 && y >= 0 && x <= GEO_VIEWBOX.width && y <= GEO_VIEWBOX.height;
  comprobar(
    'anclas y puntos caen dentro del viewBox',
    GEO_AREAS.every((a) => dentro(a.labelX, a.labelY)) && GEO_POINTS.every((p) => dentro(p.x, p.y)),
  );
  comprobar('la fuente es el Instituto Geográfico Nacional', GEO_SOURCE === 'Instituto Geográfico Nacional');

  const kb = (await stat(GENERADO)).size / 1024;
  comprobar(`el módulo geográfico pesa menos de ${TECHO_KB} KB`, kb < TECHO_KB, `${kb.toFixed(1)} KB`);
  console.log(`Módulo geográfico: ${kb.toFixed(1)} KB`);
}

// -------------------------------------------------
// 7. El contrato del endpoint se valida
// -------------------------------------------------
{
  const valido = { generatedAt: '2026-09-29T12:00:00.000Z', localities: [fila('Formosa', 'Formosa')] };
  comprobar('el schema acepta la respuesta del contrato', localityStatsSchema.safeParse(valido).success);
  comprobar('el schema acepta la lista vacía', localityStatsSchema.safeParse({ ...valido, localities: [] }).success);
  comprobar(
    'el schema rechaza conteos negativos',
    !localityStatsSchema.safeParse({ ...valido, localities: [fila('Formosa', 'Formosa', { athletes: -1 })] }).success,
  );
  const { podiums: _podiums, ...sinPodios } = fila('Formosa', 'Formosa');
  comprobar(
    'el schema rechaza una fila sin podios',
    !localityStatsSchema.safeParse({ ...valido, localities: [sinPodios] }).success,
  );
}

// -------------------------------------------------
// 7.b Coropleta: agregación por departamento
// -------------------------------------------------
{
  const datos = [
    fila('Ibarreta', 'Patiño', { athletes: 13, disciplines: 2 }),
    fila('Las Lomitas', 'Patiño', { athletes: 13, disciplines: 3 }),
    fila('Formosa', 'Formosa', { athletes: 20 }),
    // Sin ubicación, pero con un departamento reconocible (con tilde).
    fila('Colonia Aquino', 'Laishí', { athletes: 4 }),
    // Sin ubicación y con un departamento que no existe: no se asigna.
    fila('Paraje Inventado', 'Departamento Fantasma', { athletes: 9 }),
  ];
  const deptos = departmentTotals(buildLocalityMap(datos));

  comprobar('"Laishí" del backend se reconoce como "Laishi" del IGN', matchDepartment('Laishí') === 'Laishi');
  comprobar('un departamento desconocido no se reconoce', matchDepartment('Departamento Fantasma') === null);
  comprobar('las localidades de un departamento se suman (Patiño = 26)', deptos.get('Patiño')?.athletes === 26);
  comprobar('las disciplinas del departamento toman el máximo, no la suma', deptos.get('Patiño')?.disciplines === 3);
  comprobar('una localidad sin ubicación aporta a su departamento si se reconoce', deptos.get('Laishi')?.athletes === 4);
  comprobar(
    'un departamento desconocido no se inventa ni se reparte',
    ![...deptos.keys()].some((k) => k === 'Departamento Fantasma') &&
      [...deptos.values()].reduce((n, f) => n + f.athletes, 0) === 50,
  );
  comprobar(
    'los departamentos sin participación no aparecen (se pintan como "sin participación")',
    !deptos.has('Ramón Lista'),
  );

  // El caso real que motivó el rediseño: 8 localidades con 13 atletas cada una.
  const seed = ['Clorinda', 'Comandante Fontana', 'El Colorado', 'Formosa', 'Ibarreta', 'Laguna Yema', 'Las Lomitas', 'Pirané'].map(
    (l) => fila(l, '', { athletes: 13 }),
  );
  const clasesSeed = computeHeatClasses(
    [...departmentTotals(buildLocalityMap(seed)).values()].map((f) => f.athletes),
  );
  comprobar(
    'con valores iguales por localidad, los departamentos igual se distinguen (más de un tono)',
    clasesSeed.length > 1,
    JSON.stringify(clasesSeed),
  );
}

// -------------------------------------------------
// 7.c Burbujas
// -------------------------------------------------
{
  comprobar('cero no tiene burbuja', bubbleRadius(0, 100) === 0);
  comprobar('sin máximo no hay burbuja', bubbleRadius(5, 0) === 0);
  comprobar('el máximo tiene el radio máximo', bubbleRadius(100, 100) === BUBBLE_MAX_RADIUS);
  comprobar(
    'el ÁREA es proporcional al valor: cuádruple de valor → doble de radio',
    Math.abs(bubbleRadius(100, 100) / bubbleRadius(25, 100) - 2) < 1e-9,
  );
  comprobar('los valores chicos respetan el radio mínimo (se pueden tocar)', bubbleRadius(1, 10000) === BUBBLE_MIN_RADIUS);

  const datos = [
    fila('Formosa', 'Formosa', { athletes: 13 }),
    fila('Clorinda', 'Pilagás', { athletes: 13 }),
    fila('Pirané', 'Pirané', { athletes: 13, podiums: { first: 0, second: 0, third: 0 } }),
  ];
  const modelo = buildLocalityMap(datos);
  const burbujas = buildBubbles(modelo, 'athletes');
  comprobar('una burbuja por localidad con valor', burbujas.length === 3);
  comprobar('con valores iguales, todas las burbujas miden lo mismo', new Set(burbujas.map((b) => b.r)).size === 1);
  comprobar(
    'las localidades en cero para la métrica NO tienen marcador',
    buildBubbles(modelo, 'podiums').length === 0,
  );
  comprobar(
    'las burbujas se pintan de mayor a menor (las chicas quedan arriba)',
    buildBubbles(buildLocalityMap([fila('Formosa', '', { athletes: 100 }), fila('Clorinda', '', { athletes: 4 })]), 'athletes')
      .every((b, i, arr) => i === 0 || arr[i - 1].r >= b.r),
  );
  // Leyenda de tamaños: sólo valores que EXISTEN en los datos.
  comprobar(
    'con todas en 13, la leyenda muestra sólo 13 (no inventa 3 ni 1)',
    JSON.stringify(bubbleLegendValues([13, 13, 13, 13, 13, 13, 13, 13])) === '[13]',
  );
  const variados = [160, 90, 40, 12, 3];
  const leyenda = bubbleLegendValues(variados);
  comprobar('con variedad, la leyenda arranca en el máximo y termina en el mínimo', leyenda[0] === 160 && leyenda.at(-1) === 3, JSON.stringify(leyenda));
  comprobar('todo valor de la leyenda existe en los datos', leyenda.every((v) => variados.includes(v)), JSON.stringify(leyenda));
  comprobar('con dos valores, la leyenda muestra los dos', JSON.stringify(bubbleLegendValues([20, 5, 20])) === '[20,5]');
  comprobar('sin valores no hay leyenda de tamaños', bubbleLegendValues([0, 0]).length === 0);

  // Separación: Ibarreta y Comandante Fontana están a ~15 unidades.
  const vecinas = buildBubbles(
    buildLocalityMap([fila('Ibarreta', '', { athletes: 13 }), fila('Comandante Fontana', '', { athletes: 13 })]),
    'athletes',
  );
  const [va, vb] = vecinas;
  const permitido = va.r + vb.r - BUBBLE_MAX_OVERLAP * Math.min(va.r, vb.r);
  comprobar(
    'dos burbujas vecinas ya no se tapan casi enteras (Ibarreta / Comandante Fontana)',
    Math.hypot(va.x - vb.x, va.y - vb.y) >= permitido - 0.5,
    `distancia ${Math.hypot(va.x - vb.x, va.y - vb.y).toFixed(1)} < ${permitido.toFixed(1)}`,
  );
  const originales = [
    { id: 'a', name: 'a', x: 100, y: 100, r: 20, value: 1 },
    { id: 'b', name: 'b', x: 100, y: 100, r: 20, value: 1 },
    { id: 'c', name: 'c', x: 110, y: 105, r: 20, value: 1 },
  ];
  const separadas = separateBubbles(originales);
  comprobar(
    'la separación es acotada: ninguna burbuja se corre más de lo permitido de su lugar',
    separadas.every((p, i) => Math.hypot(p.x - originales[i].x, p.y - originales[i].y) <= BUBBLE_MAX_SHIFT * originales[i].r + 0.1),
  );
  comprobar(
    'la separación es determinista',
    JSON.stringify(separateBubbles(originales)) === JSON.stringify(separadas),
  );
  comprobar('la separación no cambia tamaños ni valores', separadas.every((p, i) => p.r === originales[i].r && p.value === originales[i].value));

  // Rótulos de las burbujas: nunca encimados, nunca afuera del mapa, nunca
  // sobre otra burbuja. Se prueba con un grupo apretado (Clorinda y vecinas).
  const apretado = buildBubbles(
    buildLocalityMap(
      ['Clorinda', 'Buena Vista', 'Siete Palmas', 'Tres Lagunas', 'Laguna Naick Neck', 'Riacho He He', 'Formosa', 'Pirané'].map(
        (l, i) => fila(l, '', { athletes: 10 + i * 7 }),
      ),
    ),
    'athletes',
  );
  const rotulos = placeBubbleLabels(apretado, apretado.map((b) => b.id), GEO_VIEWBOX.width, GEO_VIEWBOX.height);
  comprobar('se ubica al menos un rótulo', rotulos.length > 0);
  comprobar(
    'ningún rótulo pisa a otro',
    rotulos.every((a, i) => rotulos.every((b, j) => i === j || !boxesOverlap(a.box, b.box))),
  );
  comprobar(
    'ningún rótulo pisa una burbuja',
    rotulos.every((r) => apretado.every((b) => !boxTouchesCircle(r.box, b))),
  );
  comprobar(
    'ningún rótulo se sale del mapa',
    rotulos.every((r) => r.box.x0 >= 0 && r.box.y0 >= 0 && r.box.x1 <= GEO_VIEWBOX.width && r.box.y1 <= GEO_VIEWBOX.height),
  );

  // Rótulos de departamento: precalculados adentro del polígono.
  for (const d of GEO_DEPARTMENTS) {
    const { anchors, width, height, lines } = d.label;
    comprobar(`el rótulo de ${d.name} tiene al menos una posición posible`, anchors.length > 0);
    comprobar(
      `el rótulo de ${d.name} no se corta contra el borde del mapa`,
      anchors.every(([x, y]) => x - width / 2 >= 0 && x + width / 2 <= GEO_VIEWBOX.width && y - height / 2 >= 0 && y + height / 2 <= GEO_VIEWBOX.height),
    );
    comprobar(`el rótulo de ${d.name} va en mayúsculas`, lines.every((l) => l === l.toUpperCase()));
  }
  const ramon = GEO_DEPARTMENTS.find((d) => d.name === 'Ramón Lista');
  comprobar(
    'el rótulo de Ramón Lista (el caso "ÓN LISTA") queda entero, en dos líneas si hace falta',
    ramon !== undefined && ramon.label.lines.join(' ') === 'RAMÓN LISTA',
  );
  const d0 = GEO_DEPARTMENTS[0];
  const [ax, ay] = d0.label.anchors[0];
  const tapa = [{ id: 'x', name: 'x', x: ax, y: ay, r: 20, value: 1 }];
  const pos = pickDepartmentAnchor(d0.label.anchors, d0.label.width, d0.label.height, tapa, []);
  comprobar(
    'si una burbuja tapa la mejor posición del rótulo, se usa otra (o se omite)',
    pos === null || !boxTouchesCircle({ x0: pos.x - d0.label.width / 2, y0: pos.y - d0.label.height / 2, x1: pos.x + d0.label.width / 2, y1: pos.y + d0.label.height / 2 }, tapa[0]),
  );
}

// -------------------------------------------------
// 7.d Por defecto no se dibujan marcadores de localidades en cero
// -------------------------------------------------
{
  const dir = path.join(SRC, 'components', 'localityMap');
  const principal = await readFile(path.join(dir, 'LocalityImpactMap.tsx'), 'utf8');
  const svg = await readFile(path.join(dir, 'ImpactMapSvg.tsx'), 'utf8');
  comprobar(
    '"Mostrar también las localidades sin participación" arranca apagado',
    /\[showAll, setShowAll\] = useState\(false\)/.test(principal),
  );
  comprobar(
    'los puntos de localidades en cero sólo se dibujan con showAll',
    svg.includes('{showAll && ('),
  );
  comprobar(
    'el detalle va en la columna en escritorio y como hoja en el celular',
    principal.includes("variant={esEscritorio ? 'panel' : 'sheet'}"),
  );
}

// -------------------------------------------------
// 7.e Escala de burbujas chica y casi sin desplazamiento
// -------------------------------------------------
{
  comprobar(
    `radio máximo de burbuja entre 12 y 14 unidades (hoy ${BUBBLE_MAX_RADIUS})`,
    BUBBLE_MAX_RADIUS >= 12 && BUBBLE_MAX_RADIUS <= 14,
  );
  comprobar(`radio mínimo cerca de 5 unidades (hoy ${BUBBLE_MIN_RADIUS})`, BUBBLE_MIN_RADIUS >= 4 && BUBBLE_MIN_RADIUS <= 6);

  // El caso real: las 8 localidades de la seed, todas con 13 atletas.
  const nombres = ['Clorinda', 'Comandante Fontana', 'El Colorado', 'Formosa', 'Ibarreta', 'Laguna Yema', 'Las Lomitas', 'Pirané'];
  const burbujas = buildBubbles(buildLocalityMap(nombres.map((l) => fila(l, '', { athletes: 13 }))), 'athletes');
  const corrimientos = burbujas.map((b) => {
    const real = featureAnchor(matchLocality(b.name));
    return Math.hypot(b.x - real.x, b.y - real.y);
  });
  const maximo = Math.max(...corrimientos);
  comprobar(
    'con burbujas chicas, el anti-solapamiento casi no mueve nada (≤ medio radio máximo)',
    maximo <= BUBBLE_MAX_RADIUS / 2,
    `corrimiento máximo ${maximo.toFixed(1)} unidades`,
  );
  console.log(`Burbujas de la seed: corrimiento máximo ${maximo.toFixed(1)} unidades (radio ${burbujas[0]?.r})`);
}

// -------------------------------------------------
// 7.f Colores: tokens del tema, contraste AA y tonos distinguibles
// -------------------------------------------------
{
  const css = await readFile(path.join(SRC, 'index.css'), 'utf8');
  const tema = new Map(
    [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, k, v]) => [k, v.toLowerCase()]),
  );
  const hex = (token) => (token === 'white' ? '#ffffff' : tema.get(token));

  const luminancia = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };

  comprobar('se leyeron los tokens del tema desde index.css', tema.size > 40, `${tema.size}`);
  comprobar('index.css emite todas las variables del tema (@theme static)', /@theme static\s*\{/.test(css));

  for (const { tone, label } of HEAT_RAMP) {
    comprobar(`el tono ${tone} existe en el tema`, tema.has(tone));
    comprobar(`el tono de la coropleta ${tone} es de la escala secondary (verde)`, tone.startsWith('secondary-'));
    const c = hex(tone) && hex(label) ? contraste(hex(tone), hex(label)) : 0;
    comprobar(`rótulo ${label} sobre ${tone}: contraste AA (≥ 4,5)`, c >= 4.5, `${c.toFixed(2)}:1`);
  }
  const cSinDatos = contraste(hex(NO_DATA_TOKEN), hex(NO_DATA_LABEL));
  comprobar(`rótulo ${NO_DATA_LABEL} sobre "sin participación": contraste AA`, cSinDatos >= 4.5, `${cSinDatos.toFixed(2)}:1`);

  HEAT_RAMP.forEach((t, i) => {
    if (i === 0) return;
    const c = contraste(hex(HEAT_RAMP[i - 1].tone), hex(t.tone));
    comprobar(`${HEAT_RAMP[i - 1].tone} y ${t.tone} se distinguen entre sí (≥ 1,25:1)`, c >= 1.25, `${c.toFixed(2)}:1`);
  });
  const cPocoVsNada = contraste(hex(HEAT_RAMP[0].tone), hex(NO_DATA_TOKEN));
  comprobar('"poca participación" se distingue de "sin participación" (además del rayado)', cPocoVsNada >= 1.1, `${cPocoVsNada.toFixed(2)}:1`);

  // Burbujas: amarillo (accent) → naranja (token propio del mapa) → rojo (destructive).
  comprobar(
    'las burbujas van de accent (amarillo) a destructive (rojo) pasando por heat-orange',
    BUBBLE_RAMP_TOKENS[0].startsWith('accent-') &&
      BUBBLE_RAMP_TOKENS.at(-1).startsWith('destructive-') &&
      BUBBLE_RAMP_TOKENS.includes('heat-orange'),
    BUBBLE_RAMP_TOKENS.join(' → '),
  );
  for (const t of [...BUBBLE_RAMP_TOKENS, BUBBLE_OUTLINE]) {
    comprobar(`el token de burbuja ${t} existe en el tema`, tema.has(t));
  }
  const lumBurbujas = BUBBLE_RAMP_TOKENS.map((t) => luminancia(hex(t)));
  comprobar(
    'la rampa de burbujas oscurece de amarillo a rojo (más concentración, más oscuro)',
    lumBurbujas.every((l, i) => i === 0 || l < lumBurbujas[i - 1]),
    lumBurbujas.map((l) => l.toFixed(2)).join(' > '),
  );
  // Separación de la burbuja contra cada verde: el borde blanco o el contorno
  // oscuro tiene que destacarse (≥ 3:1) contra el fondo.
  for (const { tone } of HEAT_RAMP) {
    const c = Math.max(contraste('#ffffff', hex(tone)), contraste(hex(BUBBLE_OUTLINE), hex(tone)));
    comprobar(`la burbuja se separa del fondo ${tone} (borde blanco o contorno ≥ 3:1)`, c >= 3, `${c.toFixed(2)}:1`);
  }
  comprobar(
    'las clases de burbujas usan la rampa amarillo → rojo',
    computeHeatClasses([1, 5, 20, 40, 90], BUBBLE_RAMP).every((c) => BUBBLE_RAMP.includes(c.color)),
  );
  comprobar(
    'con mucha variedad, las burbujas usan los tres colores (amarillo, naranja, rojo)',
    new Set(computeHeatClasses([1, 5, 20, 40, 90], BUBBLE_RAMP).map((c) => c.color)).size === 3,
  );
  const seedBurbujas = computeHeatClasses([13, 13, 13, 13, 13, 13, 13, 13], BUBBLE_RAMP);
  comprobar(
    'con todas en 13 (la seed), las burbujas son de un solo color: no se inventan diferencias',
    seedBurbujas.length === 1,
    JSON.stringify(seedBurbujas),
  );
  comprobar('los colores de burbuja son var() de sus tokens', BUBBLE_RAMP.every((c, i) => c === themeColor(BUBBLE_RAMP_TOKENS[i])));
  comprobar('los índices de rampa toman los extremos', JSON.stringify(rampIndices(3, 5)) === '[0,2,4]' && JSON.stringify(rampIndices(2, 3)) === '[0,2]');
  comprobar('una sola clase toma el tono del medio', JSON.stringify(rampIndices(1, 3)) === '[1]');
  comprobar(
    'la rampa y "sin participación" se expresan como var(--color-…)',
    [...HEAT_COLORS, NO_DATA_COLOR, ...BUBBLE_RAMP].every((c) => /^var\(--color-[a-z0-9-]+\)$/.test(c)),
  );

  const archivos = [
    path.join(SRC, 'lib', 'localityMap.ts'),
    ...['LocalityImpactMap', 'ImpactMapSvg', 'MapLegend', 'LocalityDetailCard', 'ImpactSummary', 'LocalityTable', 'UnmappedLocalities'].map((n) =>
      path.join(SRC, 'components', 'localityMap', `${n}.tsx`),
    ),
  ];
  for (const archivo of archivos) {
    const fuente = await readFile(archivo, 'utf8');
    const hexes = fuente.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
    comprobar(`${path.basename(archivo)} no usa colores hex sueltos (sólo tokens del tema)`, hexes.length === 0, hexes.join(', '));
    for (const [, token] of fuente.matchAll(/themeColor\('([a-z0-9-]+)'\)/g)) {
      comprobar(`${path.basename(archivo)}: el token ${token} existe en el tema`, tema.has(token));
    }
  }
}

// -------------------------------------------------
// 7.g Zoom: límites, zoom hacia un punto y escala inversa
// -------------------------------------------------
{
  const { width: W, height: H } = GEO_VIEWBOX;
  const cerca = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const cubre = (v) => v.x <= 1e-9 && v.y <= 1e-9 && v.x + v.k * W >= W - 1e-9 && v.y + v.k * H >= H - 1e-9;

  comprobar('el zoom no baja de 1×', clampView({ k: 0.3, x: 50, y: 50 }, W, H).k === MIN_ZOOM);
  comprobar('el zoom no pasa de 8×', clampView({ k: 20, x: 0, y: 0 }, W, H).k === MAX_ZOOM);
  comprobar('a 1× la vista es la provincia entera', JSON.stringify(clampView({ k: 1, x: 300, y: -200 }, W, H)) === JSON.stringify(IDENTITY_VIEW));
  comprobar(
    'no se puede sacar la provincia de la vista desplazando',
    [panBy({ k: 3, x: 0, y: 0 }, 99999, 99999, W, H), panBy({ k: 3, x: 0, y: 0 }, -99999, -99999, W, H)].every(cubre),
  );

  // Zoom hacia un punto: lo que estaba bajo el cursor sigue bajo el cursor.
  const v0 = { k: 2, x: -300, y: -250 };
  const px = 420;
  const py = 510;
  const antes = toMap(v0, px, py);
  const v1 = zoomAt(v0, 1.5, px, py, W, H);
  const despues = toMap(v1, px, py);
  comprobar(
    'zoom hacia un punto: el punto bajo el cursor no se mueve',
    cerca(antes.x, despues.x, 1e-6) && cerca(antes.y, despues.y, 1e-6),
    `${antes.x.toFixed(2)},${antes.y.toFixed(2)} → ${despues.x.toFixed(2)},${despues.y.toFixed(2)}`,
  );
  comprobar('zoom hacia un punto respeta los límites', cubre(zoomAt(IDENTITY_VIEW, 100, 0, 0, W, H)));
  comprobar('toScreen y toMap son inversas', (() => {
    const p = toScreen(v1, 123, 456);
    const q = toMap(v1, p.x, p.y);
    return cerca(q.x, 123) && cerca(q.y, 456);
  })());

  // Centrar una localidad (Top 5 / tabla).
  const c = centerOn(500, 500, 2.5, W, H);
  const enPantalla = toScreen(c, 500, 500);
  comprobar('centrar deja la localidad en el medio de la vista', cerca(enPantalla.x, W / 2) && cerca(enPantalla.y, H / 2));
  comprobar('centrar cerca del borde no saca la provincia de la vista', cubre(centerOn(2, 2, 4, W, H)));

  // Escala inversa: burbujas y trazos mantienen su tamaño en pantalla.
  comprobar('escala inversa: a 4× los trazos se dividen por 4', inverseScale({ k: 4, x: 0, y: 0 }) === 0.25);
  const reales = buildBubbles(
    buildLocalityMap([fila('Ibarreta', '', { athletes: 13 }), fila('Comandante Fontana', '', { athletes: 13 }), fila('Formosa', '', { athletes: 40 })]),
    'athletes',
    { separate: false },
  );
  const v4 = centerOn(reales[0].x, reales[0].y, 4, W, H);
  const a4 = bubblesOnScreen(reales, v4);
  comprobar('con zoom, las burbujas mantienen su radio en pantalla', a4.every((b, i) => b.r === reales[i].r));
  const distancia = (arr, n1, n2) => {
    const a = arr.find((b) => b.name === n1);
    const b = arr.find((x) => x.name === n2);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const d1 = distancia(bubblesOnScreen(reales, IDENTITY_VIEW), 'Ibarreta', 'Comandante Fontana');
  const d4 = distancia(a4, 'Ibarreta', 'Comandante Fontana');
  comprobar('acercar separa localidades vecinas en pantalla (en vez de agrandarlas)', d4 > d1 * 2, `${d1.toFixed(1)} → ${d4.toFixed(1)}`);
  comprobar('a 1× las burbujas en pantalla coinciden con las separadas por defecto', (() => {
    const def = buildBubbles(buildLocalityMap([fila('Formosa', '', { athletes: 13 }), fila('Clorinda', '', { athletes: 13 })]), 'athletes');
    const pan = bubblesOnScreen(
      buildBubbles(buildLocalityMap([fila('Formosa', '', { athletes: 13 }), fila('Clorinda', '', { athletes: 13 })]), 'athletes', { separate: false }),
      IDENTITY_VIEW,
    );
    return def.every((b, i) => cerca(b.x, pan[i].x, 0.11) && cerca(b.y, pan[i].y, 0.11));
  })());
  comprobar('isVisible descarta lo que quedó fuera de la vista', !isVisible(-50, 10, 13, W, H) && isVisible(5, 10, 13, W, H));
  const mitad = lerpView({ k: 1, x: 0, y: 0 }, { k: 4, x: -100, y: -100 }, 0.5);
  comprobar('la transición interpola el zoom en escala logarítmica (1× → 4× pasa por 2×)', cerca(mitad.k, 2, 1e-9));
}

// -------------------------------------------------
// 7.h Etiquetas de localidad: legibles, con fondo, sin encimarse
// -------------------------------------------------
{
  const { width: W, height: H } = GEO_VIEWBOX;
  // El caso que reportó el usuario: 25 localidades con valores variados.
  const variadas = [
    'Formosa', 'Clorinda', 'Pirané', 'El Colorado', 'Las Lomitas', 'Ibarreta', 'Comandante Fontana',
    'Laguna Yema', 'Ingeniero Juárez', 'Laguna Blanca', 'General Belgrano', 'Riacho He-Hé',
    'San Francisco de Laishí', 'Estanislao del Campo', 'Pozo del Tigre', 'Villa General Güemes',
    'Mayor Vicente Villafañe', 'Palo Santo', 'Herradura', 'Villa Escolar', 'Misión Tacaaglé',
    'Buena Vista', 'Siete Palmas', 'Laguna Naick Neck', 'El Espinillo',
  ].map((l, i) => fila(l, '', { athletes: 5 + ((i * 37) % 180) }));
  const reales = buildBubbles(buildLocalityMap(variadas), 'athletes', { separate: false });
  comprobar('el caso variado tiene 25 burbujas', reales.length === 25, `${reales.length}`);

  const sinEncimar = (rot, burb) =>
    rot.every((a, i) => rot.every((b, j) => i === j || !boxesOverlap(a.box, b.box))) &&
    rot.every((r) => burb.every((b) => !boxTouchesCircle(r.box, b))) &&
    rot.every((r) => r.box.x0 >= 0 && r.box.y0 >= 0 && r.box.x1 <= W && r.box.y1 <= H);

  // Tamaños reales: 12 px en escritorio (~0,65 px por unidad) y 11 px en el
  // celular (~0,34 px por unidad).
  for (const [nombre, pxPorUnidad, minimoPx] of [['escritorio', 0.65, 12], ['celular', 0.34, 11]]) {
    const tam = Math.max(BUBBLE_LABEL_SIZE, minimoPx / pxPorUnidad);
    comprobar(`[${nombre}] el nombre mide al menos ${minimoPx} px en pantalla`, tam * pxPorUnidad >= minimoPx - 1e-9);
    for (const k of [1, 2.5, 5]) {
      const vista = k === 1 ? IDENTITY_VIEW : centerOn(640, 560, k, W, H);
      const burb = bubblesOnScreen(reales, vista).filter((b) => isVisible(b.x, b.y, b.r, W, H));
      const ids = [...burb].sort((a, b) => b.value - a.value).map((b) => b.id);
      const rot = placeBubbleLabels(burb, ids, W, H, tam);
      comprobar(
        `[${nombre} ${k}×] 0 etiquetas encimadas entre sí, sobre burbujas o fuera del mapa (${rot.length} ubicadas)`,
        sinEncimar(rot, burb),
      );
      comprobar(
        `[${nombre} ${k}×] cada etiqueta ocupa su caja real (texto + relleno)`,
        rot.every((r) => {
          const { w, h } = labelBoxSize(r.text, tam);
          return Math.abs(r.box.x1 - r.box.x0 - w) < 1e-6 && Math.abs(r.box.y1 - r.box.y0 - h) < 1e-6;
        }),
      );
      comprobar(
        `[${nombre} ${k}×] cada etiqueta queda pegada a su burbuja`,
        rot.every((r) => {
          const b = burb.find((x) => x.id === r.id);
          const px = Math.max(r.box.x0, Math.min(b.x, r.box.x1));
          const py = Math.max(r.box.y0, Math.min(b.y, r.box.y1));
          return Math.hypot(px - b.x, py - b.y) - b.r <= tam * 0.35 + 4 + 0.5;
        }),
      );
    }
    const rot1 = placeBubbleLabels(bubblesOnScreen(reales, IDENTITY_VIEW), reales.map((b) => b.id), W, H, tam);
    const burbZ = bubblesOnScreen(reales, centerOn(640, 560, 5, W, H)).filter((b) => isVisible(b.x, b.y, b.r, W, H));
    const rotZ = placeBubbleLabels(burbZ, burbZ.map((b) => b.id), W, H, tam);
    comprobar(
      `[${nombre}] con zoom entra una proporción mayor de nombres`,
      rotZ.length / Math.max(1, burbZ.length) >= rot1.length / reales.length,
      `1×: ${rot1.length}/${reales.length} · 5×: ${rotZ.length}/${burbZ.length}`,
    );
  }

  // La etiqueta se dibuja sin opacidad parcial ni halo (lo que la "lavaba").
  const svgFuente = await readFile(path.join(SRC, 'components', 'localityMap', 'ImpactMapSvg.tsx'), 'utf8');
  const etiqueta = /function EtiquetaLocalidad[\s\S]*?\n}\n/.exec(svgFuente)?.[0] ?? '';
  comprobar('existe el componente EtiquetaLocalidad', etiqueta.length > 0);
  comprobar('la etiqueta de localidad no usa opacidad parcial', !/opacity/i.test(etiqueta));
  comprobar('la etiqueta de localidad no usa halo (paintOrder/stroke en el texto)', !/paintOrder/.test(etiqueta));
  comprobar('la etiqueta tiene fondo blanco sólido', /fill="white"/.test(etiqueta));
  comprobar('el nombre va en semibold', /fontWeight=\{600\}/.test(etiqueta));
  comprobar('mínimos de 12 px (escritorio) y 11 px (celular) en el componente', svgFuente.includes('pxPorUnidad >= 0.5 ? 12 : 11'));
}

// -------------------------------------------------
// 8. Reglas de fuente: atribución, clases y rutas
// -------------------------------------------------
{
  const dir = path.join(SRC, 'components', 'localityMap');
  const archivos = [
    'LocalityImpactMap.tsx',
    'ImpactMapSvg.tsx',
    'MapLegend.tsx',
    'LocalityDetailCard.tsx',
    'ImpactSummary.tsx',
    'LocalityTable.tsx',
    'UnmappedLocalities.tsx',
  ];
  for (const archivo of archivos) {
    const fuente = await readFile(path.join(dir, archivo), 'utf8');
    comprobar(
      `${archivo} no interpola clases de Tailwind`,
      !/className=\{`[^`]*\$\{/.test(fuente),
      'apareció un className con template literal',
    );
  }

  const principal = await readFile(path.join(dir, 'LocalityImpactMap.tsx'), 'utf8');
  comprobar('el mapa muestra "Fuente: Instituto Geográfico Nacional"', principal.includes('Fuente: {GEO_SOURCE}'));
  comprobar('el mapa lista las localidades sin ubicación', principal.includes('<UnmappedLocalities'));
  comprobar('el mapa ofrece la alternativa en tabla', principal.includes('<LocalityTable'));

  const router = await readFile(path.join(SRC, 'router.tsx'), 'utf8');
  comprobar('la ruta pública del mapa está montada', /path:\s*ROUTES\.IMPACT_MAP\s*,/.test(router));
  const publico = await readFile(path.join(SRC, 'components', 'layout', 'PublicLayout.tsx'), 'utf8');
  comprobar('la navegación pública tiene el link al mapa', publico.includes('ROUTES.IMPACT_MAP'));
}

await rm(SALIDA, { force: true });

// -------------------------------------------------
console.log(`Chequeos ejecutados: ${verificaciones.length}`);

if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en el mapa de impacto:\n`);
  for (const p of problemas) console.error(`   · ${p}`);
  process.exit(1);
}

console.log('✅ Emparejamiento, escala de color y módulo geográfico del mapa en orden.');
