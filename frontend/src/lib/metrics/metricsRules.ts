// ===========================================
// metricsRules — reglas puras del panel de Métricas
// ===========================================
//
// Todo lo que decide qué gráfico se puede dibujar, cómo se transforma una
// tabla cruzada en datos de recharts, cómo se exporta a CSV y cómo viajan los
// filtros por la URL vive acá, sin React. `scripts/check-metrics.mjs` lo
// prueba contra el fuente real.
//
// Regla transversal: un corte suprimido por k-anonimato (`conteo: null`)
// **nunca** se convierte en cero. En los gráficos queda fuera (y se cuenta en
// `suprimidas` para avisarlo); en el CSV se escribe "< umbral".
import type {
  CorteEncuesta,
  KpiResultado,
  MetricsCross,
  MetricsDimension,
  MetricsFiltros,
  MetricsOverview,
} from '@/types';

// ===========================================
// Tipos de gráfico
// ===========================================

export const TIPOS_GRAFICO = [
  'barras',
  'barras_apiladas',
  'torta',
  'lineas',
  'dispersion',
] as const;

export type TipoGrafico = (typeof TIPOS_GRAFICO)[number];

export const ETIQUETAS_GRAFICO: Record<TipoGrafico, string> = {
  barras: 'Barras',
  barras_apiladas: 'Barras apiladas',
  torta: 'Torta',
  lineas: 'Evolución en el tiempo',
  dispersion: 'Dispersión (pregunta × pregunta)',
};

/**
 * Dimensión que usa el constructor cuando no se elige desglose. La ventana la
 * fija la campaña, así que todas las respuestas caen en una única fila: es la
 * distribución completa de la pregunta, con la supresión aplicada al total.
 */
export const DIMENSION_SIN_DESGLOSE: MetricsDimension = 'ventana';

export function esDimensionPregunta(dimension: MetricsDimension | undefined): boolean {
  return !!dimension && dimension.startsWith('pregunta:');
}

/**
 * ¿Tiene sentido este gráfico con esta configuración?
 * - torta: una sola distribución (sin desglose).
 * - barras / barras apiladas: con o sin desglose.
 * - líneas: la serie temporal de respuestas (no depende del desglose).
 * - dispersión: sólo pregunta × pregunta; sobre ejes categóricos fijos no aporta.
 */
export function graficoCompatible(
  tipo: TipoGrafico,
  desglose: MetricsDimension | undefined,
): boolean {
  switch (tipo) {
    case 'torta':
      return !desglose;
    case 'barras':
    case 'lineas':
      return true;
    case 'barras_apiladas':
      return !!desglose;
    case 'dispersion':
      return esDimensionPregunta(desglose);
  }
}

export function tiposDisponibles(desglose: MetricsDimension | undefined): TipoGrafico[] {
  return TIPOS_GRAFICO.filter((t) => graficoCompatible(t, desglose));
}

/** Si el tipo elegido dejó de servir (cambió el desglose), el primero que sirva. */
export function ajustarTipo(
  tipo: TipoGrafico,
  desglose: MetricsDimension | undefined,
): TipoGrafico {
  // `barras` sirve con cualquier desglose: siempre hay al menos un tipo.
  return graficoCompatible(tipo, desglose) ? tipo : (tiposDisponibles(desglose)[0] ?? 'barras');
}

// ===========================================
// Datos para recharts
// ===========================================

export interface DatoTorta {
  clave: string;
  nombre: string;
  valor: number;
}

export interface FilaBarras {
  etiqueta: string;
  /** opción (texto) → conteo visible; las suprimidas no aparecen. */
  [opcion: string]: string | number;
}

export interface DatosGrafico<T> {
  datos: T[];
  /** Celdas o puntos que no se dibujan porque tienen menos respuestas que el umbral. */
  suprimidas: number;
}

const visible = (c: CorteEncuesta): c is CorteEncuesta & { conteo: number } =>
  !c.suprimido;

