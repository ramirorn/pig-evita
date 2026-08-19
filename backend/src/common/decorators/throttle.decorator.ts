// ===========================================
// Rate limiting para endpoints públicos de lectura
// ===========================================
import { Throttle } from '@nestjs/throttler';

/**
 * Cupo por IP de los endpoints `@Public()` de lectura (hallazgo A-01).
 *
 * El límite global es de 100 req/min, pensado para una sesión de back-office
 * navegando. Los endpoints públicos son otra cosa: no requieren credenciales y
 * devuelven catálogos completos, así que son el blanco natural de un scraper
 * que quiera bajarse el padrón de disciplinas, sedes o competencias — o probar
 * códigos QR por fuerza bruta.
 *
 * 20 req/min alcanza de sobra para una persona navegando el sitio público
 * (React Query además cachea, ver T19) y corta cualquier barrido automatizado.
 */
export const PUBLIC_READ_RATE_LIMIT = { limit: 20, ttl: 60_000 } as const;

/**
 * Aplica el cupo público de lectura.
 *
 * ⚠️ No usar en `/health`: los chequeos de disponibilidad consultan cada pocos
 * segundos y quedarían bloqueados.
 *
 * @example
 * ＠Get()
 * ＠Public()
 * ＠PublicReadThrottle()
 */
export const PublicReadThrottle = () =>
  Throttle({ default: { ...PUBLIC_READ_RATE_LIMIT } });
