// ===========================================
// useQueryScope — namespace de cache por usuario
// ===========================================
import { useAuth } from '@/store/auth.store';

/** Ámbito para las queries que se hacen sin sesión iniciada. */
export const ANONYMOUS_SCOPE = 'anon';

/**
 * Devuelve el identificador con el que se namespacean los `queryKey`
 * (hallazgos F4-F7).
 *
 * Los listados de inscripciones, participantes, usuarios y equipos devuelven
 * datos distintos según **quién** pregunta: el backend filtra por rol y por
 * delegación. Con un `queryKey` que sólo dependía de los filtros, dos usuarios
 * en el mismo navegador compartían la entrada de cache y el segundo podía ver
 * los datos del primero.
 *
 * T12 ya vacía la cache en cada cambio de sesión, así que esto es la segunda
 * barrera: aunque alguien agregue un camino que no pase por `logout()`, las
 * entradas de dos usuarios nunca colisionan porque tienen claves distintas.
 */
export function useQueryScope(): string {
  const { user } = useAuth();
  return user?.id ?? ANONYMOUS_SCOPE;
}
