// ===========================================
// rosterModel — las reglas del plantel, sin React
// ===========================================
//
// Todo lo que decide si un plantel está bien vive acá: cuántos titulares y
// suplentes pide la disciplina, si un chico entra en la categoría, si el DNI ya
// está en la lista, y quién es el capitán. Está afuera de los componentes por
// dos razones concretas:
//
//   1. El contador de la pantalla ("Titulares 7/11 · Suplentes 2/5") y la
//      validación del botón "Agregar" tienen que salir de la **misma** cuenta.
//      Cuando son dos cuentas distintas, la que se olvida de actualizarse es
//      siempre la que bloquea el envío, y el encargado se entera después de
//      cargar 16 chicos.
//   2. `scripts/check-roster.mjs` importa este archivo tal cual y verifica las
//      reglas contra el fuente real. El proyecto no tiene runner de tests: ese
//      chequeo es el molde que usa en su lugar.
import { Sex, DisciplineType, type Category, type Discipline } from '@/types';
import { teamMemberSchema, type TeamMemberValues } from '@/schemas';
import type { CreateTeamInscriptionPayload } from '@/api/inscriptions.api';

// ===========================================
// Plantel requerido por la disciplina
// ===========================================

export interface PlantelRequerido {
  titulares: number;
  maxSuplentes: number;
}

/** Lo mínimo de una disciplina que hace falta para saber qué plantel pide. */
export type DisciplinaConPlantel = Pick<Discipline, 'type' | 'titulares' | 'maxSuplentes'>;

/**
 * El plantel que exige la disciplina, o `null` si no se puede saber.
 *
 * Devuelve `null` en los dos casos en que no hay plantel contra el cual contar:
 * la disciplina es `INDIVIDUAL` (no tiene sentido), o es de `EQUIPO` pero
 * `titulares` / `maxSuplentes` vinieron en `null` porque nadie los cargó desde
 * el ABM de Disciplinas. Hoy esto último le pasa a **casi todas** las
 * disciplinas del sistema, así que no es un caso de borde: es el caso común.
 */
export function leerPlantelRequerido(
  discipline: DisciplinaConPlantel | undefined,
): PlantelRequerido | null {
  if (!discipline || discipline.type !== DisciplineType.EQUIPO) return null;

  const { titulares, maxSuplentes } = discipline;
  if (typeof titulares !== 'number' || titulares < 1) return null;
  if (typeof maxSuplentes !== 'number' || maxSuplentes < 0) return null;

  return { titulares, maxSuplentes };
}

/**
 * `true` cuando la disciplina es de equipo pero le falta la configuración de
 * plantel. Es lo que corta el flujo **en el paso 1**, antes de que alguien
 * cargue a nadie: un 400 después de 16 altas no es recuperable.
 */
export function plantelSinConfigurar(discipline: DisciplinaConPlantel | undefined): boolean {
  if (!discipline || discipline.type !== DisciplineType.EQUIPO) return false;
  return leerPlantelRequerido(discipline) === null;
}

// ===========================================
// Integrantes
// ===========================================

/**
 * Un integrante del plantel en memoria.
 *
 * El `id` es **local a este dispositivo**: identifica la fila mientras se la
 * edita o se la quita, y nunca viaja al backend. Hace falta porque el DNI —que
 * sería el identificador natural— es justamente uno de los campos que se puede
 * estar corrigiendo.
 */
export interface RosterMember extends TeamMemberValues {
  id: string;
}

