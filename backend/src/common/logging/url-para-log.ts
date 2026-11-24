// ===========================================
// URL para el log (VULN-25)
// ===========================================
/**
 * Parámetros de la query que se loguean con su valor: paginación, orden y
 * filtros de catálogo. Cualquier otro (`search`, `dni`, `email`…) puede traer
 * datos personales y se reemplaza por `[REDACTADO]` (VULN-25).
 */
const PARAMS_LOGUEABLES = new Set([
  'page',
  'limit',
  'sortBy',
  'sortOrder',
  'status',
  'isActive',
  'isPublished',
  'etapa',
  'ventana',
  'zona',
  'role',
  'type',
]);

/** Segmentos del path cuyo siguiente segmento es un dato personal. */
const SEGMENTOS_SENSIBLES = new Set(['dni', 'qr']);

/**
 * URL tal como se escribe en el log de acceso: sin el valor de los parámetros
 * que no están en `PARAMS_LOGUEABLES` ni el DNI o el código QR del path. El
 * log de acceso no tiene el control de acceso de la base: un DNI de un menor
 * en `?search=` quedaba escrito en el archivo.
 */
export function urlParaLog(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const corte = url.indexOf('?');
  const path = corte === -1 ? url : url.slice(0, corte);
  const query = corte === -1 ? '' : url.slice(corte + 1);

  const segmentos = path.split('/');
  const pathLimpio = segmentos
    .map((seg, i) =>
      (i > 0 && SEGMENTOS_SENSIBLES.has(segmentos[i - 1].toLowerCase())) ||
      /^\d{7,9}$/.test(seg)
        ? '[REDACTADO]'
        : seg,
    )
    .join('/');

  if (!query) return pathLimpio;
  const queryLimpia = query
    .split('&')
    .map((par) => {
      const igual = par.indexOf('=');
      if (igual === -1) return par;
      const clave = par.slice(0, igual);
      return PARAMS_LOGUEABLES.has(clave) ? par : `${clave}=[REDACTADO]`;
    })
    .join('&');
  return `${pathLimpio}?${queryLimpia}`;
}
