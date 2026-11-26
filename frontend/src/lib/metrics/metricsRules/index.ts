// ===========================================
// metricsRules (reglas puras del panel de Métricas) — punto de entrada
// ===========================================
//
// Partido por tema en la Fase 8. Este index reexporta lo mismo que
// exportaba el archivo único, así que ningún import cambió.
//
// Regla transversal: un corte suprimido por k-anonimato (`conteo: null`)
// **nunca** se convierte en cero. En los gráficos queda fuera (y se cuenta en
// `suprimidas` para avisarlo); en el CSV se escribe "< umbral". Todo sin React;
// `scripts/check-metrics.mjs` lo prueba contra el fuente real.

export { TIPOS_GRAFICO, ETIQUETAS_GRAFICO, DIMENSION_SIN_DESGLOSE, esDimensionPregunta, graficoCompatible, tiposDisponibles, ajustarTipo, aDatosTorta, aDatosBarras, aDatosDispersion, aDatosSerie, etiquetaFecha } from './chartData';
export type { TipoGrafico, DatoTorta, FilaBarras, DatosGrafico, PuntoDispersion, PuntoSerie } from './chartData';
export * from './chartLayout';
export { fraseOpcion, textoBase } from './plainLanguage';
export * from './period';
export * from './heatmap';
export * from './kpis';
export * from './csv';
export * from './filters';