export function nuevoIdIntegrante(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Edad cumplida a la fecha de referencia (hoy, salvo en los chequeos).
 *
 * `'2013-09-16'` se lee como fecha **local**: `new Date('2013-09-16')` es
 * medianoche UTC, que en Argentina (UTC−3) cae el 15 a las 21 h, y la víspera
 * del cumpleaños ya contaba un año más.
 */
export function calcularEdad(birthDate: string, referencia = new Date()): number | null {
  if (!birthDate) return null;
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const nacimiento = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(birthDate);
  if (Number.isNaN(nacimiento.getTime())) return null;

  let edad = referencia.getFullYear() - nacimiento.getFullYear();
  const meses = referencia.getMonth() - nacimiento.getMonth();
  if (meses < 0 || (meses === 0 && referencia.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

export interface ConteoPlantel {
  titulares: number;
  suplentes: number;
}

export function contarPlantel(integrantes: readonly RosterMember[]): ConteoPlantel {
  let titulares = 0;
  let suplentes = 0;
  for (const integrante of integrantes) {
    if (integrante.isSubstitute) suplentes++;
    else titulares++;
  }
  return { titulares, suplentes };
}

/**
 * El plantel está listo para enviarse cuando están **todos** los titulares.
 *
 * Los suplentes son un techo, no un piso: `maxSuplentes` es "hasta", y un
 * equipo con 11 titulares y 0 suplentes se puede inscribir igual.
 */
export function plantelCompleto(
  integrantes: readonly RosterMember[],
  requerido: PlantelRequerido,
): boolean {
  return contarPlantel(integrantes).titulares === requerido.titulares;
}

/** Cupo libre para un titular o un suplente más. `ignorarId` excluye al que se está editando. */
export function hayLugar(
  integrantes: readonly RosterMember[],
  requerido: PlantelRequerido,
  isSubstitute: boolean,
  ignorarId?: string,
): boolean {
  const restantes = integrantes.filter((integrante) => integrante.id !== ignorarId);
  const conteo = contarPlantel(restantes);
  return isSubstitute
    ? conteo.suplentes < requerido.maxSuplentes
    : conteo.titulares < requerido.titulares;
}

// ===========================================
// Validación de un alta / edición
// ===========================================

export type ResultadoValidacion =
  | { ok: true; integrante: RosterMember }
  | { ok: false; mensaje: string };

export interface EntradaValidacion {
  valores: TeamMemberValues;
  integrantes: readonly RosterMember[];
  categoria: Pick<Category, 'minAge' | 'maxAge' | 'sex' | 'name'>;
  requerido: PlantelRequerido;
  /** Id del integrante que se está editando, si no es un alta. */
  editandoId?: string;
  /** Fecha contra la que se calcula la edad. Parametrizada para los chequeos. */
  hoy?: Date;
}

/**
 * Todo lo que tiene que pasar **antes** de que alguien entre en la lista.
 *
 * El orden importa: primero la forma de los datos, después las reglas que
 * dependen de la categoría, y al final el cupo. Así el mensaje que se muestra
 * es el primero que el encargado puede arreglar, no el último.
 *
 * La edad y el sexo se chequean acá, en el cliente, con la categoría que ya
 * está en memoria. Dejarlos para el submit significaría descubrir en el chico
 * número 3 un problema recién cuando se mandan los 16.
 */
export function validarIntegrante({
  valores,
  integrantes,
  categoria,
  requerido,
  editandoId,
  hoy = new Date(),
}: EntradaValidacion): ResultadoValidacion {
  const parseado = teamMemberSchema.safeParse(valores);
  if (!parseado.success) {
    return {
      ok: false,
      mensaje: parseado.error.issues[0]?.message ?? 'Revisá los datos del integrante',
    };
  }

  const datos = parseado.data;
  const dni = datos.dni.trim();

  const repetido = integrantes.find(
    (integrante) => integrante.id !== editandoId && integrante.dni.trim() === dni,
  );
  if (repetido) {
    return {
      ok: false,
      mensaje: `El DNI ${dni} ya está en este plantel (${repetido.firstName} ${repetido.lastName}). Cada integrante se carga una sola vez.`,
    };
  }

  const edad = calcularEdad(datos.birthDate, hoy);
  if (edad === null) {
    return { ok: false, mensaje: 'Revisá la fecha de nacimiento: no se puede calcular la edad.' };
  }
  if (edad < categoria.minAge || edad > categoria.maxAge) {
    return {
      ok: false,
      mensaje: `${datos.firstName} ${datos.lastName} tiene ${edad} años y ${categoria.name} va de ${categoria.minAge} a ${categoria.maxAge}. No puede integrar este plantel.`,
    };
  }
  if (categoria.sex !== Sex.MIXTO && categoria.sex !== datos.sex) {
    const rama = categoria.sex === Sex.FEMENINO ? 'femenina' : 'masculina';
    return {
      ok: false,
      mensaje: `${categoria.name} es una categoría ${rama}: no podés cargar a ${datos.firstName} ${datos.lastName} en este plantel.`,
    };
  }

  if (!hayLugar(integrantes, requerido, datos.isSubstitute, editandoId)) {
    return {
      ok: false,
      mensaje: datos.isSubstitute
        ? `Ya cargaste los ${requerido.maxSuplentes} suplentes que admite la disciplina.`
        : `Ya cargaste los ${requerido.titulares} titulares que pide la disciplina. Si falta alguien, marcalo como suplente o corregí a uno de los que ya están.`,
    };
  }

  return {
    ok: true,
    integrante: { ...datos, dni, id: editandoId ?? nuevoIdIntegrante() },
  };
}

/**
 * Mete (o reemplaza) un integrante en la lista manteniendo **un solo capitán**.
 *
 * La unicidad se resuelve acá y no con un mensaje de error: si el encargado
 * marca capitán al número 7, el que lo era deja de serlo. Pedirle que primero
 * desmarque al anterior sería hacerle trabajo de más por una regla del sistema.
 */
export function aplicarIntegrante(
  integrantes: readonly RosterMember[],
  integrante: RosterMember,
  editandoId?: string,
): RosterMember[] {
  const base = editandoId
    ? integrantes.map((actual) => (actual.id === editandoId ? integrante : actual))
    : [...integrantes, integrante];

  if (!integrante.isCaptain) return base;

  return base.map((actual) =>
    actual.id === integrante.id ? actual : { ...actual, isCaptain: false },
  );
}

export function quitarIntegrante(
  integrantes: readonly RosterMember[],
  id: string,
): RosterMember[] {
  return integrantes.filter((integrante) => integrante.id !== id);
}

// ===========================================
// Envío
// ===========================================

export interface DatosEquipo {
  disciplineId: string;
  categoryId: string;
  teamName: string;
  locality: string;
  department: string;
}

/**
 * Arma el body de `POST /inscriptions/team`.
 *
 * Los opcionales vacíos se omiten en vez de viajar como `""`: el backend
 * distingue "no lo sé" de "está vacío", y un email `""` rompe su validación.
 */
export function aPayloadPlantel(
  equipo: DatosEquipo,
  integrantes: readonly RosterMember[],
): CreateTeamInscriptionPayload {
  return {
    disciplineId: equipo.disciplineId,
    categoryId: equipo.categoryId,
    teamName: equipo.teamName.trim(),
    locality: equipo.locality.trim(),
    department: equipo.department.trim(),
    members: integrantes.map((integrante) => ({
      dni: integrante.dni.trim(),
      firstName: integrante.firstName.trim(),
      lastName: integrante.lastName.trim(),
      birthDate: integrante.birthDate,
      sex: integrante.sex,
      phone: integrante.phone?.trim() || undefined,
      email: integrante.email?.trim() || undefined,
      locality: integrante.locality.trim(),
      department: integrante.department.trim(),
      address: integrante.address?.trim() || undefined,
      isSubstitute: integrante.isSubstitute,
      position: integrante.position?.trim() || undefined,
      shirtNumber: typeof integrante.shirtNumber === 'number' ? integrante.shirtNumber : undefined,
      isCaptain: integrante.isCaptain,
    })),
  };
}

// ===========================================
// Lectura del rechazo del backend
// ===========================================

/** Un DNI argentino suelto en un texto. Mismo formato que `participantSchema`. */
const DNI_EN_TEXTO = /\b\d{7,8}\b/g;

function cuerpoDeRespuesta(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null) return null;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return null;
  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;
  return data as Record<string, unknown>;
}

function textosDelCuerpo(cuerpo: Record<string, unknown>): string[] {
  const textos: string[] = [];
  const mensaje = cuerpo['message'];
  if (typeof mensaje === 'string') textos.push(mensaje);
  if (Array.isArray(mensaje)) {
    for (const item of mensaje) if (typeof item === 'string') textos.push(item);
  }
  const error = cuerpo['error'];
  if (typeof error === 'string') textos.push(error);
  return textos;
}

/**
 * Qué integrantes del plantel rechazó el backend, por DNI.
 *
 * El caso que importa es "ya está inscripto en esta categoría", que el backend
 * responde nombrando al participante por DNI y nombre. Se lo lee de dos formas
 * y se cruza contra el plantel que se tiene en pantalla:
 *
 *   - por si el cuerpo trae los DNIs estructurados (`data.dnis`, o una lista de
 *     objetos con `dni`), que es lo que conviene si el backend lo formaliza;
 *   - y, si no, sacando los números de 7 u 8 dígitos del texto del mensaje.
 *
 * El cruce contra el plantel es lo que hace segura la heurística: un número
 * suelto que no sea el DNI de nadie de la lista se descarta, así que en el peor
 * caso no se marca a nadie y queda el mensaje del backend. Nunca se marca a
 * alguien que no estaba en la lista.
 */
export function extraerDnisEnConflicto(
  error: unknown,
  integrantes: readonly RosterMember[],
): string[] {
  const cuerpo = cuerpoDeRespuesta(error);
  if (!cuerpo) return [];

  const candidatos = new Set<string>();

  const estructurados = cuerpo['dnis'];
  if (Array.isArray(estructurados)) {
    for (const item of estructurados) {
      if (typeof item === 'string') candidatos.add(item.trim());
      else if (typeof item === 'object' && item !== null) {
        const dni = (item as { dni?: unknown }).dni;
        if (typeof dni === 'string') candidatos.add(dni.trim());
      }
    }
  }

  for (const texto of textosDelCuerpo(cuerpo)) {
    for (const encontrado of texto.match(DNI_EN_TEXTO) ?? []) {
      candidatos.add(encontrado);
    }
  }

  const enPlantel = new Set(integrantes.map((integrante) => integrante.dni.trim()));
  return [...candidatos].filter((dni) => enPlantel.has(dni));
}
