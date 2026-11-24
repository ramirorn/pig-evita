// ===========================================
// Almacenamiento del throttler en Redis (VULN-22)
// ===========================================
import { Injectable } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { RedisCacheService } from './redis-cache.service';

type ThrottlerRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Cuenta un pedido y, si pasa el límite, abre el bloqueo; todo en un solo paso
 * atómico. Devuelve `[hits, msHastaVencer, bloqueado (0|1), msHastaDesbloquear]`.
 *
 * Mientras el bloqueo está vigente no se cuentan pedidos, igual que el
 * almacenamiento en memoria de `@nestjs/throttler`.
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, math.max(redis.call('PTTL', KEYS[1]), 0), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}
`;

/**
 * VULN-22 — el límite de pedidos compartido entre instancias del backend.
 *
 * El almacenamiento por defecto de `@nestjs/throttler` vive en la memoria del
 * proceso: con dos réplicas cada una lleva su propia cuenta, y un reinicio la
 * pone en cero. Acá la cuenta vive en Redis, a través del `RedisCacheService`
 * compartido (sin otra conexión ni dependencias nuevas).
 *
 * Mismo contrato que el resto del cache: Redis es opcional. Si no está o falla,
 * se usa el almacenamiento en memoria; el límite se sigue aplicando, por
 * proceso, en vez de dejar de aplicarse.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly cache: RedisCacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const prefix = `throttle:${throttlerName}:${key}`;
    const result = await this.cache.evalNumbers(
      INCREMENT_SCRIPT,
      [`${prefix}:hits`, `${prefix}:block`],
      [ttl, limit, blockDuration],
    );

    if (!result) {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    const [totalHits, msToExpire, blocked, msToUnblock] = result;
    // En segundos y redondeado hacia arriba, como el almacenamiento en memoria:
    // es lo que va al header `Retry-After`.
    return {
      totalHits,
      timeToExpire: Math.ceil(msToExpire / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(msToUnblock / 1000),
    };
  }

  /** Corta los temporizadores del almacenamiento en memoria al apagar. */
  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