/** Torta: las celdas de la única fila (sin desglose). Los ceros no se dibujan. */
export function aDatosTorta(cruce: MetricsCross): DatosGrafico<DatoTorta> {
  const fila = cruce.filas[0];
  if (!fila) return { datos: [], suprimidas: 0 };
  let suprimidas = 0;
  const datos: DatoTorta[] = [];
  for (const celda of fila.celdas) {
    if (!visible(celda)) {
      suprimidas += 1;
      continue;
    }
    if (celda.conteo > 0) {
      datos.push({ clave: celda.valor, nombre: celda.texto, valor: celda.conteo });
    }
  }
  return { datos, suprimidas };
}

/**
 * Barras (simples o apiladas): una fila por valor de la dimensión, una serie
 * por opción. Con `porcentaje`, cada celda se expresa sobre el total de su
 * fila — sólo si el total es visible; si no, la fila entera queda afuera,
 * porque un porcentaje sobre un total oculto lo revelaría.
 */
export function aDatosBarras(
  cruce: MetricsCross,
  { porcentaje = false }: { porcentaje?: boolean } = {},
): DatosGrafico<FilaBarras> {
  let suprimidas = 0;
  const datos: FilaBarras[] = [];
  for (const fila of cruce.filas) {
    if (porcentaje && !visible(fila.totalFila)) {
      suprimidas += fila.celdas.length;
      continue;
    }
    const dato: FilaBarras = { etiqueta: fila.etiqueta };
    const total = visible(fila.totalFila) ? fila.totalFila.conteo : 0;
    for (const celda of fila.celdas) {
      if (!visible(celda)) {
        suprimidas += 1;
        continue;
      }
      dato[celda.texto] = porcentaje
        ? total > 0
          ? Math.round((celda.conteo / total) * 1000) / 10
          : 0
        : celda.conteo;
    }
    datos.push(dato);
  }
  return { datos, suprimidas };
}

export interface PuntoDispersion {
  x: number;
  y: number;
  conteo: number;
  fila: string;
  columna: string;
}

/**
 * Dispersión pregunta × pregunta: una burbuja por combinación visible con al
 * menos una respuesta. `x` es la posición de la fila (opción de la pregunta
 * del desglose), `y` la de la columna; el tamaño es el conteo.
 */
export function aDatosDispersion(cruce: MetricsCross): DatosGrafico<PuntoDispersion> {
  let suprimidas = 0;
  const datos: PuntoDispersion[] = [];
  cruce.filas.forEach((fila, x) => {
    fila.celdas.forEach((celda, y) => {
      if (!visible(celda)) {
        suprimidas += 1;
        return;
      }
      if (celda.conteo > 0) {
        datos.push({ x, y, conteo: celda.conteo, fila: fila.etiqueta, columna: celda.texto });
      }
    });
  });
  return { datos, suprimidas };
}

export interface PuntoSerie {
  fecha: string;
  etiqueta: string;
  /** `null` = suprimido: la línea se corta en vez de bajar a cero. */
  respuestas: number | null;
}

/** Serie temporal del overview. La etiqueta es corta y legible en español. */
export function aDatosSerie(overview: MetricsOverview): DatosGrafico<PuntoSerie> {
  let suprimidas = 0;
  const datos = overview.serie.puntos.map((p) => {
    if (p.suprimido) suprimidas += 1;
    return {
      fecha: p.fecha,
      etiqueta: etiquetaFecha(p.fecha, overview.serie.granularidad),
      respuestas: p.suprimido ? null : p.conteo,
    };
  });
  return { datos, suprimidas };
}

/** `2026-11-10` → `10/11`; `2026-11-10T14:00` → `10/11 14 h`. Sin zona horaria. */
export function etiquetaFecha(fecha: string, granularidad: 'dia' | 'hora'): string {
  const [anioMesDia = '', hora] = fecha.split('T');
  const [, mes = '', dia = ''] = anioMesDia.split('-');
  const base = `${dia}/${mes}`;
  return granularidad === 'hora' && hora ? `${base} ${hora.slice(0, 2)} h` : base;
}

