// ===========================================
// surveyDraft — el borrador y la cola de envíos, en `localStorage`
// ===========================================
//
// Por qué existe este archivo: la edición anterior de la encuesta no llegó al
// 50 % de respuestas y la causa principal fue la conectividad. Alguien contesta
// seis preguntas en una cancha de Laguna Yema, se le corta la señal, y el
// formulario en memoria se lleva todo puesto. Nada de esto es una mejora
// opcional: es el requisito.
//
// ⚠️ **Nada de lo que se guarda acá identifica a nadie.** Es lo mismo que viaja
// en el envío anónimo —disciplina, categoría, sexo y los ids de las opciones
// elegidas—, sin nombre, DNI, mail ni teléfono. Y se borra en cuanto el
// servidor confirma.
import { z } from 'zod';
import {
  surveyContextSchema,
  surveySubmissionSchema,
  type SurveySubmissionValues,
} from '@/schemas';
import { logError } from '@/lib/logger';
import type { RespuestasPorPregunta } from './surveyAudience';

const CLAVE_BORRADOR = 'evita_encuesta_borrador_v1';
const CLAVE_PENDIENTES = 'evita_encuesta_pendientes_v1';

/**
 * Tope de envíos en cola.
 *
 * No es una bandeja de salida: son los intentos de una persona que está
 * contestando *una* encuesta. Más de un puñado significa que algo se rompió, y
 * dejar crecer la lista sin techo llenaría el `localStorage` del teléfono. Se
 * descartan los más viejos, que son los que más chances tienen de apuntar a una
 * campaña ya cerrada.
 */
const MAX_PENDIENTES = 5;

const borradorSchema = z.object({
  campaignId: z.string().uuid(),
  contexto: surveyContextSchema.partial(),
  /** `{ questionId: [optionId, …] }`. */
  respuestas: z.record(z.string(), z.array(z.string())),
  guardadoEn: z.string(),
});

export type BorradorEncuesta = z.infer<typeof borradorSchema>;

const envioPendienteSchema = z.object({
  /**
   * Identificador **del elemento de la cola**, no de la respuesta.
   *
   * Se genera y muere en este dispositivo: nunca se manda al servidor. Sirve
   * para sacar de la lista el envío que ya se confirmó. El acuse del backend, a
   * propósito, no trae ningún id (ver `SurveySubmitResult`).
   */
  id: z.string(),
  creadoEn: z.string(),
  intentos: z.number().int().min(0),
  payload: surveySubmissionSchema,
});

export type EnvioPendiente = z.infer<typeof envioPendienteSchema>;

// ===========================================
// Acceso crudo al storage
// ===========================================
//
// Todo pasa por estas dos funciones, y las dos tragan la excepción: en modo
// privado de iOS, con cookies de terceros bloqueadas o con el disco lleno,
// `localStorage` **tira** al leer y al escribir. Un formulario que se rompe por
// no poder guardar un borrador es peor que uno que no guarda borradores.

function leerCrudo(clave: string): unknown {
  try {
    const texto = localStorage.getItem(clave);
    if (!texto) return null;
    return JSON.parse(texto);
  } catch (error) {
    logError('surveyDraft.leerCrudo', error);
    return null;
  }
}

function escribirCrudo(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    logError('surveyDraft.escribirCrudo', error);
    return false;
  }
}

function borrarCrudo(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch (error) {
    logError('surveyDraft.borrarCrudo', error);
  }
}

// ===========================================
// Borrador
// ===========================================

/**
 * Borrador guardado, **si es de esta campaña**.
 *
 * Se parsea con Zod y no se castea: lo que hay en el storage lo escribió otra
 * sesión, con otra versión del formulario, y puede haber sido editado a mano.
 * Si no valida se descarta en silencio — no hay nada que el usuario pueda hacer
 * con "tu borrador estaba corrupto".
 *
 * El filtro por `campaignId` es lo que evita el caso feo: terminó la ventana
 * PRE, se publicó la DURANTE, y el borrador viejo le restauraría respuestas a
 * preguntas de otra encuesta.
 */
export function leerBorrador(campaignId: string): BorradorEncuesta | null {
  const parseado = borradorSchema.safeParse(leerCrudo(CLAVE_BORRADOR));
  if (!parseado.success) return null;
  if (parseado.data.campaignId !== campaignId) return null;
  return parseado.data;
}

export function guardarBorrador(
  campaignId: string,
  contexto: BorradorEncuesta['contexto'],
  respuestas: RespuestasPorPregunta,
): void {
  escribirCrudo(CLAVE_BORRADOR, {
    campaignId,
    contexto,
    respuestas,
    guardadoEn: new Date().toISOString(),
  } satisfies BorradorEncuesta);
}

/** Se llama cuando el servidor confirmó: el borrador ya no representa nada. */
export function borrarBorrador(): void {
  borrarCrudo(CLAVE_BORRADOR);
}

// ===========================================
// Cola de envíos
// ===========================================

/**
 * Envíos que no llegaron a salir, listos para reintentar.
 *
 * Los que no validan contra `surveySubmissionSchema` se tiran: mandarlos sólo
 * cosecharía un 400 que quien responde no puede accionar.
 */
export function leerPendientes(): EnvioPendiente[] {
  const crudo = leerCrudo(CLAVE_PENDIENTES);
  if (!Array.isArray(crudo)) return [];

  return crudo.flatMap((item) => {
    const parseado = envioPendienteSchema.safeParse(item);
    return parseado.success ? [parseado.data] : [];
  });
}

function guardarPendientes(pendientes: EnvioPendiente[]): void {
  if (pendientes.length === 0) {
    borrarCrudo(CLAVE_PENDIENTES);
    return;
  }
  escribirCrudo(CLAVE_PENDIENTES, pendientes.slice(-MAX_PENDIENTES));
}

/**
 * Deja un envío en cola y devuelve la lista resultante.
 *
 * Se llama **sólo** cuando se sabe que la request no llegó a destino (no hubo
 * respuesta del servidor). Un 400 o un 429 no se encolan: el primero no se va a
 * arreglar reintentando y el segundo ya fue recibido.
 */
export function encolarEnvio(
  payload: SurveySubmissionValues,
): EnvioPendiente[] {
  const pendiente: EnvioPendiente = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    creadoEn: new Date().toISOString(),
    intentos: 1,
    payload,
  };

  const pendientes = [...leerPendientes(), pendiente];
  guardarPendientes(pendientes);
  return pendientes.slice(-MAX_PENDIENTES);
}

/** Saca de la cola un envío confirmado (o descartado) y devuelve el resto. */
export function quitarPendiente(id: string): EnvioPendiente[] {
  const restantes = leerPendientes().filter((item) => item.id !== id);
  guardarPendientes(restantes);
  return restantes;
}

/** Suma un intento fallido, para poder mostrar que se siguió intentando. */
export function marcarIntento(id: string): EnvioPendiente[] {
  const actualizados = leerPendientes().map((item) =>
    item.id === id ? { ...item, intentos: item.intentos + 1 } : item,
  );
  guardarPendientes(actualizados);
  return actualizados;
}
