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
  themeColor,
  departmentTotals,
  matchDepartment,
  HEAT_STOPS,
  HEAT_GRADIENT_CSS,
  PROVINCE_FILL,
  HEAT_SIGMA,
  HEAT_CUTOFF,
  HEAT_MIN_WEIGHT,
  heatWeight,
  heatAlpha,
  buildColorTable,
  buildHeatPoints,
  heatValueRange,
  computeHeatField,
  heatAt,
  colorizeHeatField,
  placeBubbleLabels,
  labelBoxSize,
  boxesOverlap,
  boxTouchesCircle,
  clampView,
  zoomAt,
  panBy,
  centerOn,
  toScreen,
  toMap,
  inverseScale,
  markersOnScreen,
  lerpView,
  isVisible,
  MIN_ZOOM,
  MAX_ZOOM,
  IDENTITY_VIEW,
  chooseFullscreenMode,
  nextFocusIndex,
  scrollbarCompensation,
  escapeAction,
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
// 7.b Totales por departamento (ranking "Por departamento")
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
  comprobar('los departamentos sin participación no aparecen', !deptos.has('Ramón Lista'));
}

// -------------------------------------------------
// 7.c Calor: peso (raíz con piso), combinación por MÁXIMO y normalización
// -------------------------------------------------
{
  const { width: W, height: H } = GEO_VIEWBOX;

  // Peso.
  comprobar('cero no genera calor', heatWeight(0, 71) === 0);
  comprobar('sin máximo no hay calor', heatWeight(5, 0) === 0);
  comprobar('la localidad máxima pesa exactamente 1', heatWeight(71, 71) === 1);
  comprobar(
    'el peso usa la raíz: 4 de 71 pesa ~0,43 (no 0,06)',
    Math.abs(heatWeight(4, 71) - (0.25 + 0.75 * Math.sqrt(4 / 71))) < 1e-12 && heatWeight(4, 71) > 0.4,
  );
  comprobar('piso: una localidad con 1 de 1000 pesa al menos 0,25', heatWeight(1, 1000) >= HEAT_MIN_WEIGHT);

  // Puntos de calor.
  const variados = buildLocalityMap([
    fila('Formosa', '', { athletes: 71 }),
    fila('Clorinda', '', { athletes: 20 }),
    fila('Pirané', '', { athletes: 4 }),
    fila('Las Lomitas', '', { athletes: 0, delegations: 1 }),
  ]);
  const puntos = buildHeatPoints(variados, 'athletes');
  comprobar('sólo las localidades con valor > 0 generan calor', puntos.length === 3 && !puntos.some((p) => p.name === 'Las Lomitas'));
  comprobar('los puntos vienen de mayor a menor valor', puntos.every((p, i) => i === 0 || puntos[i - 1].value >= p.value));
  comprobar('el rango de la leyenda son los valores reales (4 a 71)', JSON.stringify(heatValueRange(puntos)) === '{"min":4,"max":71}');

  // Normalización: el centro de la máxima es amarillo (t = 1).
  const formosa = puntos[0];
  comprobar('el centro de la localidad máxima vale exactamente 1 (amarillo)', Math.abs(heatAt(puntos, formosa.x, formosa.y) - 1) < 1e-9);

  // Un solo valor (la seed: todas en 13) → todas pesan 1.
  const iguales = buildHeatPoints(
    buildLocalityMap(['Formosa', 'Clorinda', 'Pirané'].map((l) => fila(l, '', { athletes: 13 }))),
    'athletes',
  );
  comprobar('con un solo valor, todas las manchas pesan 1', iguales.every((p) => p.weight === 1));
  comprobar('con un solo valor, la leyenda tiene mínimo = máximo', heatValueRange(iguales)?.min === heatValueRange(iguales)?.max);

  // Todo en cero → no hay calor.
  const ceros = buildHeatPoints(buildLocalityMap([fila('Formosa', '', { athletes: 0, delegations: 1 })]), 'athletes');
  comprobar('todo en cero: no hay puntos de calor', ceros.length === 0);
  const campoVacio = computeHeatField(ceros, W, H, 0.1);
  comprobar('todo en cero: el campo de calor es todo 0', campoVacio.data.every((v) => v === 0));
  comprobar('todo en cero: la leyenda no tiene rango', heatValueRange(ceros) === null);

  // DECISIÓN DEL USUARIO: las manchas NO se suman (máximo, no suma). Cinco
  // pueblos chicos pegados nunca llegan al amarillo de la capital.
  const chicos = [0, 1, 2, 3, 4].map((i) => ({ id: `c${i}`, name: `c${i}`, x: 500 + i * 4, y: 500, value: 4, weight: heatWeight(4, 71) }));
  const capital = { id: 'cap', name: 'cap', x: 200, y: 200, value: 71, weight: 1 };
  const todos = [capital, ...chicos];
  const picoChicos = Math.max(...chicos.map((c) => heatAt(todos, c.x, c.y)));
  comprobar(
    'combinación por MÁXIMO: cinco localidades chicas juntas quedan por debajo del pico de la mayor',
    picoChicos < heatAt(todos, capital.x, capital.y) && picoChicos < 0.6,
    `pico de los chicos ${picoChicos.toFixed(3)}`,
  );
  comprobar(
    'combinación por MÁXIMO: el calor de cinco chicos juntos es el de uno solo (no se acumula)',
    Math.abs(picoChicos - heatWeight(4, 71)) < 1e-9,
  );
  const campo = computeHeatField(todos, W, H, 0.5);
  const enCelda = (x, y) => campo.data[Math.floor(y * 0.5) * campo.width + Math.floor(x * 0.5)];
  comprobar('el campo en grilla también combina por máximo (≤ peso del chico)', enCelda(508, 500) <= heatWeight(4, 71) + 1e-6);
  comprobar('el campo nunca pasa de 1', campo.data.every((v) => v <= 1 + 1e-9));
  comprobar(
    'el calor es geográfico: el núcleo se corta en 3σ',
    HEAT_CUTOFF === 3 * HEAT_SIGMA && heatAt([capital], capital.x + HEAT_CUTOFF + 1, capital.y) === 0,
  );

  // Opacidad: transparente abajo del umbral, sin borde duro.
  comprobar('abajo de 0,04 el píxel es transparente', heatAlpha(0.03) === 0);
  comprobar('desde 0,15 el píxel es opaco', heatAlpha(0.15) === 1 && heatAlpha(1) === 1);
  comprobar('entre 0,04 y 0,15 la opacidad sube de a poco', heatAlpha(0.095) > 0.3 && heatAlpha(0.095) < 0.7);

  // Coloreado: la tabla de 256 colores va del primer al último tono.
  const tabla = buildColorTable(['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#ffffff']);
  comprobar('la tabla de colores arranca en la primera parada', tabla[0] === 0 && tabla[1] === 0 && tabla[2] === 0);
  comprobar('la tabla de colores termina en la última parada', tabla[255 * 3] === 255);
  const px = colorizeHeatField(new Float32Array([0, 0.02, 0.1, 1]), tabla);
  comprobar('sin calor, el píxel queda transparente (se ve el azul marino de abajo)', px[3] === 0 && px[7] === 0);
  comprobar('con calor, el píxel lleva color y opacidad', px[15] === 255 && px[12] === 255);
}

