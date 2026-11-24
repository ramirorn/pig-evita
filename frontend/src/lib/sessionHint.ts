// ===========================================
// sessionHint — "este navegador tuvo una sesión abierta" (F-26)
// ===========================================
//
// Al arrancar, la app pedía `POST /auth/refresh` en TODAS las visitas para
// recuperar la sesión desde la cookie httpOnly. Para un visitante anónimo del
// portal eso es un 401 garantizado en cada carga, que además ensucia la
// consola. JavaScript no puede leer la cookie httpOnly para saber si existe,
// así que se guarda una marca aparte.
//
// ⚠️ La marca **no es un secreto ni una credencial**: es un "1". No dice quién
// ni da acceso a nada; si alguien la falsifica, lo único que logra es que se
// intente un refresh que va a fallar. Los tokens nunca pasan por localStorage.
import { ROUTES } from '@/lib/constants';

const CLAVE = 'evita_sesion_previa';

export function marcarSesion(): void {
  try {
    localStorage.setItem(CLAVE, '1');
  } catch {
    // Storage inaccesible: sin marca, se cae a la regla por ruta.
  }
}

export function olvidarSesion(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}

function hayMarca(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

/**
 * ¿Vale la pena intentar recuperar la sesión al arrancar?
 *
 * Sí cuando hay marca, o cuando se abre una pantalla del panel (que exige
 * sesión de todos modos; ahí un 401 sólo lleva al login). El login en sí queda
 * afuera: un anónimo que entra a `/admin/login` no tiene nada que recuperar.
 */
export function convieneRestaurarSesion(pathname: string): boolean {
  if (hayMarca()) return true;
  if (pathname === ROUTES.LOGIN) return false;
  return pathname === ROUTES.ADMIN || pathname.startsWith(`${ROUTES.ADMIN}/`);
}
