// ===========================================
// clipboard — copiado al portapapeles con resultado verificable
// ===========================================
import { logError } from './logger';

/**
 * Copia `texto` al portapapeles y avisa **si de verdad se copió**.
 *
 * `navigator.clipboard.writeText()` devuelve una promesa que rechaza en más
 * escenarios de los que parece:
 *
 * - el documento no está en un contexto seguro (una demo servida por `http://`
 *   contra una IP de la red interna, que es exactamente como se muestra esto
 *   en la práctica): ahí `navigator.clipboard` directamente **no existe**;
 * - el permiso de escritura está denegado;
 * - el documento no tiene foco en el momento de la llamada.
 *
 * Llamarla sin `await` y cantar victoria con un `toast.success()` produce dos
 * problemas a la vez: una unhandled rejection en la consola y —peor— un cartel
 * verde que le dice al participante que su código de inscripción está en el
 * portapapeles cuando quedó vacío. Después lo pega en WhatsApp y manda
 * cualquier cosa.
 *
 * @returns `true` sólo si el texto quedó efectivamente en el portapapeles.
 */
export async function copiarAlPortapapeles(texto: string, contexto: string): Promise<boolean> {
  // Sin contexto seguro el navegador no expone `navigator.clipboard`: hay que
  // preguntar por la API antes de invocarla, no sólo atrapar el rechazo.
  if (!navigator.clipboard?.writeText) {
    logError(contexto, new Error('El navegador no expone la API de portapapeles (contexto inseguro)'));
    return false;
  }

  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (error) {
    logError(contexto, error);
    return false;
  }
}

/**
 * Mensaje de error accionable para cuando el copiado falla.
 *
 * Le dice al usuario qué hacer en vez de informarle una falla técnica: el texto
 * sigue en pantalla y se puede seleccionar a mano.
 */
export const MENSAJE_COPIA_FALLIDA =
  'No pudimos copiar al portapapeles. Seleccioná el texto y copialo a mano (Ctrl+C).';