// -------------------------------------------------
// 7.d Por defecto no se dibujan marcadores de localidades en cero
// -------------------------------------------------
{
  const dir = path.join(SRC, 'components', 'localityMap');
  const principal = await readFile(path.join(dir, 'LocalityImpactMap.tsx'), 'utf8');
  const svg = await readFile(path.join(dir, 'ImpactMapSvg.tsx'), 'utf8');
  comprobar(
    '"Mostrar localidades sin participación" arranca apagado',
    /\[showAll, setShowAll\] = useState\(false\)/.test(principal),
  );
  comprobar('los anillos de localidades en cero sólo se dibujan con showAll', svg.includes('{showAll && ('));
  comprobar(
    'el detalle va en la columna en escritorio y como hoja en el celular',
    principal.includes("variant={esEscritorio ? 'panel' : 'sheet'}"),
  );
}

// -------------------------------------------------
// 7.e Colores: rampa con tokens del tema, luminancia creciente, sin restos
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
  comprobar('la rampa tiene 7 paradas, de t = 0 a t = 1', HEAT_STOPS.length === 7 && HEAT_STOPS[0].t === 0 && HEAT_STOPS.at(-1).t === 1);
  comprobar('la rampa arranca en el azul marino del fondo (primary-900)', HEAT_STOPS[0].token === PROVINCE_FILL && PROVINCE_FILL === 'primary-900');
  comprobar('la rampa termina en heat-yellow', HEAT_STOPS.at(-1).token === 'heat-yellow');
  for (const { token } of HEAT_STOPS) comprobar(`el token de la rampa ${token} existe en el tema`, tema.has(token));
  const lums = HEAT_STOPS.map((s) => luminancia(hex(s.token)));
  comprobar('la luminancia de la rampa crece en cada parada', lums.every((l, i) => i === 0 || l > lums[i - 1]), lums.map((l) => l.toFixed(3)).join(' < '));
  HEAT_STOPS.forEach((s, i) => {
    if (i === 0) return;
    const c = contraste(hex(HEAT_STOPS[i - 1].token), hex(s.token));
    comprobar(`${HEAT_STOPS[i - 1].token} y ${s.token} se distinguen (≥ 1,3:1)`, c >= 1.3, `${c.toFixed(2)}:1`);
  });
  comprobar('las paradas avanzan en t', HEAT_STOPS.every((s, i) => i === 0 || s.t > HEAT_STOPS[i - 1].t));
  comprobar('el gradiente de la leyenda usa var(--color-…) de las 7 paradas', HEAT_STOPS.every((s) => HEAT_GRADIENT_CSS.includes(themeColor(s.token))));
  comprobar('ya no queda --color-heat-orange en el tema', !tema.has('heat-orange'));

  // Rótulos con halo azul marino: AA sobre toda la rampa.
  for (const [texto, token] of [['blanco', 'white'], ['celeste-100', 'celeste-100']]) {
    const c = contraste(hex(token), hex(PROVINCE_FILL));
    comprobar(`rótulo ${texto} con halo primary-900: contraste AA (≥ 4,5)`, c >= 4.5, `${c.toFixed(2)}:1`);
  }
  comprobar(
    'sin halo, el blanco sobre el amarillo NO llega (por eso el halo es obligatorio)',
    contraste('#ffffff', hex('heat-yellow')) < 4.5,
  );

  // Cero hex sueltos en los archivos del mapa.
  const archivos = [
    path.join(SRC, 'lib', 'localityMap.ts'),
    path.join(SRC, 'hooks', 'useHeatImage.ts'),
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

  // Que no queden la coropleta ni las burbujas.
  const lib = await readFile(path.join(SRC, 'lib', 'localityMap.ts'), 'utf8');
  for (const viejo of ['computeHeatClasses', 'BUBBLE_RAMP', 'bubbleRadius', 'separateBubbles', 'bubbleLegendValues', 'heatLabelColor', 'NO_DATA_HATCH', 'buildBubbles']) {
    comprobar(`ya no existe ${viejo} (coropleta / burbujas)`, !new RegExp(`\\b${viejo}\\b`).test(lib));
  }
  const svgFuente = await readFile(path.join(SRC, 'components', 'localityMap', 'ImpactMapSvg.tsx'), 'utf8');
  comprobar('el mapa no pinta departamentos por valor (sin coropleta)', !/heatColor\(/.test(svgFuente));
  // (La máscara del contorno usa un <rect> blanco: no es una etiqueta.)
  comprobar(
    'el mapa no dibuja etiquetas con caja blanca',
    !svgFuente.includes('EtiquetaLocalidad') && !/<rect[^>]*fill="white"/.test(svgFuente.replace(/<mask[\s\S]*?<\/mask>/, '')),
  );
}

// -------------------------------------------------
// 7.f Recorte estricto al contorno y calor precalculado
// -------------------------------------------------
{
  const svg = await readFile(path.join(SRC, 'components', 'localityMap', 'ImpactMapSvg.tsx'), 'utf8');
  const hook = await readFile(path.join(SRC, 'hooks', 'useHeatImage.ts'), 'utf8');
  comprobar('existe un clipPath con el contorno de los departamentos', /<clipPath id=\{RECORTE_ID\}>[\s\S]*?GEO_DEPARTMENTS\.map/.test(svg));
  comprobar('la imagen de calor va recortada al contorno de la provincia', /<image[\s\S]*?clipPath=\{`url\(#\$\{RECORTE_ID\}\)`\}/.test(svg));
  comprobar(
    'la imagen de calor está dentro del grupo que hace zoom (no se recalcula al acercar)',
    svg.indexOf('<g transform={`translate(') < svg.indexOf('<image') && svg.indexOf('<image') < svg.indexOf('{/* 3. Límites'),
  );
  comprobar('el calor se calcula una vez por puntos (useMemo en el contenedor + efecto por puntos)', /\[puntos, ancho, alto\]/.test(hook));
  comprobar('la URL vieja del calor se libera', hook.includes('URL.revokeObjectURL'));
  comprobar('la imagen de calor es decorativa (aria-hidden en su grupo)', /<g transform=\{`translate[^>]*aria-hidden="true"/.test(svg));
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
  const v0 = { k: 2, x: -300, y: -250 };
  const antes = toMap(v0, 420, 510);
  const despues = toMap(zoomAt(v0, 1.5, 420, 510, W, H), 420, 510);
  comprobar('zoom hacia un punto: el punto bajo el cursor no se mueve', cerca(antes.x, despues.x) && cerca(antes.y, despues.y));
  comprobar('zoom hacia un punto respeta los límites', cubre(zoomAt(IDENTITY_VIEW, 100, 0, 0, W, H)));
  const c = centerOn(500, 500, 2.5, W, H);
  const p = toScreen(c, 500, 500);
  comprobar('centrar deja la localidad en el medio de la vista', cerca(p.x, W / 2) && cerca(p.y, H / 2));
  comprobar('centrar cerca del borde no saca la provincia de la vista', cubre(centerOn(2, 2, 4, W, H)));
  comprobar('escala inversa: a 4× los trazos se dividen por 4', inverseScale({ k: 4, x: 0, y: 0 }) === 0.25);

  const pts = buildHeatPoints(
    buildLocalityMap([fila('Ibarreta', '', { athletes: 13 }), fila('Comandante Fontana', '', { athletes: 13 })]),
    'athletes',
  );
  const m1 = markersOnScreen(pts, IDENTITY_VIEW, 4);
  const m4 = markersOnScreen(pts, centerOn(pts[0].x, pts[0].y, 4, W, H), 4);
  comprobar('con zoom, los marcadores mantienen su tamaño en pantalla', m4.every((m) => m.r === 4) && m1.every((m) => m.r === 4));
  const dist = (arr) => Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
  comprobar('acercar separa localidades vecinas en pantalla', dist(m4) > dist(m1) * 3, `${dist(m1).toFixed(1)} → ${dist(m4).toFixed(1)}`);
  comprobar('isVisible descarta lo que quedó fuera de la vista', !isVisible(-50, 10, 13, W, H) && isVisible(5, 10, 13, W, H));
  comprobar('la transición interpola el zoom en escala logarítmica (1× → 4× pasa por 2×)', cerca(lerpView({ k: 1, x: 0, y: 0 }, { k: 4, x: -100, y: -100 }, 0.5).k, 2, 1e-9));
}

// -------------------------------------------------
// 7.h Rótulos de localidad: halo, sin cajas, sin encimarse
// -------------------------------------------------
{
  const { width: W, height: H } = GEO_VIEWBOX;
  const variadas = [
    'Formosa', 'Clorinda', 'Pirané', 'El Colorado', 'Las Lomitas', 'Ibarreta', 'Comandante Fontana',
    'Laguna Yema', 'Ingeniero Juárez', 'Laguna Blanca', 'General Belgrano', 'Riacho He-Hé',
    'San Francisco de Laishí', 'Estanislao del Campo', 'Pozo del Tigre', 'Villa General Güemes',
    'Mayor Vicente Villafañe', 'Palo Santo', 'Herradura', 'Villa Escolar', 'Misión Tacaaglé',
    'Buena Vista', 'Siete Palmas', 'Laguna Naick Neck', 'El Espinillo',
  ].map((l, i) => fila(l, '', { athletes: 5 + ((i * 37) % 180) }));
  const puntos = buildHeatPoints(buildLocalityMap(variadas), 'athletes');
  comprobar('el caso variado tiene 25 localidades con calor', puntos.length === 25, `${puntos.length}`);

  const sinEncimar = (rot, marc) =>
    rot.every((a, i) => rot.every((b, j) => i === j || !boxesOverlap(a.box, b.box))) &&
    rot.every((r) => marc.every((m) => !boxTouchesCircle(r.box, m))) &&
    rot.every((r) => r.box.x0 >= 0 && r.box.y0 >= 0 && r.box.x1 <= W && r.box.y1 <= H);

  // 13 px de pantalla: ~0,65 px por unidad en escritorio y ~0,34 en el celular.
  for (const [nombre, pxPorUnidad] of [['escritorio', 0.65], ['celular', 0.34]]) {
    const u = 1 / pxPorUnidad;
    for (const [k, tope] of [[1, 5], [2.5, 10], [5, Infinity]]) {
      const vista = k === 1 ? IDENTITY_VIEW : centerOn(640, 560, k, W, H);
      const marc = markersOnScreen(puntos, vista, 4 * u).filter((m) => isVisible(m.x, m.y, m.r, W, H));
      const ids = marc.map((m) => m.id).slice(0, tope);
      const rot = placeBubbleLabels(marc, ids, W, H, 13 * u);
      comprobar(`[${nombre} ${k}×] 0 rótulos encimados, sobre marcadores o fuera del mapa (${rot.length} ubicados)`, sinEncimar(rot, marc));
      comprobar(
        `[${nombre} ${k}×] cada rótulo ocupa su caja real (texto + halo)`,
        rot.every((r) => {
          const { w, h } = labelBoxSize(r.text, 13 * u);
          return Math.abs(r.box.x1 - r.box.x0 - w) < 1e-6 && Math.abs(r.box.y1 - r.box.y0 - h) < 1e-6;
        }),
      );
    }
  }

  const svgFuente = await readFile(path.join(SRC, 'components', 'localityMap', 'ImpactMapSvg.tsx'), 'utf8');
  const rotulo = /function RotuloLocalidad[\s\S]*?\n}\n/.exec(svgFuente)?.[0] ?? '';
  comprobar('existe el componente RotuloLocalidad', rotulo.length > 0);
  comprobar('el nombre de localidad no usa opacidad parcial', !/opacity/i.test(rotulo));
  comprobar('el nombre de localidad lleva halo (stroke + paintOrder)', /\{\.\.\.halo\}/.test(rotulo) && /paintOrder: 'stroke'/.test(svgFuente));
  comprobar('el nombre de localidad no lleva caja', !/<rect/.test(rotulo));
  comprobar('el halo es primary-900 de 3 px de pantalla', /stroke: AZUL_MARINO/.test(svgFuente) && /halo: 3,/.test(svgFuente));
  comprobar('Top 5 a 1×, Top 10 desde 2×, todas desde 4×', /view\.k >= 4 \? orden\.length : view\.k >= 2 \? 10 : 5/.test(svgFuente));
  comprobar('zona de clic de 24 × 24 px (radio 12)', /zonaDeClic: 12,/.test(svgFuente));
  // Los rótulos de departamento se ubican primero y los nombres no los pisan.
  const unaLocalidad = [{ id: "x", name: "Prueba", x: 500, y: 500, r: 4, value: 1 }];
  const libre = placeBubbleLabels(unaLocalidad, ["x"], W, H, 20);
  const ocupada = libre[0]?.box;
  const conOcupada = ocupada ? placeBubbleLabels(unaLocalidad, ["x"], W, H, 20, [ocupada]) : [];
  comprobar(
    "un nombre de localidad evita una caja ocupada (rótulo de departamento)",
    ocupada !== undefined && conOcupada.every((r) => !boxesOverlap(r.box, ocupada)),
  );
  comprobar("el mapa pasa los rótulos de departamento como cajas ocupadas", svgFuente.includes('rotulosDepto.flatMap((r) => (r.caja'));
}

// -------------------------------------------------
// 7.i Pantalla completa
// -------------------------------------------------
{
  comprobar('con la API estándar habilitada se usa el modo nativo', chooseFullscreenMode({ standard: true, webkit: false, enabled: true }) === 'native');
  comprobar('con sólo la API webkit (Safari, iPad) también es nativo', chooseFullscreenMode({ standard: false, webkit: true, enabled: true }) === 'native');
  comprobar('sin API (iPhone) se usa la capa fija', chooseFullscreenMode({ standard: false, webkit: false, enabled: false }) === 'overlay');
  comprobar('con la API deshabilitada (iframe) se usa la capa fija', chooseFullscreenMode({ standard: true, webkit: false, enabled: false }) === 'overlay');

  comprobar('foco atrapado: Tab del último vuelve al primero', nextFocusIndex(4, 3, false) === 0);
  comprobar('foco atrapado: Shift+Tab del primero va al último', nextFocusIndex(4, 0, true) === 3);
  comprobar('foco atrapado: Tab avanza de a uno', nextFocusIndex(4, 1, false) === 2);
  comprobar('foco atrapado: desde afuera entra por el primero (o el último hacia atrás)', nextFocusIndex(4, -1, false) === 0 && nextFocusIndex(4, -1, true) === 3);
  comprobar('foco atrapado: sin enfocables no hay a dónde ir', nextFocusIndex(0, 0, false) === -1);

  comprobar('la compensación de la barra de scroll es su ancho', scrollbarCompensation(1920, 1905) === 15);
  comprobar('la compensación nunca es negativa', scrollbarCompensation(375, 375) === 0 && scrollbarCompensation(100, 120) === 0);

  comprobar('Escape en la capa con detalle abierto cierra el detalle (la capa sigue)', escapeAction('overlay', true) === 'close-detail');
  comprobar('Escape en la capa sin detalle sale de la pantalla completa', escapeAction('overlay', false) === 'exit');
  comprobar('Escape en modo nativo lo maneja el navegador', escapeAction('native', false) === 'browser');

  const principal = await readFile(path.join(SRC, 'components', 'localityMap', 'LocalityImpactMap.tsx'), 'utf8');
  const hook = await readFile(path.join(SRC, 'hooks', 'useFullscreen.ts'), 'utf8');
  comprobar('el botón de pantalla completa tiene nombre accesible y aria-pressed', principal.includes("'Ver mapa en pantalla completa'") && principal.includes('aria-pressed={pantalla.activo}'));
  comprobar('hay un botón "Salir" visible dentro de la pantalla completa', /ref=\{salirRef\}[\s\S]*?Salir/.test(principal));
  comprobar('el foco entra a "Salir" y vuelve al botón al salir', principal.includes('salirRef.current?.focus') && principal.includes('pantallaCompletaRef.current?.focus'));
  comprobar('el foco queda atrapado (nextFocusIndex)', principal.includes('nextFocusIndex(enfocables.length'));
  comprobar('el estado se sincroniza con fullscreenchange (y webkit)', hook.includes("'fullscreenchange'") && hook.includes("'webkitfullscreenchange'"));
  comprobar('en la capa: sin scroll detrás y el resto de la página inerte', hook.includes("html.style.overflow = 'hidden'") && hook.includes('hermano.inert = true'));
  comprobar('la capa respeta las zonas seguras (safe-area)', principal.includes('env(safe-area-inset-top)'));
  comprobar('el zoom se conserva: la pantalla completa es el mismo elemento del mapa', principal.includes('useFullscreen(mapaRef)') && /<section\s+ref=\{mapaRef\}/.test(principal));

  // Proporciones literales coherentes con el viewBox.
  comprobar(
    'la proporción del área del mapa coincide con GEO_VIEWBOX',
    principal.includes(`'aspect-[${GEO_VIEWBOX.width}/${GEO_VIEWBOX.height}]'`),
  );
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

console.log('✅ Emparejamiento, mapa de calor, pantalla completa y módulo geográfico del mapa en orden.');
