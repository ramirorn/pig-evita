// ===========================================
// localityMap — reglas puras del mapa de impacto por localidad
// ===========================================
//
// Sin React a propósito: lo consume el componente del mapa y lo ejercita
// `npm run check:map` sin DOM.
//
// Tres responsabilidades:
//   1. Emparejar el texto libre de `Participant.locality` con un gobierno local
//      del mapa del IGN (normalización + tabla de alias).
//   2. Agregar las filas del endpoint por localidad del mapa y separar las que
//      no tienen ubicación. Regla del proyecto: el dato ausente se omite, no se
//      rellena ni se inventa — y tampoco se descarta en silencio.
//   3. La escala de color por cuantiles y su leyenda.
import { GEO_AREAS, GEO_DEPARTMENTS, GEO_POINTS } from '@/lib/geo/formosa.generated';
import type { GeoArea, GeoKind, GeoPoint } from '@/lib/geo/geoTypes';
import type { LocalityStat } from '@/schemas/localityStats';

// -------------------------------------------------
// 1. Normalización y alias
// -------------------------------------------------

/** Abreviaturas que aparecen en la carga a mano, expandidas palabra por palabra. */
const ABREVIATURAS: Record<string, string> = {
  gral: 'general',
  grl: 'general',
  ing: 'ingeniero',
  cte: 'comandante',
  cmte: 'comandante',
  tte: 'teniente',
  subtte: 'subteniente',
  sgto: 'sargento',
  pto: 'puerto',
  col: 'colonia',
  sta: 'santa',
  sto: 'santo',
};

/**
 * Minúsculas, sin tildes ni diéresis, sin guiones ni puntuación, sin espacios
 * dobles y con las abreviaturas comunes expandidas.
 *
 * `"Riacho He-Hé"` → `"riacho he he"`, `"Gral. Belgrano"` → `"general belgrano"`.
 */
export function normalizeLocalityName(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .split(' ')
    .filter((palabra) => palabra !== '')
    .map((palabra) => ABREVIATURAS[palabra] ?? palabra)
    .join(' ');
}

/**
 * Nombres de uso corriente → nombre oficial del IGN.
 *
 * Las claves se escriben ya normalizadas. Sólo entran equivalencias ciertas:
 * "Colonia Campo Villafañe" NO es "Mayor Villafañe", y "Puerto Pilcomayo" está
 * dentro del ejido de Clorinda pero no es Clorinda. Ante la duda, la localidad
 * queda en "Sin ubicación en el mapa" con sus datos, que es lo honesto.
 */
export const LOCALITY_ALIASES: Record<string, string> = {
  // Ingeniero Juárez (seed: 'Ingeniero Juárez')
  'ingeniero juarez': 'Ingeniero Guillermo Nicasio Juárez',
  'ingeniero g n juarez': 'Ingeniero Guillermo Nicasio Juárez',
  'ingeniero guillermo juarez': 'Ingeniero Guillermo Nicasio Juárez',
  // General Belgrano (seed: 'General Belgrano')
  'general belgrano': 'General Manuel Belgrano',
  'general m belgrano': 'General Manuel Belgrano',
  // Misión Laishí (seed: 'San Francisco de Laishí')
  'san francisco de laishi': 'Misión San Francisco de Laishi',
  'mision laishi': 'Misión San Francisco de Laishi',
  'mision san francisco laishi': 'Misión San Francisco de Laishi',
  laishi: 'Misión San Francisco de Laishi',
  // Mansilla
  mansilla: 'General Lucio Victorio Mansilla',
  'general mansilla': 'General Lucio Victorio Mansilla',
  'general lucio v mansilla': 'General Lucio Victorio Mansilla',
  'lucio v mansilla': 'General Lucio Victorio Mansilla',
  // Mayor Villafañe (seed: 'Mayor Vicente Villafañe')
  'mayor vicente villafane': 'Mayor Villafañe',
  // Villa 213
  'villa 213': 'Villa Dos Trece',
  'villa dostrece': 'Villa Dos Trece',
  // San Martín 1 y 2
  'san martin 2': 'San Martín Dos',
  'san martin ii': 'San Martín Dos',
  'san martin 1': 'San Martín I',
  'san martin uno': 'San Martín I',
  // Otras formas cortas de uso habitual
  'general guemes': 'Villa General Güemes',
  'villa guemes': 'Villa General Güemes',
  fontana: 'Comandante Fontana',
  tacaagle: 'Misión Tacaaglé',
  'naick neck': 'Laguna Naick Neck',
  'riacho hehe': 'Riacho He He',
  perin: 'Subteniente Perín',
  'fortin sargento primero leyes': 'Fortín Sargento 1º Leyes',
  'sargento leyes': 'Fortín Sargento 1º Leyes',
  'juan gregorio bazan': 'Juan G. Bazán',
  'formosa capital': 'Formosa',
  'ciudad de formosa': 'Formosa',
};

