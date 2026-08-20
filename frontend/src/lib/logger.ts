// ===========================================
// Logger — única puerta de salida hacia la consola del navegador
// ===========================================

/**
 * Registra un error en la consola **solamente durante el desarrollo**.
 *
 * ¿Por qué existe este helper en vez de llamar a `console.error` directo?
 * Un error crudo de Axios que llega a la consola de producción expone la
 * estructura interna de la API (URL completa del endpoint, headers, payload
 * enviado y, según el caso, el mensaje de error del backend con detalles de
 * Prisma o SQL). Cualquiera que abra las DevTools —incluido un atacante
 * mapeando la superficie del sistema— lo lee sin esfuerzo. Además, los stack
 * traces revelan la ruta de los módulos del código fuente.
 *
 * Al centralizar el guard `import.meta.env.DEV` acá, queda una sola aparición
 * de `console.error` en todo `src/`, y no depende de que cada `catch` se
 * acuerde de envolverla.
 *
 * Este helper **no notifica al usuario**: la notificación visible es
 * responsabilidad del `onError` del hook de React Query o de un `toast.error`
 * explícito en el llamador. Acá sólo se deja rastro para el desarrollador.
 *
 * @param context Etiqueta corta que identifica dónde se originó el error
 *                (ej. `'CategoriesAdminPage.handleDeleteConfirm'`).
 * @param error   El error capturado, tal cual viene del `catch`.
 */
export function logError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    // Único `console.*` permitido en todo `src/`: vive detrás del guard de DEV.
    console.error(`[${context}]`, error);
  }
}
