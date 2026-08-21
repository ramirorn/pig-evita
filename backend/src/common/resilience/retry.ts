// ===========================================
// Retry con backoff exponencial acotado
// ===========================================

/** Opciones de `retryAsync`. */
export interface RetryOptions {
  /**
   * Intentos TOTALES (el primero incluido). `maxAttempts: 3` = 1 intento + 2
   * reintentos. Se cuenta así, y no como "3 reintentos", porque lo que hay que
   * poder acotar es la latencia que ve el usuario, no las veces que insistimos.
   */
  maxAttempts: number;
  /** Espera antes del primer reintento, en ms. Se duplica en cada vuelta. */
  baseDelayMs: number;
  /**
   * Tope duro de la espera entre intentos, en ms.
   *
   * Sin tope, el backoff exponencial sobre operaciones que ya son lentas deja
   * al usuario colgado varios segundos esperando un error que igual va a llegar.
   */
  maxDelayMs: number;
  /**
   * Decide si el error amerita otro intento. Sólo devuelve `true` para fallas
   * transitorias: reintentar un error permanente (credenciales mal, objeto
   * inexistente) no lo arregla, sólo agrega latencia a una falla segura.
   */
  shouldRetry: (error: unknown) => boolean;
  /** Se invoca antes de cada espera. Sirve para loguear el reintento. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/** Espera `ms` milisegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula la espera del reintento `attempt` (1 = primer reintento).
 *
 * Backoff exponencial acotado + jitter: si varias instancias de la API pierden
 * MinIO al mismo tiempo, sin jitter reintentarían todas en el mismo instante y
 * volverían a tirarlo abajo apenas se recupera.
 */
export function computeBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const exponencial = baseDelayMs * 2 ** (attempt - 1);
  const acotado = Math.min(exponencial, maxDelayMs);
  return Math.round(acotado * (1 + random() * 0.25));
}

/**
 * Ejecuta `operation` reintentando sólo los errores que `shouldRetry` marque
 * como transitorios. Si se agotan los intentos, propaga el último error tal
 * cual (el llamador sigue viendo el error original, no uno envuelto).
 *
 * `operation` recibe el número de intento por si necesita loguearlo. Ojo: la
 * operación tiene que ser segura de repetir — este helper no sabe nada de
 * idempotencia, es responsabilidad de quien lo usa.
 */
export async function retryAsync<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry, onRetry } =
    options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const quedanIntentos = attempt < maxAttempts;
      if (!quedanIntentos || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  // Inalcanzable: el loop siempre retorna o tira. Está por exhaustividad de TS.
  throw lastError;
}