// -------------------------------------------------
// Índice del mapa
// -------------------------------------------------

export type MapFeature =
  | { type: 'area'; feature: GeoArea }
  | { type: 'point'; feature: GeoPoint };

/**
 * Nombre normalizado → gobierno local del mapa.
 *
 * Las áreas van primero: si alguna vez un mismo nombre existiera como área y
 * como punto, gana el polígono, que es la representación más rica.
 */
const INDICE: ReadonlyMap<string, MapFeature> = (() => {
  const indice = new Map<string, MapFeature>();
  for (const feature of GEO_AREAS) {
    indice.set(normalizeLocalityName(feature.name), { type: 'area', feature });
  }
  for (const feature of GEO_POINTS) {
    const clave = normalizeLocalityName(feature.name);
    if (!indice.has(clave)) indice.set(clave, { type: 'point', feature });
  }
  return indice;
})();

/** Busca la localidad en el mapa. `null` si no hay forma cierta de ubicarla. */
export function matchLocality(nombre: string): MapFeature | null {
  const clave = normalizeLocalityName(nombre);
  const directo = INDICE.get(clave);
  if (directo) return directo;

  const alias = LOCALITY_ALIASES[clave];
  return alias ? (INDICE.get(normalizeLocalityName(alias)) ?? null) : null;
}

export const KIND_LABELS: Record<GeoKind, string> = {
  MUNICIPIO: 'Municipio',
  COMISION_FOMENTO: 'Comisión de fomento',
  JUNTA_VECINAL: 'Junta vecinal',
};

// -------------------------------------------------
// 2. Agregación
// -------------------------------------------------

export type MapMetric = 'athletes' | 'delegations' | 'disciplines' | 'podiums';

export const METRIC_OPTIONS: ReadonlyArray<{
  value: MapMetric;
  label: string;
  /** Unidad en plural y singular, para leyendas y aria-labels. */
  plural: string;
  singular: string;
}> = [
  { value: 'athletes', label: 'Atletas', plural: 'atletas', singular: 'atleta' },
  { value: 'delegations', label: 'Delegaciones', plural: 'delegaciones', singular: 'delegación' },
  { value: 'disciplines', label: 'Disciplinas', plural: 'disciplinas', singular: 'disciplina' },
  { value: 'podiums', label: 'Podios', plural: 'podios', singular: 'podio' },
];

export function metricInfo(metric: MapMetric) {
  // `METRIC_OPTIONS` cubre todas las métricas: el `find` nunca falla.
  return METRIC_OPTIONS.find((m) => m.value === metric) ?? METRIC_OPTIONS[0]!;
}

/** "1 atleta", "12 atletas". */
export function formatMetric(valor: number, metric: MapMetric): string {
  const info = metricInfo(metric);
  return `${valor.toLocaleString('es-AR')} ${valor === 1 ? info.singular : info.plural}`;
}

/** Estadística de una localidad, ya sumada si llegó en más de una fila. */
export interface LocalityFigures {
  athletes: number;
  delegations: number;
  disciplines: number;
  categories: number;
  podiums: { first: number; second: number; third: number };
  wins: number;
}

export function podiumTotal(f: LocalityFigures): number {
  return f.podiums.first + f.podiums.second + f.podiums.third;
}

export function metricValue(f: LocalityFigures, metric: MapMetric): number {
  switch (metric) {
    case 'athletes':
      return f.athletes;
    case 'delegations':
      return f.delegations;
    case 'disciplines':
      return f.disciplines;
    case 'podiums':
      return podiumTotal(f);
  }
}

