// ===========================================
// Mapa de calor
// ===========================================
import type { MetricsCross } from '@/types';
import { visible } from './chartData';

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
