// Punto de entrada del chequeo de métricas (scripts/check-metrics.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  TIPOS_GRAFICO,
  DIMENSION_SIN_DESGLOSE,
  graficoCompatible,
  tiposDisponibles,
  ajustarTipo,
  aDatosTorta,
  aDatosBarras,
  aDatosDispersion,
  aDatosSerie,
  etiquetaFecha,
  colorDeSerie,
  formatearKpi,
  motivoKpiOculto,
  celdaCsv,
  tablaACsv,
  nombreArchivo,
  filtrosDesdeBusqueda,
  filtrosABusqueda,
  hayFiltrosActivos,
  aplicarCambioDeFiltro,
} from '@/lib/metrics/metricsRules';