/** Una localidad del mapa con participación. */
export interface MappedLocality {
  feature: MapFeature;
  figures: LocalityFigures;
  /** Los textos del backend que cayeron acá (útil si hubo alias o duplicados). */
  sourceNames: string[];
}

export interface LocalityMapModel {
  /** Por `id` del gobierno local (código INDEC). */
  mapped: ReadonlyMap<string, MappedLocality>;
  /** Las filas que no se pudieron ubicar, tal como llegaron. */
  unmapped: LocalityStat[];
}

function cifras(s: LocalityStat): LocalityFigures {
  return {
    athletes: s.athletes,
    delegations: s.delegations,
    disciplines: s.disciplines,
    categories: s.categories,
    podiums: { ...s.podiums },
    wins: s.wins,
  };
}

/**
 * Junta dos filas que caen en la misma localidad del mapa (p. ej. "Clorinda"
 * cargada bajo dos departamentos, o "Ingeniero Juárez" e "Ing. Juárez").
 *
 * Atletas, delegaciones, podios y victorias son conteos de cosas distintas y se
 * suman. Disciplinas y categorías **no** son sumables —la misma disciplina
 * puede estar en las dos filas—, así que se toma el máximo: es una cota
 * inferior cierta en vez de un total inflado.
 */
function combinar(a: LocalityFigures, b: LocalityFigures): LocalityFigures {
  return {
    athletes: a.athletes + b.athletes,
    delegations: a.delegations + b.delegations,
    disciplines: Math.max(a.disciplines, b.disciplines),
    categories: Math.max(a.categories, b.categories),
    podiums: {
      first: a.podiums.first + b.podiums.first,
      second: a.podiums.second + b.podiums.second,
      third: a.podiums.third + b.podiums.third,
    },
    wins: a.wins + b.wins,
  };
}

export function buildLocalityMap(localities: readonly LocalityStat[]): LocalityMapModel {
  const mapped = new Map<string, MappedLocality>();
  const unmapped: LocalityStat[] = [];

  for (const fila of localities) {
    const feature = matchLocality(fila.locality);
    if (!feature) {
      unmapped.push(fila);
      continue;
    }
    const previo = mapped.get(feature.feature.id);
    mapped.set(
      feature.feature.id,
      previo
        ? {
            feature,
            figures: combinar(previo.figures, cifras(fila)),
            sourceNames: [...previo.sourceNames, fila.locality],
          }
        : { feature, figures: cifras(fila), sourceNames: [fila.locality] },
    );
  }

  unmapped.sort((a, b) => b.athletes - a.athletes || a.locality.localeCompare(b.locality, 'es'));
  return { mapped, unmapped };
}

export interface ProvinceTotals {
  athletes: number;
  delegations: number;
  podiums: number;
  wins: number;
  /** Localidades con al menos un atleta, ubicadas o no en el mapa. */
  localities: number;
}

/** Totales provinciales sobre las filas crudas (incluye las sin ubicación). */
export function provinceTotals(localities: readonly LocalityStat[]): ProvinceTotals {
  const nombres = new Set<string>();
  const t = { athletes: 0, delegations: 0, podiums: 0, wins: 0 };
  for (const s of localities) {
    t.athletes += s.athletes;
    t.delegations += s.delegations;
    t.podiums += s.podiums.first + s.podiums.second + s.podiums.third;
    t.wins += s.wins;
    if (s.athletes > 0) {
      const f = matchLocality(s.locality);
      nombres.add(f ? f.feature.id : `?${normalizeLocalityName(s.locality)}`);
    }
  }
  return { ...t, localities: nombres.size };
}

/** Una fila de ranking o de la tabla accesible. */
export interface LocalityRow {
  key: string;
  name: string;
  kind: GeoKind | null;
  department: string;
  figures: LocalityFigures;
  onMap: boolean;
}

