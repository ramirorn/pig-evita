// ===========================================
// Punto de entrada del chequeo de formato (scripts/check-format.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
// ===========================================
export {
  SIN_DATO,
  textoOGuion,
  rangoJugadores,
  etiquetaEnum,
  tituloCompuesto,
} from '@/lib/format';
export {
  DISCIPLINE_TYPE_LABELS,
  RESULT_TYPE_LABELS,
  STAGE_LABELS,
  FORMAT_LABELS,
  SEX_LABELS,
  COMPETITION_STATUS_LABELS,
  INSCRIPTION_STATUS_LABELS,
} from '@/lib/constants';
