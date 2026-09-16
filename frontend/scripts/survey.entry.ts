// Punto de entrada del chequeo de la encuesta (scripts/check-survey.mjs).
// Sólo reexporta el código real: toda la lógica de aserción vive en el .mjs.
export {
  preguntasVisibles,
  podarRespuestas,
  alternarOpcion,
  obligatoriasSinResponder,
  aRespuestasPayload,
} from '@/pages/public/survey/form/surveyAudience';
export {
  leerBorrador,
  guardarBorrador,
  borrarBorrador,
  leerPendientes,
  encolarEnvio,
  quitarPendiente,
  marcarIntento,
} from '@/pages/public/survey/form/surveyDraft';
export {
  DisciplineType,
  SurveyAudience,
  SurveyQuestionKind,
  CompetitionStage,
} from '@/types';