/** Todas las localidades con datos, ubicadas o no, listas para tabla y ranking. */
export function localityRows(model: LocalityMapModel): LocalityRow[] {
  const filas: LocalityRow[] = [];
  for (const m of model.mapped.values()) {
    filas.push({
      key: m.feature.feature.id,
      name: m.feature.feature.name,
      kind: m.feature.feature.kind,
      department: m.feature.feature.department,
      figures: m.figures,
      onMap: true,
    });
  }
  model.unmapped.forEach((s, i) => {
    filas.push({
      key: `sin-ubicacion-${i}`,
      name: s.locality,
      kind: null,
      department: s.department,
      figures: cifras(s),
      onMap: false,
    });
  });
  return filas;
}

/** Top N por métrica; desempata por nombre. Excluye las que están en cero. */
export function topLocalities(
  filas: readonly LocalityRow[],
  metric: MapMetric,
  n = 5,
): LocalityRow[] {
  return filas
    .filter((f) => metricValue(f.figures, metric) > 0)
    .sort(
      (a, b) =>
        metricValue(b.figures, metric) - metricValue(a.figures, metric) ||
        a.name.localeCompare(b.name, 'es'),
    )
    .slice(0, n);
}

// -------------------------------------------------
// 3. Escala de color (cuantiles, un solo tono)
// -------------------------------------------------

/**
 * Los colores del mapa salen de los **tokens del tema** (`@theme` de
 * `src/index.css`), nunca de hex sueltos: si cambia la marca, cambia el mapa.
 * Se usan como `var(--color-…)` en estilos inline del SVG y de las muestras.
 */
export type ThemeToken =
  | 'primary-50' | 'primary-100' | 'primary-200' | 'primary-300' | 'primary-500'
  | 'primary-600' | 'primary-700' | 'primary-800' | 'primary-900'
  | 'secondary-100' | 'secondary-300' | 'secondary-400' | 'secondary-500'
  | 'secondary-700' | 'secondary-800' | 'secondary-900'
  | 'celeste-200' | 'celeste-400' | 'celeste-700'
  | 'accent-400' | 'accent-500' | 'accent-700'
  | 'heat-orange'
  | 'destructive-600'
  | 'surface-muted';

/** `'primary-500'` → `'var(--color-primary-500)'`. */
export const themeColor = (token: ThemeToken) => `var(--color-${token})`;

/**
 * Rampa secuencial de la coropleta: la escala SECONDARY (verde institucional),
 * de poco (secondary-100) a mucho (secondary-700). Se saltea secondary-200:
 * contra secondary-100 no se distinguía lo suficiente. Varía en luminosidad,
 * así que se lee igual con daltonismo; `check:map` verifica que tonos
 * vecinos se distingan.
 *
 * Cada tono trae el color de rótulo que le da contraste AA (≥ 4,5:1 con texto
 * chico), también verificado por `check:map` contra los hex del tema.
 */
export const HEAT_RAMP: ReadonlyArray<{ tone: ThemeToken; label: ThemeToken | 'white' }> = [
  { tone: 'secondary-100', label: 'secondary-800' },
  { tone: 'secondary-300', label: 'secondary-900' },
  { tone: 'secondary-400', label: 'secondary-900' },
  { tone: 'secondary-500', label: 'white' },
  { tone: 'secondary-700', label: 'white' },
];

export const HEAT_COLORS = HEAT_RAMP.map((t) => themeColor(t.tone));

/**
 * "Sin participación": surface-muted con rayado celeste en el SVG. Tiene que
 * leerse como "no hay dato", no como "poquito".
 */
export const NO_DATA_TOKEN: ThemeToken = 'surface-muted';
export const NO_DATA_COLOR = themeColor(NO_DATA_TOKEN);
export const NO_DATA_HATCH = themeColor('celeste-200');
export const NO_DATA_LABEL: ThemeToken = 'celeste-700';

/**
 * Burbujas de localidad: de amarillo (poca concentración) a rojo (mucha),
 * pasando por un naranja propio del mapa (`--color-heat-orange` en el tema).
 * Tres clases por cuantiles, igual que la coropleta. Con un solo valor (la seed:
 * 13 en todas) sale una sola clase y todas se ven del mismo color.
 */
export const BUBBLE_RAMP_TOKENS: readonly ThemeToken[] = ['accent-400', 'heat-orange', 'destructive-600'];
export const BUBBLE_RAMP = BUBBLE_RAMP_TOKENS.map(themeColor);

