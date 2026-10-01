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
// 3. Rampa de calor
// -------------------------------------------------

/**
 * Los colores del mapa salen de los **tokens del tema** (`@theme` de
 * `src/index.css`), nunca de hex sueltos: si cambia la marca, cambia el mapa.
 * Se usan como `var(--color-…)` en estilos inline del SVG y de la leyenda; el
 * coloreado del calor (que pinta píxeles en un canvas) resuelve los hex en el
 * navegador con `getComputedStyle`.
 */
export type ThemeToken =
  | 'primary-50' | 'primary-100' | 'primary-200' | 'primary-300' | 'primary-400' | 'primary-500'
  | 'primary-600' | 'primary-700' | 'primary-800' | 'primary-900'
  | 'celeste-100' | 'celeste-300' | 'celeste-700'
  | 'heat-teal' | 'heat-green' | 'heat-lime' | 'heat-yellow'
  | 'surface';

/** `'primary-500'` → `'var(--color-primary-500)'`. */
export const themeColor = (token: ThemeToken) => `var(--color-${token})`;

/**
 * Rampa del calor: siete paradas de luminancia siempre creciente, del azul
 * marino del fondo (sin calor) al amarillo del máximo, tipo "viridis". Se lee
 * por luminosidad y por el eje azul → amarillo, que se distingue bien con
 * daltonismo; no tiene rojos. `check:map` verifica que la luminancia crezca en
 * cada parada y que paradas vecinas se distingan (≥ 1,3:1).
 */
export const HEAT_STOPS: ReadonlyArray<{ t: number; token: ThemeToken }> = [
  { t: 0, token: 'primary-900' },
  { t: 0.15, token: 'primary-600' },
  { t: 0.3, token: 'primary-500' },
  { t: 0.5, token: 'heat-teal' },
  { t: 0.68, token: 'heat-green' },
  { t: 0.84, token: 'heat-lime' },
  { t: 1, token: 'heat-yellow' },
];

/** Gradiente CSS de la rampa, para la barra de la leyenda. */
export const HEAT_GRADIENT_CSS = `linear-gradient(to right, ${HEAT_STOPS.map(
  (s) => `${themeColor(s.token)} ${Math.round(s.t * 100)}%`,
).join(', ')})`;

/** Fondo de la provincia (= calor 0) y color del halo de los rótulos. */
export const PROVINCE_FILL: ThemeToken = 'primary-900';

/**
 * Ancho de la difusión: σ = 22 unidades del viewBox (≈ 11 km). Es geográfico:
 * escala con el zoom (a 8× la mancha ocupa 8 veces más píxeles) y no se
 * recalcula por vista. El núcleo se corta en 3σ.
 */
export const HEAT_SIGMA = 22;
export const HEAT_CUTOFF = 3 * HEAT_SIGMA;

/** Piso del peso: una localidad con 1 se ve al menos azul, no "como si no hubiera participado". */
export const HEAT_MIN_WEIGHT = 0.25;

/** Por debajo de este calor el píxel es transparente; hasta `HEAT_ALPHA_FULL` se funde. */
export const HEAT_ALPHA_START = 0.04;
export const HEAT_ALPHA_FULL = 0.15;

/**
 * Peso de una localidad: `0,25 + 0,75 · √(v / vMax)`. La raíz evita que la
 * capital apague a todas; el piso, que una localidad chica desaparezca. Cero
 * (o sin máximo) → 0: no genera calor.
 */
export function heatWeight(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return HEAT_MIN_WEIGHT + (1 - HEAT_MIN_WEIGHT) * Math.sqrt(Math.min(1, valor / maximo));
}

/** Opacidad del píxel según su calor: transparente abajo del umbral, sin borde duro. */
export function heatAlpha(t: number): number {
  if (t < HEAT_ALPHA_START) return 0;
  if (t >= HEAT_ALPHA_FULL) return 1;
  return (t - HEAT_ALPHA_START) / (HEAT_ALPHA_FULL - HEAT_ALPHA_START);
}

/** `#rrggbb` → `[r, g, b]`. Lo que no es un hex de 6 dígitos da negro. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Tabla de 256 colores interpolados entre las paradas (en el orden de
 * `HEAT_STOPS`), como `[r0, g0, b0, r1, …]`. El colorizador la indexa con
 * `round(t · 255)`.
 */
