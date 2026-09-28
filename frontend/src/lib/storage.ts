// ===========================================
// storage — acceso crudo a `localStorage` que nunca tira
// ===========================================
//
// Lo comparten los borradores del plantel y de la encuesta. Las tres funciones
// **tragan la excepción**: en modo privado de iOS, con cookies de terceros
// bloqueadas o con el disco lleno, `localStorage` tira al leer y al escribir.
// Un formulario que se rompe por no poder guardar un borrador es peor que uno
// que no guarda borradores.
//
// Devuelven JSON sin validar: quien lee es responsable de pasarlo por su
// esquema de Zod, porque lo que hay en el storage puede ser de otra versión.
import { logError } from './logger';

export function leerCrudo(clave: string, contexto: string): unknown {
  try {
    const texto = localStorage.getItem(clave);
    if (!texto) return null;
    return JSON.parse(texto);
  } catch (error) {
    logError(`${contexto}.leerCrudo`, error);
    return null;
  }
}

export function escribirCrudo(clave: string, valor: unknown, contexto: string): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    logError(`${contexto}.escribirCrudo`, error);
    return false;
  }
}

export function borrarCrudo(clave: string, contexto: string): void {
  try {
    localStorage.removeItem(clave);
  } catch (error) {
    logError(`${contexto}.borrarCrudo`, error);
  }
}