/**
 * Anillo exterior de las burbujas, por fuera del borde blanco: sobre los verdes
 * claros el blanco solo no alcanza para separar un amarillo del fondo.
 */
export const BUBBLE_OUTLINE: ThemeToken = 'primary-900';

/** Color de rótulo (AA) que corresponde al tono de un valor. */
export function heatLabelColor(valor: number, clases: readonly HeatClass[]): string {
  const color = heatColor(valor, clases);
  const tono = HEAT_RAMP.find((t) => themeColor(t.tone) === color);
  const label = tono ? tono.label : NO_DATA_LABEL;
  return label === 'white' ? 'white' : themeColor(label);
}

/**
 * Qué posiciones de una rampa de `m` tonos se usan para `n` clases: los
 * extremos siempre (poco = claro, mucho = oscuro) y el resto repartido. Una
 * sola clase toma el tono del medio, que no afirma "poco" ni "mucho".
 */
export function rampIndices(n: number, m: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [Math.floor((m - 1) / 2)];
  return Array.from({ length: n }, (_, i) => Math.round((i * (m - 1)) / (n - 1)));
}

export interface HeatClass {
  /** Límites inclusivos, en enteros. */
  from: number;
  to: number;
  color: string;
  /** "1 a 4", "12". */
  label: string;
}

export const MAX_HEAT_CLASSES = 5;

/**
 * Clases por cuantiles sobre los valores **positivos**.
 *
 * Los cortes son valores reales de los datos y los rangos quedan contiguos en
 * enteros ("1 a 4", "5 a 11", …), que es lo que una autoridad puede leer sin
 * explicación. Si hay menos valores distintos que clases, hay una clase por
 * valor. Todo en cero → ninguna clase (el mapa entero es "sin participación").
 */
export function computeHeatClasses(
  valores: readonly number[],
  rampa: readonly string[] = HEAT_COLORS,
): HeatClass[] {
  const positivos = valores.filter((v) => v > 0).sort((a, b) => a - b);
  if (positivos.length === 0) return [];

  const distintos = new Set(positivos).size;
  const k = Math.min(MAX_HEAT_CLASSES, rampa.length, distintos);

  // Umbral inferior de cada clase: el valor en el cuantil i/k. Si ese valor
  // repite el corte anterior (muchos valores iguales), se toma el siguiente
  // valor distinto, así no quedan clases vacías ni se pierde el extremo alto.
  const cortes: number[] = [positivos[0]!];
  for (let i = 1; i < k; i++) {
    const ultimo = cortes[cortes.length - 1]!;
    const enCuantil = positivos[Math.floor((i * positivos.length) / k)] ?? ultimo;
    const v = enCuantil > ultimo ? enCuantil : positivos.find((x) => x > ultimo);
    if (v !== undefined) cortes.push(v);
  }
  const max = positivos[positivos.length - 1]!;
  const tonos = rampIndices(cortes.length, rampa.length);

  return cortes.map((from, i) => {
    const siguiente = cortes[i + 1];
    const to = siguiente === undefined ? max : siguiente - 1;
    return {
      from,
      to,
      color: rampa[tonos[i] ?? rampa.length - 1] ?? NO_DATA_COLOR,
      label: from === to ? from.toLocaleString('es-AR') : `${from.toLocaleString('es-AR')} a ${to.toLocaleString('es-AR')}`,
    };
  });
}

/** Color de un valor según las clases. Cero (o sin clases) → gris "sin participación". */
export function heatColor(valor: number, clases: readonly HeatClass[]): string {
  if (valor <= 0) return NO_DATA_COLOR;
  for (let i = clases.length - 1; i >= 0; i--) {
    const c = clases[i]!;
    if (valor >= c.from) return c.color;
  }
  return NO_DATA_COLOR;
}

// -------------------------------------------------
// 4. Coropleta por departamento
// -------------------------------------------------

/** Nombre normalizado → nombre oficial del departamento en el mapa del IGN. */
const DEPARTAMENTOS: ReadonlyMap<string, string> = new Map(
  GEO_DEPARTMENTS.map((d) => [normalizeLocalityName(d.name), d.name]),
);

