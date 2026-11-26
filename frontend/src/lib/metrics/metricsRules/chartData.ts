// ===========================================
// Tipos de gráfico y datos para recharts
// ===========================================
import type { CorteEncuesta, MetricsCross, MetricsDimension, MetricsOverview } from '@/types';

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

export const visible = (c: CorteEncuesta): c is CorteEncuesta & { conteo: number } =>
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
