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
// misma razón que aquél: el acceso a `localStorage` pasa por las tres
// funciones de `lib/storage.ts`, que **tragan la excepción**, porque en modo privado de iOS, con
// cookies de terceros bloqueadas o con el disco lleno, `localStorage` tira al
// leer y al escribir. Un formulario que se rompe por no poder guardar un
// borrador es peor que uno que no guarda borradores.
//
// ⚠️ A diferencia del borrador de la encuesta, **esto sí son datos personales**
// de menores de edad: nombre, DNI, fecha de nacimiento y domicilio. Vive en la
// máquina del encargado, que ya está autenticado en el panel, y se borra en
// cuanto el servidor confirma el alta. No se guarda nada más que lo que está a
// punto de viajar en el mismo request, y nunca un token ni una sesión.
//
// Y es **de quien lo cargó** (VULN-18). Las PC de sede y de oficina son
// compartidas: el borrador guarda el id del usuario (`duenio`), sólo se lee
// con esa misma sesión, se borra cuando entra otro usuario y al cerrar
// sesión, y vive horas, no días. `auth.store.tsx` es quien avisa quién está
// logueado (`fijarDuenioBorradorPlantel`) y quién salió
// (`cerrarSesionBorradorPlantel`). Una sesión que vence sin cerrar no lo borra:
// si vuelve a entrar la misma persona, recupera su plantel.
import { z } from 'zod';
import { Sex } from '@/types';
import { borrarCrudo, escribirCrudo, leerCrudo } from '@/lib/storage';
import type { RosterMember } from './rosterModel';

const CLAVE_BORRADOR = 'evita_plantel_borrador_v2';

/**
 * La clave anterior a VULN-18, sin dueño. No se puede atribuir a nadie, así
 * que se borra en lugar de migrarse.
 */
const CLAVE_BORRADOR_SIN_DUENIO = 'evita_plantel_borrador_v1';

/**
 * Los borradores viejos se descartan.
 *
 * Doce horas cubren una jornada de carga —con un 500, un F5 o una sesión que
 * venció en el medio— sin dejar el DNI y el domicilio de 16 chicos en una PC
 * compartida durante días. Era una semana: también evitaba que un plantel
 * abandonado reapareciera meses después pisando el trabajo del día.
 */
const HORAS_DE_VIDA = 12;

/** Usuario logueado, según `auth.store.tsx`; sin sesión no hay borrador. */
let duenioActual: string | null = null;

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
  /** Id del usuario que lo cargó: sólo esa sesión lo lee. */
  duenio: z.string().min(1),
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
// Borrador
// ===========================================

function estaVencido(guardadoEn: string, ahora: Date): boolean {
  const fecha = new Date(guardadoEn);
  if (Number.isNaN(fecha.getTime())) return true;
  const horas = (ahora.getTime() - fecha.getTime()) / 3_600_000;
  return horas > HORAS_DE_VIDA;
}

/**
 * Avisa quién está logueado (o `null` sin sesión). Si el borrador guardado es
 * de **otro** usuario, se borra: en una PC compartida, el que entra después no
 * tiene por qué heredar las fichas del anterior. El borrador viejo sin dueño
 * se borra siempre.
 */
export function fijarDuenioBorradorPlantel(userId: string | null): void {
  borrarCrudo(CLAVE_BORRADOR_SIN_DUENIO, 'rosterDraft');
  if (userId) {
    const guardado = leerCrudo(CLAVE_BORRADOR, 'rosterDraft') as {
      duenio?: unknown;
    } | null;
    if (guardado && guardado.duenio !== userId) {
      borrarCrudo(CLAVE_BORRADOR, 'rosterDraft');
    }
  }
  duenioActual = userId;
}

/** Cierre de sesión explícito: el borrador se borra y deja de haber dueño. */
export function cerrarSesionBorradorPlantel(): void {
  borrarBorradorPlantel();
  duenioActual = null;
}

/**
 * El plantel a medio cargar que quedó de la última vez, si sigue vigente.
 *
 * Se parsea con Zod y no se castea: lo que hay en el storage lo escribió otra
 * sesión, con otra versión del formulario, y puede haber sido editado a mano.
 */
export function leerBorradorPlantel(ahora = new Date()): BorradorPlantel | null {
  if (!duenioActual) return null;
  const parseado = borradorPlantelSchema.safeParse(leerCrudo(CLAVE_BORRADOR, 'rosterDraft'));
  if (!parseado.success) return null;
  if (parseado.data.duenio !== duenioActual) return null;
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
 * Deja el plantel guardado. Devuelve `false` si el storage no dejó escribir
 * (o si no hay sesión a la que atarlo), para poder avisarle al encargado que
 * esta vez no hay red de contención.
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
    borrarCrudo(CLAVE_BORRADOR, 'rosterDraft');
    return true;
  }
  if (!duenioActual) return false;

  return escribirCrudo(CLAVE_BORRADOR, {
    duenio: duenioActual,
    ...datos,
    members: [...integrantes],
    guardadoEn: ahora.toISOString(),
  } satisfies BorradorPlantel, 'rosterDraft');
}

/**
 * Se llama cuando el servidor **confirmó** el alta, o cuando el encargado
 * descarta el borrador a mano.
 *
 * Nunca se llama en el `catch` de un envío fallido: si el `POST` se cae, el
 * plantel cargado es exactamente lo que hay que conservar.
 */
export function borrarBorradorPlantel(): void {
  borrarCrudo(CLAVE_BORRADOR, 'rosterDraft');
  borrarCrudo(CLAVE_BORRADOR_SIN_DUENIO, 'rosterDraft');
}