/** "Laishí" (como viene del backend) → "Laishi" (como lo nombra el IGN). */
export function matchDepartment(nombre: string): string | null {
  return DEPARTAMENTOS.get(normalizeLocalityName(nombre)) ?? null;
}

/**
 * Totales por departamento, que pintan la capa de fondo del mapa.
 *
 * Una localidad ubicada aporta al departamento **del mapa** (el del IGN, que es
 * la autoridad geográfica); una sin ubicación aporta al departamento que dice la
 * fila, si se reconoce. Si tampoco se reconoce, no se asigna a ninguno: el dato
 * ausente se omite, y la localidad igual figura en "Sin ubicación".
 *
 * Mismo criterio de suma que `combinar`: disciplinas y categorías toman el
 * máximo, porque no son sumables entre localidades.
 */
export function departmentTotals(model: LocalityMapModel): Map<string, LocalityFigures> {
  const totales = new Map<string, LocalityFigures>();
  const sumar = (depto: string, f: LocalityFigures) => {
    const previo = totales.get(depto);
    totales.set(depto, previo ? combinar(previo, f) : f);
  };
  for (const m of model.mapped.values()) sumar(m.feature.feature.department, m.figures);
  for (const s of model.unmapped) {
    const depto = matchDepartment(s.department);
    if (depto) sumar(depto, cifras(s));
  }
  return totales;
}

// -------------------------------------------------
// 5. Burbujas por localidad
// -------------------------------------------------

/** Radios en unidades del viewBox (1000 de ancho). */
export const BUBBLE_MIN_RADIUS = 5;
export const BUBBLE_MAX_RADIUS = 13;

/**
 * Radio con **área** proporcional al valor (por eso la raíz cuadrada): una
 * localidad con el cuádruple de atletas tiene el doble de radio, no el
 * cuádruple. Con un piso para que la más chica se pueda tocar. Cero → 0: no se
 * dibuja.
 */
export function bubbleRadius(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.max(BUBBLE_MIN_RADIUS, BUBBLE_MAX_RADIUS * Math.sqrt(valor / maximo));
}

/** Dónde se dibuja una localidad: su punto oficial. */
export function featureAnchor(f: MapFeature): { x: number; y: number } {
  return f.type === 'area'
    ? { x: f.feature.labelX, y: f.feature.labelY }
    : { x: f.feature.x, y: f.feature.y };
}

export interface Bubble {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  value: number;
}

/**
 * Las burbujas a dibujar: **sólo** las localidades con valor mayor a cero en la
 * métrica. Ordenadas de mayor a menor radio, que es el orden de pintado (las
 * chicas quedan encima y se pueden tocar).
 */
export function buildBubbles(
  model: LocalityMapModel,
  metric: MapMetric,
  { separate = true }: { separate?: boolean } = {},
): Bubble[] {
  const conValor = [...model.mapped.values()]
    .map((m) => ({ m, value: metricValue(m.figures, metric) }))
    .filter((x) => x.value > 0);
  const maximo = Math.max(0, ...conValor.map((x) => x.value));
  const burbujas = conValor
    .map(({ m, value }) => ({
      id: m.feature.feature.id,
      name: m.feature.feature.name,
      ...featureAnchor(m.feature),
      r: bubbleRadius(value, maximo),
      value,
    }))
    .sort((a, b) => b.r - a.r || a.name.localeCompare(b.name, 'es'));
  // Con zoom, la separación se hace en coordenadas de pantalla (ver
  // `bubblesOnScreen` en mapZoom.ts): el mapa pide las posiciones reales.
  return separate ? separateBubbles(burbujas) : burbujas;
}

/**
 * Valores de referencia para la leyenda de tamaños, tomados de los **datos
 * reales**: el máximo y, si hay variedad, el mínimo y un valor intermedio que
 * exista. Nunca un número que no esté en el mapa (con todas las localidades en
 * 13, la leyenda muestra sólo 13).
 *
 * Un intermedio cuyo círculo casi no se distingue de un vecino se descarta.
 */
