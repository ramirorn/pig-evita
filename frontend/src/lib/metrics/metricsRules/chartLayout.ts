// ===========================================
// Barras legibles, paleta y totales
// ===========================================
import type { CorteEncuesta } from '@/types';
import type { FilaBarras } from './chartData';

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
