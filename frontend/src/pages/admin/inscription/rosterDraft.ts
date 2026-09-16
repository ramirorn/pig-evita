// ===========================================
// rosterDraft — el plantel a medio cargar, en `localStorage`
// ===========================================
//
// Por qué existe: cargar un plantel de fútbol 11 son **16 fichas completas** con
// DNI, fecha de nacimiento y domicilio. Es media hora de trabajo del encargado.
// Si eso se pierde por un F5, por un 500, por un clic en el menú lateral o
// porque se cerró la pestaña sin querer, no lo vuelve a hacer: llama por
// teléfono, o directamente no inscribe al equipo.
//
// Sigue el mismo molde que `pages/public/survey/form/surveyDraft.ts`, por la
// misma razón que aquél: el acceso a `localStorage` está encapsulado en tres
// funciones que **tragan la excepción**, porque en modo privado de iOS, con
// cookies de terceros bloqueadas o con el disco lleno, `localStorage` tira al
// leer y al escribir. Un formulario que se rompe por no poder guardar un
// borrador es peor que uno que no guarda borradores.
//
// ⚠️ A diferencia del borrador de la encuesta, **esto sí son datos personales**
// de menores de edad: nombre, DNI, fecha de nacimiento y domicilio. Vive en la
// máquina del encargado, que ya está autenticado en el panel, y se borra en
// cuanto el servidor confirma el alta. No se guarda nada más que lo que está a
// punto de viajar en el mismo request, y nunca un token ni una sesión.
import { z } from 'zod';
import { Sex } from '@/types';
import { logError } from '@/lib/logger';
import type { RosterMember } from './rosterModel';

const CLAVE_BORRADOR = 'evita_plantel_borrador_v1';

/**
 * Los borradores viejos se descartan.
 *
 * Una semana es bastante más que lo que dura una sesión de carga y bastante
 * menos que lo que tarda una categoría en cambiar de reglamento. Sin esto, un
 * plantel abandonado en marzo reaparecería en septiembre pisando lo que el
 * encargado estaba por hacer.
 */
const DIAS_DE_VIDA = 7;

/**
 * Forma **estructural** del integrante guardado, a propósito más laxa que
 * `teamMemberSchema`.
 *
 * Es la diferencia importante con el borrador de la encuesta. Ahí, si un
 * borrador no valida se descarta y no se pierde casi nada. Acá, descartar
 * significa tirar media hora de trabajo. Si mañana se endurece una regla de
 * negocio —el formato del DNI, el piso de edad—, un plantel guardado ayer tiene
 * que **volver igual** y que el encargado corrija la ficha que quedó mal, no
 * desaparecer en silencio.
 *
 * Las reglas de negocio se revalidan igual antes de enviar
 * (`teamInscriptionSchema` en el paso de confirmación), así que nada inválido
 * llega al backend por esta puerta.
 */
const integranteGuardadoSchema = z.object({
  id: z.string().min(1),
  dni: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string(),
  sex: z.nativeEnum(Sex),
  phone: z.string().optional(),
  email: z.string().optional(),
  locality: z.string(),
  department: z.string(),
  address: z.string().optional(),
  isSubstitute: z.boolean(),
  position: z.string().optional(),
  shirtNumber: z.number().nullish(),
  isCaptain: z.boolean(),
});

const borradorPlantelSchema = z.object({
  disciplineId: z.string().min(1),
  categoryId: z.string().min(1),
  teamName: z.string(),
  locality: z.string(),
  department: z.string(),
  members: z.array(integranteGuardadoSchema),
  guardadoEn: z.string(),
});

export type BorradorPlantel = z.infer<typeof borradorPlantelSchema>;

// ===========================================
// Acceso crudo al storage
// ===========================================

function leerCrudo(clave: string): unknown {
  try {
    const texto = localStorage.getItem(clave);
    if (!texto) return null;
    return JSON.parse(texto);
  } catch (error) {
    logError('rosterDraft.leerCrudo', error);
    return null;
  }
}

function escribirCrudo(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    logError('rosterDraft.escribirCrudo', error);
    return false;
  }
}

function borrarCrudo(clave: string): void {
  try {
    localStorage.removeItem(clave);
  } catch (error) {
    logError('rosterDraft.borrarCrudo', error);
  }
}

// ===========================================
// Borrador
// ===========================================

function estaVencido(guardadoEn: string, ahora: Date): boolean {
  const fecha = new Date(guardadoEn);
  if (Number.isNaN(fecha.getTime())) return true;
  const dias = (ahora.getTime() - fecha.getTime()) / 86_400_000;
  return dias > DIAS_DE_VIDA;
}

/**
 * El plantel a medio cargar que quedó de la última vez, si sigue vigente.
 *
 * Se parsea con Zod y no se castea: lo que hay en el storage lo escribió otra
 * sesión, con otra versión del formulario, y puede haber sido editado a mano.
 */
export function leerBorradorPlantel(ahora = new Date()): BorradorPlantel | null {
  const parseado = borradorPlantelSchema.safeParse(leerCrudo(CLAVE_BORRADOR));
  if (!parseado.success) return null;
  if (parseado.data.members.length === 0) return null;
  if (estaVencido(parseado.data.guardadoEn, ahora)) return null;
  return parseado.data;
}

export interface DatosBorrador {
  disciplineId: string;
  categoryId: string;
  teamName: string;
  locality: string;
  department: string;
}

/**
 * Deja el plantel guardado. Devuelve `false` si el storage no dejó escribir,
 * para poder avisarle al encargado que esta vez no hay red de contención.
 *
 * Un plantel **sin integrantes** borra el borrador en lugar de guardar uno
 * vacío: si el encargado sacó a todos, no hay nada que restaurar y un borrador
 * vacío sólo serviría para reaparecer más tarde sin contenido.
 */
export function guardarBorradorPlantel(
  datos: DatosBorrador,
  integrantes: readonly RosterMember[],
  ahora = new Date(),
): boolean {
  if (integrantes.length === 0) {
    borrarCrudo(CLAVE_BORRADOR);
    return true;
  }

  return escribirCrudo(CLAVE_BORRADOR, {
    ...datos,
    members: [...integrantes],
    guardadoEn: ahora.toISOString(),
  } satisfies BorradorPlantel);
}

/**
 * Se llama cuando el servidor **confirmó** el alta, o cuando el encargado
 * descarta el borrador a mano.
 *
 * Nunca se llama en el `catch` de un envío fallido: si el `POST` se cae, el
 * plantel cargado es exactamente lo que hay que conservar.
 */
export function borrarBorradorPlantel(): void {
  borrarCrudo(CLAVE_BORRADOR);
}