export function bubbleLegendValues(valores: readonly number[]): number[] {
  const distintos = [...new Set(valores.filter((v) => v > 0))].sort((a, b) => b - a);
  const maximo = distintos[0];
  if (maximo === undefined) return [];
  const minimo = distintos[distintos.length - 1]!;
  if (minimo === maximo) return [maximo];
  const medio = distintos[Math.floor(distintos.length / 2)];
  const r = (v: number) => bubbleRadius(v, maximo);
  const conMedio =
    medio !== undefined &&
    medio !== maximo &&
    medio !== minimo &&
    r(maximo) - r(medio) >= 3 &&
    r(medio) - r(minimo) >= 3;
  return conMedio ? [maximo, medio, minimo] : [maximo, minimo];
}

/** Cuánto pueden encimarse dos burbujas, como fracción del radio menor. */
export const BUBBLE_MAX_OVERLAP = 0.25;
/** Cuánto se puede correr una burbuja de su lugar real, en radios propios. */
export const BUBBLE_MAX_SHIFT = 1.1;

/**
 * Separación simple de burbujas: dos localidades vecinas (Ibarreta y
 * Comandante Fontana, a 15 unidades) no pueden taparse casi enteras.
 *
 * Relajación iterativa: cada par que se encima más de lo tolerado se empuja
 * sobre la recta que los une, mitad y mitad. El corrimiento queda acotado a
 * `BUBBLE_MAX_SHIFT` radios de su punto real, así ninguna se va de su zona.
 * Determinista: mismo dato, mismo dibujo.
 */