export function buildColorTable(hexes: readonly string[]): Uint8ClampedArray {
  const rgb = hexes.map(hexToRgb);
  const tabla = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let j = 0;
    while (j < HEAT_STOPS.length - 2 && t > HEAT_STOPS[j + 1]!.t) j++;
    const a = HEAT_STOPS[j]!;
    const b = HEAT_STOPS[j + 1]!;
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    const ca = rgb[j] ?? [0, 0, 0];
    const cb = rgb[j + 1] ?? ca;
    for (let k = 0; k < 3; k++) tabla[i * 3 + k] = ca[k]! + (cb[k]! - ca[k]!) * f;
  }
  return tabla;
}

// -------------------------------------------------
// 4. Totales por departamento
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
 * Totales por departamento, para el ranking "Por departamento" del panel.
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
// 5. Puntos de calor y campo de calor
// -------------------------------------------------

/** Dónde se dibuja una localidad: su punto oficial. */
export function featureAnchor(f: MapFeature): { x: number; y: number } {
  return f.type === 'area'
    ? { x: f.feature.labelX, y: f.feature.labelY }
    : { x: f.feature.x, y: f.feature.y };
}

/** Una localidad con participación en la métrica: genera calor. */
export interface HeatPoint {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Valor real de la métrica (> 0). */
  value: number;
  /** Peso del calor, de 0,25 a 1 (`heatWeight`). */
  weight: number;
}

/**
 * Las localidades que generan calor: **sólo** las ubicadas con valor > 0 en la
 * métrica, de mayor a menor (que es también el orden de importancia de sus
 * nombres). Con un solo valor distinto todas pesan 1.
 */
