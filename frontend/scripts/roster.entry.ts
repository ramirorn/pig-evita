// Punto de entrada del chequeo del plantel (scripts/check-roster.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  leerPlantelRequerido,
  plantelSinConfigurar,
  calcularEdad,
  contarPlantel,
  plantelCompleto,
  hayLugar,
  validarIntegrante,
  aplicarIntegrante,
  quitarIntegrante,
  aPayloadPlantel,
  extraerDnisEnConflicto,
  nuevoIdIntegrante,
} from '@/pages/admin/inscription/rosterModel';
export {
  leerBorradorPlantel,
  guardarBorradorPlantel,
  borrarBorradorPlantel,
} from '@/pages/admin/inscription/rosterDraft';
export { disciplineSchema, teamInscriptionSchema } from '@/schemas';
export { DisciplineType, ResultType, Sex } from '@/types';
