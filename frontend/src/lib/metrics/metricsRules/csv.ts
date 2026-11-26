// ===========================================
// Exportación a CSV
// ===========================================
import type { CorteEncuesta, MetricsCross } from '@/types';

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
