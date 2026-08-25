// ===========================================
// Alcance territorial — tipos y reglas de rol (R05)
// ===========================================
import { Role } from '../constants';

/**
 * Qué territorio ve un usuario.
 *
 * Sólo hay dos formas posibles y son excluyentes:
 *
 *  - `PROVINCIAL`: ve todo. Es el alcance de `SUPER_ADMIN` y `ADMIN_PROVINCIAL`.
 *  - `DEPARTAMENTOS`: ve únicamente las filas cuyo departamento está en la
 *    lista. **La lista puede venir vacía**, y ése es el caso importante: un rol
 *    acotado al que nunca le cargaron su departamento (o un `ADMIN_ZONAL` cuya
 *    zona todavía no tiene departamentos mapeados) no ve *nada*. Fallar cerrado
 *    es deliberado: `User.department` y `User.zone` son nullable, así que sin
 *    esta regla un delegado mal dado de alta terminaría con alcance provincial,
 *    que es justo el agujero que R05 vino a cerrar.
 */
export type Alcance =
  { tipo: 'PROVINCIAL' } | { tipo: 'DEPARTAMENTOS'; departamentos: string[] };

/** Atajo para armar el alcance que no ve nada. */
export const ALCANCE_VACIO: Alcance = {
  tipo: 'DEPARTAMENTOS',
  departamentos: [],
};

/** Atajo para el alcance sin recorte. */
export const ALCANCE_PROVINCIAL: Alcance = { tipo: 'PROVINCIAL' };

/**
 * Roles con alcance provincial: ven la provincia entera.
 *
 * Es una lista corta y cerrada a propósito. Todo rol que no esté acá queda
 * acotado; agregar un rol nuevo al sistema sin tocar este archivo lo deja, por
 * omisión, sin ver nada — el lado seguro del error.
 */
export const ROLES_ALCANCE_PROVINCIAL: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_PROVINCIAL,
];

/**
 * Roles acotados por `User.department`.
 *
 * `ADMIN_DEPARTAMENTAL` por definición; `DELEGADO`, `COORDINADOR` y
 * `ENTRENADOR` porque son los roles operativos que trabajan sobre el padrón de
 * su departamento. Se descartó acotarlos por localidad (`User` no tiene ese
 * campo) y por `createdById` (rompería el trabajo compartido entre dos
 * delegados del mismo departamento).
 */
export const ROLES_ALCANCE_DEPARTAMENTAL: Role[] = [
  Role.ADMIN_DEPARTAMENTAL,
  Role.DELEGADO,
  Role.COORDINADOR,
  Role.ENTRENADOR,
];

/**
 * Roles acotados por `User.zone`.
 *
 * `Participant` y `Team` no tienen columna de zona, así que la zona se traduce
 * a departamentos con la tabla `zone_departments` antes de tocar ninguna query.
 */
export const ROLES_ALCANCE_ZONAL: Role[] = [Role.ADMIN_ZONAL];

/** ¿El alcance deja pasar alguna fila? */
export function alcanzaAlgo(alcance: Alcance): boolean {
  return alcance.tipo === 'PROVINCIAL' || alcance.departamentos.length > 0;
}

/**
 * Texto que se estampa en el encabezado de los reportes.
 *
 * El reporte nunca falla por estar fuera de alcance: sale siempre, con las filas
 * que corresponden, y dice cuáles son. Sin esta línea alguien podría abrir un
 * padrón recortado creyendo que exportó la provincia entera.
 */
export function descripcionAlcance(alcance: Alcance): string {
  if (alcance.tipo === 'PROVINCIAL') {
    return 'Alcance del reporte: provincial (todos los departamentos)';
  }

  if (alcance.departamentos.length === 0) {
    return (
      'Alcance del reporte: sin alcance territorial asignado ' +
      '(no se incluye ninguna fila) — contactá a un administrador provincial'
    );
  }

  return `Alcance del reporte: departamentos ${alcance.departamentos.join(', ')}`;
}