export function buildHeatPoints(model: LocalityMapModel, metric: MapMetric): HeatPoint[] {
  const conValor = [...model.mapped.values()]
    .map((m) => ({ m, value: metricValue(m.figures, metric) }))
    .filter((x) => x.value > 0);
  const maximo = Math.max(0, ...conValor.map((x) => x.value));
  return conValor
    .map(({ m, value }) => ({
      id: m.feature.feature.id,
      name: m.feature.feature.name,
      ...featureAnchor(m.feature),
      value,
      weight: heatWeight(value, maximo),
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'));
}

/** Mínimo y máximo reales de la métrica entre las localidades con calor. */
export function heatValueRange(puntos: readonly HeatPoint[]): { min: number; max: number } | null {
  if (puntos.length === 0) return null;
  const valores = puntos.map((p) => p.value);
  return { min: Math.min(...valores), max: Math.max(...valores) };
}

/**
 * Campo de calor sobre una grilla de `round(W·escala) × round(H·escala)`
 * celdas, con valores de 0 a 1.
 *
 * Decisión del usuario: **cada localidad brilla según su propio valor; las
 * manchas no se suman**. El calor de una celda es el máximo, sobre las
 * localidades, de `peso · gaussiana(distancia)`: cinco pueblos chicos juntos
 * nunca llegan al amarillo de la capital. Como el peso máximo es 1, el centro de
 * la localidad máxima vale exactamente 1 (amarillo) y no hace falta normalizar.
 *
 * Puro (sin DOM): lo ejercita `check:map`. Cada localidad recorre sólo la caja
 * de su núcleo (3σ).
 */
export function computeHeatField(
  puntos: readonly HeatPoint[],
  ancho: number,
  alto: number,
  escala: number,
): { data: Float32Array; width: number; height: number } {
  const width = Math.max(1, Math.round(ancho * escala));
  const height = Math.max(1, Math.round(alto * escala));
  const data = new Float32Array(width * height);
  const dosSigma2 = 2 * HEAT_SIGMA * HEAT_SIGMA;
  const corte2 = HEAT_CUTOFF * HEAT_CUTOFF;

  for (const p of puntos) {
    if (p.weight <= 0) continue;
    const x0 = Math.max(0, Math.floor((p.x - HEAT_CUTOFF) * escala));
    const x1 = Math.min(width - 1, Math.ceil((p.x + HEAT_CUTOFF) * escala));
    const y0 = Math.max(0, Math.floor((p.y - HEAT_CUTOFF) * escala));
    const y1 = Math.min(height - 1, Math.ceil((p.y + HEAT_CUTOFF) * escala));
    for (let j = y0; j <= y1; j++) {
      const dy = (j + 0.5) / escala - p.y;
      const fila = j * width;
      for (let i = x0; i <= x1; i++) {
        const dx = (i + 0.5) / escala - p.x;
        const d2 = dx * dx + dy * dy;
        if (d2 > corte2) continue;
        const v = p.weight * Math.exp(-d2 / dosSigma2);
        if (v > data[fila + i]!) data[fila + i] = v;
      }
    }
  }
  return { data, width, height };
}

/** Calor en un punto del viewBox (para pruebas y para el centro de cada mancha). */
export function heatAt(puntos: readonly HeatPoint[], x: number, y: number): number {
  let max = 0;
  for (const p of puntos) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 > HEAT_CUTOFF * HEAT_CUTOFF) continue;
    max = Math.max(max, p.weight * Math.exp(-d2 / (2 * HEAT_SIGMA * HEAT_SIGMA)));
  }
  return Math.min(1, max);
}

/**
 * Píxeles RGBA del calor: cada celda toma su color de la tabla y su opacidad
 * del umbral (`heatAlpha`). Puro: el componente sólo lo vuelca a un canvas.
 */
export function colorizeHeatField(field: Float32Array, tabla: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(field.length * 4);
  for (let i = 0; i < field.length; i++) {
    const t = Math.min(1, field[i]!);
    const a = heatAlpha(t);
    if (a === 0) continue;
    const k = Math.round(t * 255) * 3;
    px[i * 4] = tabla[k]!;
    px[i * 4 + 1] = tabla[k + 1]!;
    px[i * 4 + 2] = tabla[k + 2]!;
    px[i * 4 + 3] = Math.round(a * 255);
  }
  return px;
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

/**
 * Un marcador de localidad en pantalla, como círculo: lo que los rótulos no
 * pueden tapar.
 */
export interface MapMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  value: number;
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
  /** Centro del rótulo (el texto va centrado). */
  x: number;
  y: number;
  /** Caja que ocupa el rótulo, halo incluido. */
  box: Box;
}

/** Tamaño de letra por defecto de los rótulos, en unidades del viewBox. */
export const DEFAULT_LABEL_SIZE = 17;

/**
 * Medidas del rótulo de una localidad: el texto más el margen del halo. Se usa
 * igual para ubicarlo y para dibujarlo, así lo que el anti-choque cree que
 * ocupa es lo que realmente ocupa.
 */
export function labelBoxSize(texto: string, tamano: number): { w: number; h: number; padX: number } {
  const padX = tamano * 0.25;
  return { w: textWidth(texto, tamano) + 2 * padX, h: tamano * 1.4, padX };
}

/**
 * Nombres de las localidades junto a su marcador, sin encimarse.
 *
 * Greedy: en orden de importancia, cada rótulo prueba ocho posiciones pegadas
 * a su marcador (derecha, izquierda, arriba, abajo y las diagonales) y se queda
 * con la primera que no pisa otro rótulo, otro marcador ni se sale del mapa. Si
 * ninguna sirve, se omite (el nombre sigue en el tooltip, el Top 5 y la tabla).
 * Con zoom los marcadores se separan y entran más.
 */
export function placeBubbleLabels(
  burbujas: readonly MapMarker[],
  ids: readonly string[],
  ancho: number,
  alto: number,
  /** Tamaño de letra en unidades del viewBox (más grande en pantallas chicas). */
  tamano: number = DEFAULT_LABEL_SIZE,
  /** Cajas ya ocupadas que los nombres no pueden pisar (los rótulos de departamento). */
  ocupadas: readonly Box[] = [],
): PlacedLabel[] {
  const colocados: PlacedLabel[] = [];
  for (const id of ids) {
    const b = burbujas.find((x) => x.id === id);
    if (!b) continue;
    const { w, h } = labelBoxSize(b.name, tamano);
    // Separación corta: el rótulo queda pegado a su marcador, así no hay duda
    // de a quién pertenece.
    const sep = Math.max(2, tamano * 0.2);
    const d = b.r + sep;
    const diag = (b.r + sep) * Math.SQRT1_2;
    const caja = (cx: number, cy: number): Box => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    // Centro de la caja para cada dirección (la caja toca el punto `d`).
    const candidatos: Array<{ cx: number; cy: number }> = [
      { cx: b.x + d + w / 2, cy: b.y },
      { cx: b.x - d - w / 2, cy: b.y },
      { cx: b.x, cy: b.y - d - h / 2 },
      { cx: b.x, cy: b.y + d + h / 2 },
      { cx: b.x + diag + w / 2, cy: b.y - diag - h / 2 },
      { cx: b.x - diag - w / 2, cy: b.y - diag - h / 2 },
      { cx: b.x + diag + w / 2, cy: b.y + diag + h / 2 },
      { cx: b.x - diag - w / 2, cy: b.y + diag + h / 2 },
    ];
    const libre = candidatos.find(({ cx, cy }) => {
      const c = caja(cx, cy);
      return (
        c.x0 >= 2 &&
        c.y0 >= 2 &&
        c.x1 <= ancho - 2 &&
        c.y1 <= alto - 2 &&
        colocados.every((o) => !boxesOverlap(o.box, c)) &&
        ocupadas.every((o) => !boxesOverlap(o, c)) &&
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
      });
    }
  }
  return colocados;
}