// ===========================================
// Barras legibles
// ===========================================
//
// Con pocas categorías cortas (zona, etapa, sexo) las barras van en columnas.
// Con muchas o con nombres largos (localidades, departamentos) las etiquetas
// en el eje horizontal se encimaban: pasan a barras horizontales, con el
// nombre a la izquierda, ordenadas de mayor a menor y con altura por fila.

export type OrientacionBarras = 'vertical' | 'horizontal';

export const MAX_CATEGORIAS_EN_COLUMNAS = 5;
export const MAX_LARGO_ETIQUETA_EN_COLUMNAS = 14;
export const FILAS_VISIBLES_BARRAS = 15;
const ALTO_FILA_BARRAS = 36;
/** Leyenda, márgenes y eje de valores debajo de las filas. */
const ALTO_EXTRA_BARRAS = 72;
const ALTO_MINIMO_BARRAS = 280;
const PX_POR_CARACTER = 7;
const ANCHO_EJE_MINIMO = 60;
const ANCHO_EJE_MAXIMO = 180;
/** Respiro entre el texto y la barra, en px. */
const RELLENO_EJE = 12;

export function orientacionBarras(etiquetas: readonly string[]): OrientacionBarras {
  const muchas = etiquetas.length > MAX_CATEGORIAS_EN_COLUMNAS;
  const largas = etiquetas.some((e) => e.length > MAX_LARGO_ETIQUETA_EN_COLUMNAS);
  return muchas || largas ? 'horizontal' : 'vertical';
}

/** Ancho del eje de nombres (barras horizontales) según la etiqueta más larga. */
export function anchoEjeEtiquetas(etiquetas: readonly string[]): number {
  const mayor = etiquetas.reduce((max, e) => Math.max(max, e.length), 0);
  const ancho = mayor * PX_POR_CARACTER + RELLENO_EJE;
  return Math.min(ANCHO_EJE_MAXIMO, Math.max(ANCHO_EJE_MINIMO, ancho));
}

/** Caracteres que entran en un eje de `ancho` px. */
export function caracteresEnEje(ancho: number): number {
  return Math.max(4, Math.floor((ancho - RELLENO_EJE) / PX_POR_CARACTER));
}

/** Recorta con "…" sin pasarse de `maximo`; el nombre completo va en el tooltip. */
export function recortarEtiqueta(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  return `${texto.slice(0, Math.max(1, maximo - 1)).trimEnd()}…`;
}

function totalDeFila(fila: FilaBarras): number {
  let total = 0;
  for (const [clave, valor] of Object.entries(fila)) {
    if (clave !== 'etiqueta' && typeof valor === 'number') total += valor;
  }
  return total;
}

export interface DisposicionBarras {
  orientacion: OrientacionBarras;
  filas: FilaBarras[];
  /** Filas que quedan detrás de "Ver todas". */
  ocultas: number;
  /** Alto en px para las horizontales; `null` = el alto fijo del contenedor. */
  alto: number | null;
  anchoEje: number;
}

/**
 * Cómo se dibujan unas barras: orientación, orden, cuántas filas y qué alto.
 * En columnas se respeta el orden original (etapa, zona tienen orden propio);
 * en horizontal se ordena de mayor a menor y se muestran las primeras
 * `FILAS_VISIBLES_BARRAS` salvo que se pida ver todas.
 */
export function disponerBarras(
  datos: readonly FilaBarras[],
  { verTodas = false }: { verTodas?: boolean } = {},
): DisposicionBarras {
  const etiquetas = datos.map((d) => d.etiqueta);
  const orientacion = orientacionBarras(etiquetas);
  if (orientacion === 'vertical') {
    return { orientacion, filas: [...datos], ocultas: 0, alto: null, anchoEje: 0 };
  }
  const ordenadas = [...datos].sort((a, b) => totalDeFila(b) - totalDeFila(a));
  const filas = verTodas ? ordenadas : ordenadas.slice(0, FILAS_VISIBLES_BARRAS);
  return {
    orientacion,
    filas,
    ocultas: ordenadas.length - filas.length,
    alto: Math.max(ALTO_MINIMO_BARRAS, filas.length * ALTO_FILA_BARRAS + ALTO_EXTRA_BARRAS),
    anchoEje: anchoEjeEtiquetas(filas.map((f) => f.etiqueta)),
  };
}

