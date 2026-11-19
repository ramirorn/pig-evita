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
// Paleta
// ===========================================

/**
 * Colores de las series, de la paleta del tema (variables CSS): funcionan en
 * modo claro y oscuro sin hardcodear hex. Se repiten en ciclo si hay más
 * opciones que colores.
 */
const TOKENS_SERIE = [
  'primary-500',
  'secondary-500',
  'accent-500',
  'celeste-500',
  'warning-500',
  'destructive-500',
  'primary-300',
  'secondary-300',
  'success-500',
  'primary-800',
] as const;

export function colorDeSerie(indice: number): string {
  return `var(--color-${TOKENS_SERIE[indice % TOKENS_SERIE.length]})`;
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

/** Filtros desde la query string; ignora las claves que no son filtros. */
export function filtrosDesdeBusqueda(busqueda: URLSearchParams): MetricsFiltros {
  const filtros: Record<string, string> = {};
  for (const clave of CLAVES_FILTRO) {
    const valor = busqueda.get(clave);
    if (valor) filtros[clave] = valor;
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
