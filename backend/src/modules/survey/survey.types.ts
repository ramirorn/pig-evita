// ===========================================
// Encuesta — formas de respuesta (S20)
// ===========================================
//
// Los tipos de este archivo son el contrato que el frontend replica en
// `frontend/src/types/` (AGENTS §4: el backend es la fuente de verdad). Todo lo
// sobre de supresión que usan las métricas pasa por acá, para que ningún corte
// suprimido pueda devolverse por accidente con un `conteo` adentro.
import { MOTIVO_SUPRESION } from './survey.constants';

/**
 * Corte suprimido por k-anonimato.
 *
 * `conteo: null` y no `0`: el corte existe y tiene respuestas, lo que no se
 * publica es cuántas. Un cero mentiría y además invitaría a sumar los cortes
 * para despejar el faltante.
 */
export interface CorteSuprimido {
  suprimido: true;
  motivo: typeof MOTIVO_SUPRESION;
  conteo: null;
}

/** Corte publicable. */
export interface CorteVisible {
  suprimido: false;
  conteo: number;
}

export type Corte = CorteVisible | CorteSuprimido;

/**
 * Acuse del envío público.
 *
 * No devuelve el `id` de la respuesta a propósito: un id en manos del cliente
 * es un recibo que alguien podría guardar (en localStorage, en un log de
 * analytics) y que volvería a atar un dispositivo a una fila que existe
 * justamente para no estar atada a nadie.
 */
export interface SurveySubmitResult {
  registrada: true;
  enviadaEn: Date;
}