// ===========================================
// Paleta
// ===========================================

/**
 * Colores de las series, de la paleta del tema (variables CSS): funcionan en
 * modo claro y oscuro sin hardcodear hex. Se repiten en ciclo si hay más
 * opciones que colores. Sin el rojo de error: en un panel que se presenta, una
 * opción pintada de rojo se lee como "algo malo" aunque no lo sea.
 */
const TOKENS_SERIE = [
  'primary-500',
  'secondary-500',
  'accent-500',
  'celeste-500',
  'primary-300',
  'secondary-300',
  'accent-300',
  'celeste-300',
  'primary-800',
  'secondary-700',
] as const;

export function colorDeSerie(indice: number): string {
  return `var(--color-${TOKENS_SERIE[indice % TOKENS_SERIE.length]})`;
}

// ===========================================
// Totales
// ===========================================

/**
 * "12 respuestas en el corte" o, si el total está suprimido, "Menos de 5
 * respuestas en el corte": el total pasa por el mismo umbral que las celdas
 * (con el total exacto, los ceros de una fila chica despejaban la celda oculta).
 */
export function textoTotal(total: CorteEncuesta, umbral: number, sufijo: string): string {
  if (total.suprimido) return `Menos de ${umbral} respuestas ${sufijo}`;
  const sustantivo = total.conteo === 1 ? 'respuesta' : 'respuestas';
  return `${total.conteo.toLocaleString('es-AR')} ${sustantivo} ${sufijo}`;
}

// ===========================================
// Lenguaje simple
// ===========================================
//
// Frases para quien no lee gráficos: "4 de cada 10 eligieron «Transporte»".
// Redondean al décimo más cercano pero nunca exageran: 47 % es "casi la
// mitad", no "la mitad"; "casi todos" pide al menos 95 %. Sólo se muestran
// cuando el backend dice que la base alcanza el mínimo (`puedeAfirmar`).

export function fraseOpcion(porcentaje: number, texto: string): string {
  const opcion = `«${texto}»`;
  if (porcentaje >= 95) return `Casi todos eligieron ${opcion}`;
  if (porcentaje >= 50 && porcentaje < 55) return `La mitad eligió ${opcion}`;
  if (porcentaje >= 45 && porcentaje < 50) return `Casi la mitad eligió ${opcion}`;
  if (porcentaje < 5) return `Menos de 1 de cada 10 eligió ${opcion}`;
  const decimos = Math.min(9, Math.max(1, Math.round(porcentaje / 10)));
  return decimos === 1
    ? `1 de cada 10 eligió ${opcion}`
    : `${decimos} de cada 10 eligieron ${opcion}`;
}

const ZONA_HORARIA = 'America/Argentina/Cordoba';

/** "Sobre 312 respuestas · datos al 18/11 12:04" (hora de Formosa). */
export function textoBase(respuestas: number, generadoEn: string): string {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(generadoEn));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  const sustantivo = respuestas === 1 ? 'respuesta' : 'respuestas';
  return `Sobre ${respuestas.toLocaleString('es-AR')} ${sustantivo} · datos al ${parte('day')}/${parte('month')} ${parte('hour')}:${parte('minute')}`;
}

// ===========================================
// Período (Día / Semana / Todo)
// ===========================================

export type Periodo = 'dia' | 'semana' | 'todo';

export const ETIQUETAS_PERIODO: Record<Periodo, string> = {
  dia: 'Hoy',
  semana: 'Últimos 7 días',
  todo: 'Todo',
};