export function separateBubbles(burbujas: readonly Bubble[]): Bubble[] {
  const pos = burbujas.map((b) => ({ ...b }));
  for (let iter = 0; iter < 60; iter++) {
    let movio = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i]!;
        const b = pos[j]!;
        const minimo = a.r + b.r - BUBBLE_MAX_OVERLAP * Math.min(a.r, b.r);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minimo - 0.01) continue;
        if (d < 0.001) {
          // Mismo punto: se separan en horizontal, en un sentido fijo.
          dx = 1;
          dy = 0;
          d = 1;
        }
        const empuje = (minimo - d) / 2;
        a.x -= (dx / d) * empuje;
        a.y -= (dy / d) * empuje;
        b.x += (dx / d) * empuje;
        b.y += (dy / d) * empuje;
        movio = true;
      }
    }
    // Tope de corrimiento respecto del punto real.
    pos.forEach((p, k) => {
      const orig = burbujas[k]!;
      const tope = BUBBLE_MAX_SHIFT * orig.r;
      const ox = p.x - orig.x;
      const oy = p.y - orig.y;
      const dist = Math.hypot(ox, oy);
      if (dist > tope) {
        p.x = orig.x + (ox / dist) * tope;
        p.y = orig.y + (oy / dist) * tope;
      }
    });
    if (!movio) break;
  }
  return pos.map((p) => ({ ...p, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

// -------------------------------------------------
// 6. Rótulos sin choques
// -------------------------------------------------

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Ancho estimado de un texto sin espaciado extra. */
export function textWidth(texto: string, tamano: number): number {
  return texto.length * tamano * 0.62;
}

export const boxesOverlap = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function boxTouchesCircle(c: Box, b: { x: number; y: number; r: number }): boolean {
  const px = Math.max(c.x0, Math.min(b.x, c.x1));
  const py = Math.max(c.y0, Math.min(b.y, c.y1));
  return Math.hypot(px - b.x, py - b.y) < b.r;
}

export interface PlacedLabel {
  id: string;
  text: string;
  /** Centro de la etiqueta (el texto va centrado). */
  x: number;
  y: number;
  /** Caja completa de la etiqueta, fondo incluido. */
  box: Box;
  /** Punto del borde de la burbuja donde nace el conector. */
  from: { x: number; y: number };
}

export const BUBBLE_LABEL_SIZE = 17;

/**
 * Medidas de la etiqueta de localidad (fondo blanco con borde): el texto más
 * el relleno. Se usa igual para ubicarla y para dibujarla, así lo que el
 * anti-choque cree que ocupa es lo que realmente ocupa.
 */
export function labelBoxSize(texto: string, tamano: number): { w: number; h: number; padX: number } {
  const padX = tamano * 0.5;
  return { w: textWidth(texto, tamano) + 2 * padX, h: tamano * 1.6, padX };
}

/**
 * Nombres de las localidades junto a su burbuja, como etiquetas sin encimarse.
 *
 * Greedy: en orden de importancia, cada etiqueta prueba ocho posiciones
 * pegadas a su burbuja (derecha, izquierda, arriba, abajo y las diagonales) y
 * se queda con la primera que no pisa otra etiqueta, otra burbuja ni se sale
 * del mapa. Si ninguna sirve, se omite (el nombre sigue en el tooltip, el Top
 * 5 y la tabla). Con zoom las burbujas se separan y entran más.
 */
export function placeBubbleLabels(
  burbujas: readonly Bubble[],
  ids: readonly string[],
  ancho: number,
  alto: number,
  /** Tamaño de letra en unidades del viewBox (más grande en pantallas chicas). */
  tamano: number = BUBBLE_LABEL_SIZE,
): PlacedLabel[] {
  const colocados: PlacedLabel[] = [];
  for (const id of ids) {
    const b = burbujas.find((x) => x.id === id);
    if (!b) continue;
    const { w, h } = labelBoxSize(b.name, tamano);
    // Separación corta: la etiqueta queda pegada a su burbuja y el conector
    // cubre el hueco, así no hay duda de a quién pertenece.
    const sep = Math.max(4, tamano * 0.35);
    const d = b.r + sep;
    const diag = (b.r + sep) * Math.SQRT1_2;
    const caja = (cx: number, cy: number): Box => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    // Centro de la caja para cada dirección (la caja toca el punto `d`).
    const candidatos: Array<{ cx: number; cy: number; fx: number; fy: number }> = [
      { cx: b.x + d + w / 2, cy: b.y, fx: 1, fy: 0 },
      { cx: b.x - d - w / 2, cy: b.y, fx: -1, fy: 0 },
      { cx: b.x, cy: b.y - d - h / 2, fx: 0, fy: -1 },
      { cx: b.x, cy: b.y + d + h / 2, fx: 0, fy: 1 },
      { cx: b.x + diag + w / 2, cy: b.y - diag - h / 2, fx: Math.SQRT1_2, fy: -Math.SQRT1_2 },
      { cx: b.x - diag - w / 2, cy: b.y - diag - h / 2, fx: -Math.SQRT1_2, fy: -Math.SQRT1_2 },
      { cx: b.x + diag + w / 2, cy: b.y + diag + h / 2, fx: Math.SQRT1_2, fy: Math.SQRT1_2 },
      { cx: b.x - diag - w / 2, cy: b.y + diag + h / 2, fx: -Math.SQRT1_2, fy: Math.SQRT1_2 },
    ];
    const libre = candidatos.find(({ cx, cy }) => {
      const c = caja(cx, cy);
      return (
        c.x0 >= 2 &&
        c.y0 >= 2 &&
        c.x1 <= ancho - 2 &&
        c.y1 <= alto - 2 &&
        colocados.every((o) => !boxesOverlap(o.box, c)) &&
        burbujas.every((otra) => !boxTouchesCircle(c, otra))
      );
    });
    if (libre) {
      colocados.push({
        id,
        text: b.name,
        x: libre.cx,
        y: libre.cy,
        box: caja(libre.cx, libre.cy),
        from: { x: b.x + libre.fx * b.r, y: b.y + libre.fy * b.r },
      });
    }
  }
  return colocados;
}

/**
 * Elige la posición del rótulo de un departamento: la primera candidata (de
 * `geo:build`, todas adentro del polígono) que no pisa burbujas ni rótulos de
 * localidad. Si todas chocan, `null`: mejor sin rótulo que un rótulo tapado.
 */
export function pickDepartmentAnchor(
  anchors: ReadonlyArray<readonly [number, number]>,
  ancho: number,
  alto: number,
  burbujas: readonly Bubble[],
  rotulos: readonly PlacedLabel[],
): { x: number; y: number } | null {
  for (const [x, y] of anchors) {
    const caja = { x0: x - ancho / 2, y0: y - alto / 2, x1: x + ancho / 2, y1: y + alto / 2 };
    if (burbujas.some((b) => boxTouchesCircle(caja, b))) continue;
    if (rotulos.some((r) => boxesOverlap(r.box, caja))) continue;
    return { x, y };
  }
  return null;
}
