// ===========================================
// @CacheControl — caché HTTP para endpoints casi estáticos
// ===========================================
import { SetMetadata } from '@nestjs/common';

export const CACHE_CONTROL_KEY = 'cacheControlMaxAge';

/** TTLs sugeridos, para no repetir números mágicos en los controllers. */
export const CACHE_TTL = {
  /** Catálogos que cambian una vez por temporada. */
  CATALOG: 600, // 10 min
  /** Contenido editorial: puede actualizarse durante el día. */
  CONTENT: 300, // 5 min
} as const;

/**
 * Marca un endpoint como cacheable por el navegador y por proxies intermedios.
 *
 * ⚠️ Usar **sólo** en endpoints `@Public()` de lectura cuya respuesta sea igual
 * para todo el mundo (catálogos, noticias). El interceptor que la aplica ignora
 * cualquier request autenticada como red de seguridad, pero la responsabilidad
 * de no marcar datos por usuario es de quien pone el decorador: un
 * `Cache-Control: public` sobre una respuesta personalizada permitiría que un
 * proxy compartido la sirviera a otra persona.
 *
 * @param maxAgeSeconds Segundos de frescura. Ver `CACHE_TTL`.
 * @example @CacheControl(CACHE_TTL.CATALOG)
 */
export const CacheControl = (maxAgeSeconds: number) =>
  SetMetadata(CACHE_CONTROL_KEY, maxAgeSeconds);