/** `YYYY-MM-DD` de hoy en Formosa (los filtros de fecha del backend van en ese huso). */
export function hoyEnFormosa(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/** Resta días a una fecha `YYYY-MM-DD` sin pasar por husos horarios. */
function restarDias(fecha: string, dias: number): string {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const utc = new Date(Date.UTC(anio, mes - 1, dia - dias));
  return utc.toISOString().slice(0, 10);
}

export function rangoDePeriodo(
  periodo: Periodo,
  hoy: string,
): { desde: string | undefined; hasta: string | undefined } {
  switch (periodo) {
    case 'dia':
      return { desde: hoy, hasta: hoy };
    case 'semana':
      return { desde: restarDias(hoy, 6), hasta: hoy };
    case 'todo':
      return { desde: undefined, hasta: undefined };
  }
}

/** Qué botón del selector corresponde a los filtros; un rango a mano no marca ninguno. */
export function periodoActivo(
  filtros: Pick<MetricsFiltros, 'desde' | 'hasta'>,
  hoy: string,
): Periodo | 'personalizado' {
  if (!filtros.desde && !filtros.hasta) return 'todo';
  for (const periodo of ['dia', 'semana'] as const) {
    const rango = rangoDePeriodo(periodo, hoy);
    if (rango.desde === filtros.desde && rango.hasta === filtros.hasta) return periodo;
  }
  return 'personalizado';
}

// ===========================================
// Mini tendencia (sparkline)
// ===========================================

/**
 * Puntos de un `<polyline>` de `ancho`×`alto` px. Los valores suprimidos
 * (`null`) se saltean: la línea une sólo los publicados, sin inventar ceros.
 */
export function puntosSparkline(
  valores: readonly (number | null)[],
  ancho: number,
  alto: number,
): string {
  const publicados = valores.filter((v): v is number => v !== null);
  if (publicados.length === 0) return '';
  const redondear = (n: number) => Number(n.toFixed(1));
  if (publicados.length === 1) return `0,${alto / 2} ${ancho},${alto / 2}`;
  const min = Math.min(...publicados);
  const max = Math.max(...publicados);
  const rango = max - min || 1;
  return publicados
    .map((v, i) => {
      const x = (i / (publicados.length - 1)) * ancho;
      const y = max === min ? alto / 2 : alto - ((v - min) / rango) * alto;
      return `${redondear(x)},${redondear(y)}`;
    })
    .join(' ');
}

// ===========================================
// Mapa de calor
// ===========================================

export interface ColorCalor {
  fondo: string;
  texto: string;
}

/** Rampa celeste → azul de la marca; los tonos oscuros llevan texto blanco. */
const RAMPA_CALOR: readonly { hasta: number; token: string; claro: boolean }[] = [
  { hasta: 0, token: 'celeste-50', claro: true },
  { hasta: 0.2, token: 'celeste-200', claro: true },
  { hasta: 0.4, token: 'celeste-400', claro: true },
  { hasta: 0.6, token: 'primary-400', claro: false },
  { hasta: 0.8, token: 'primary-600', claro: false },
  { hasta: Infinity, token: 'primary-800', claro: false },
];

export function colorCalor(fraccion: number): ColorCalor {
  const valor = Math.min(1, Math.max(0, fraccion));
  const paso =
    valor === 0
      ? RAMPA_CALOR[0]!
      : (RAMPA_CALOR.slice(1).find((p) => valor < p.hasta) ?? RAMPA_CALOR[RAMPA_CALOR.length - 1]!);
  return {
    fondo: `var(--color-${paso.token})`,
    texto: paso.claro ? 'var(--color-primary-900)' : 'var(--color-white, #ffffff)',
  };
}

export interface CeldaCalor {
  optionId: string;
  /** `null` = suprimida por k-anonimato. */
  conteo: number | null;
  suprimida: boolean;
  /** Proporción dentro de la fila (0 a 1); `null` si no se puede calcular. */
  intensidad: number | null;
}

export interface MapaCalor {
  columnas: { optionId: string; texto: string }[];
  filas: { clave: string | null; etiqueta: string; total: number | null; celdas: CeldaCalor[] }[];
}

/**
 * Tabla cruzada → mapa de calor. La intensidad es la proporción de cada
 * opción dentro de su fila (así un departamento chico y uno grande se
 * comparan); sólo se calcula con el total de la fila visible. Una celda
 * suprimida queda sin color, nunca en cero.
 */
export function heatmapDesdeCruce(cruce: MetricsCross): MapaCalor {
  return {
    columnas: cruce.columnas.map((c) => ({ optionId: c.optionId, texto: c.texto })),
    filas: cruce.filas.map((fila) => {
      const total = visible(fila.totalFila) ? fila.totalFila.conteo : null;
      return {
        clave: fila.clave,
        etiqueta: fila.etiqueta,
        total,
        celdas: fila.celdas.map((celda) => {
          const conteo = visible(celda) ? celda.conteo : null;
          return {
            optionId: celda.optionId,
            conteo,
            suprimida: conteo === null,
            intensidad: conteo !== null && total ? conteo / total : null,
          };
        }),
      };
    }),
  };
}

// ===========================================
// KPIs
// ===========================================

/** Texto grande de la tarjeta: "60 %", "12", o "—" si no se puede publicar. */
export function formatearKpi(kpi: KpiResultado): string {
  if (kpi.valor === null) return '—';
  return kpi.formato === 'porcentaje'
    ? `${kpi.valor.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
    : kpi.valor.toLocaleString('es-AR');
}

/** Por qué una tarjeta muestra "—". `null` cuando el valor se publica. */
export function motivoKpiOculto(kpi: KpiResultado, umbral: number): string | null {
  if (kpi.valor !== null) return null;
  if (kpi.numerador.suprimido || kpi.denominador.suprimido) {
    return `Menos de ${umbral} respuestas en este corte: no se publica para proteger el anonimato.`;
  }
  return 'Todavía no hay respuestas que cumplan la condición base.';
}

// ===========================================
// CSV
// ===========================================

/**
 * Celda de CSV segura: entre comillas, y con apóstrofo delante si empieza con
 * `= + - @` (inyección de fórmulas al abrirlo en Excel, mismo criterio que los
 * reportes del backend).
 */
export function celdaCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '""';
  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Tabla cruzada → CSV. Los suprimidos se escriben "< umbral", nunca como cero. */
export function tablaACsv(cruce: MetricsCross): string {
  const suprimido = `< ${cruce.umbral}`;
  const valor = (c: CorteEncuesta) => (c.suprimido ? suprimido : c.conteo);
  const encabezado = [
    cruce.etiquetaDimension,
    ...cruce.columnas.map((c) => c.texto),
    'Total',
  ];
  const filas = cruce.filas.map((f) => [
    f.etiqueta,
    ...f.celdas.map(valor),
    valor(f.totalFila),
  ]);
  return [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(';')).join('\r\n');
}

/** Nombre de archivo sin caracteres raros: `metricas-lesion-por-zona.csv`. */
export function nombreArchivo(base: string, extension: 'csv' | 'png'): string {
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${limpio || 'metricas'}.${extension}`;
}

// ===========================================
// Filtros ↔ URL
// ===========================================

const CLAVES_FILTRO = [
  'etapa',
  'ventana',
  'disciplineId',
  'disciplineType',
  'localityId',
  'departmentId',
  'zona',
  'categoryId',
  'sexo',
  'desde',
  'hasta',
] as const satisfies readonly (keyof MetricsFiltros)[];

// ===========================================
// Tope de filtros
// ===========================================
//
// El backend rechaza más de 2 filtros a la vez: cada filtro más multiplica las
// restas posibles entre cortes. `desde` y `hasta` juntos son un solo filtro.

export const MAXIMO_FILTROS = 2;

export const TEXTO_TOPE_FILTROS = `Se pueden combinar hasta ${MAXIMO_FILTROS} filtros a la vez, para cuidar el anonimato.`;

export type GrupoFiltro =
  | Exclude<(typeof CLAVES_FILTRO)[number], 'desde' | 'hasta'>
  | 'fecha';

const grupoDe = (clave: (typeof CLAVES_FILTRO)[number]): GrupoFiltro =>
  clave === 'desde' || clave === 'hasta' ? 'fecha' : clave;

/** Los filtros en uso, en el orden de la barra; el rango de fechas cuenta una vez. */
export function filtrosEnUso(filtros: MetricsFiltros): GrupoFiltro[] {
  const grupos: GrupoFiltro[] = [];
  for (const clave of CLAVES_FILTRO) {
    const grupo = grupoDe(clave);
    if (filtros[clave] && !grupos.includes(grupo)) grupos.push(grupo);
  }
  return grupos;
}

/** ¿Se puede tocar este filtro? Sí si ya está en uso o si queda lugar. */
export function puedeSumarFiltro(filtros: MetricsFiltros, grupo: GrupoFiltro): boolean {
  const enUso = filtrosEnUso(filtros);
  return enUso.includes(grupo) || enUso.length < MAXIMO_FILTROS;
}

/**
 * Filtros desde la query string; ignora las claves que no son filtros. Un
 * enlace viejo con más filtros que el tope se lee con los primeros.
 */
export function filtrosDesdeBusqueda(busqueda: URLSearchParams): MetricsFiltros {
  const filtros: Record<string, string> = {};
  const grupos: GrupoFiltro[] = [];
  for (const clave of CLAVES_FILTRO) {
    const valor = busqueda.get(clave);
    if (!valor) continue;
    const grupo = grupoDe(clave);
    if (!grupos.includes(grupo)) {
      if (grupos.length >= MAXIMO_FILTROS) continue;
      grupos.push(grupo);
    }
    filtros[clave] = valor;
  }
  return filtros as MetricsFiltros;
}

/** Escribe los filtros en la query string conservando las claves ajenas. */
export function filtrosABusqueda(
  filtros: MetricsFiltros,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const salida = new URLSearchParams(base);
  for (const clave of CLAVES_FILTRO) {
    const valor = filtros[clave];
    if (valor) salida.set(clave, String(valor));
    else salida.delete(clave);
  }
  return salida;
}

export function hayFiltrosActivos(filtros: MetricsFiltros): boolean {
  return CLAVES_FILTRO.some((clave) => !!filtros[clave]);
}

/**
 * Al cambiar de departamento, una localidad de otro departamento deja de
 * tener sentido: se limpia. Lo mismo la categoría al cambiar de disciplina.
 */
export function aplicarCambioDeFiltro(
  actuales: MetricsFiltros,
  cambio: Partial<MetricsFiltros>,
  catalogo: {
    departamentos: { id: string; localidades: { id: string }[] }[];
    categorias: { id: string; disciplineId: string }[];
  },
): MetricsFiltros {
  const siguiente: MetricsFiltros = { ...actuales, ...cambio };
  // Un filtro más allá del tope no se aplica (la barra ya lo deshabilita).
  if (filtrosEnUso(siguiente).length > MAXIMO_FILTROS) return actuales;
  if ('departmentId' in cambio && siguiente.localityId) {
    const depto = catalogo.departamentos.find((d) => d.id === siguiente.departmentId);
    if (siguiente.departmentId && !depto?.localidades.some((l) => l.id === siguiente.localityId)) {
      siguiente.localityId = undefined;
    }
  }
  if ('disciplineId' in cambio && siguiente.categoryId) {
    const categoria = catalogo.categorias.find((c) => c.id === siguiente.categoryId);
    if (siguiente.disciplineId && categoria?.disciplineId !== siguiente.disciplineId) {
      siguiente.categoryId = undefined;
    }
  }
  return siguiente;
}
