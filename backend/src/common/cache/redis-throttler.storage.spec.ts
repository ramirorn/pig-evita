import { RedisCacheService } from './redis-cache.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

const TTL = 60_000;
const LIMIT = 5;
const BLOCK = 60_000;

/** `RedisCacheService` con el resultado del script que se le indique. */
function cacheQueDevuelve(resultado: number[] | null) {
  return {
    evalNumbers: jest.fn().mockResolvedValue(resultado),
  } as unknown as RedisCacheService & { evalNumbers: jest.Mock };
}

describe('RedisThrottlerStorage', () => {
  it('con Redis: traduce el resultado del script a segundos redondeando hacia arriba', async () => {
    const storage = new RedisThrottlerStorage(
      cacheQueDevuelve([3, 59_200, 0, 0]),
    );

    const r = await storage.increment('1.2.3.4', TTL, LIMIT, BLOCK, 'default');

    expect(r).toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('con Redis: informa el bloqueo y cuánto falta para que se levante', async () => {
    const storage = new RedisThrottlerStorage(
      cacheQueDevuelve([6, 40_000, 1, 59_999]),
    );

    const r = await storage.increment('1.2.3.4', TTL, LIMIT, BLOCK, 'default');

    expect(r.isBlocked).toBe(true);
    expect(r.timeToBlockExpire).toBe(60);
  });

  it('separa las claves por throttler e IP, y le pasa ttl, límite y bloqueo', async () => {
    const cache = cacheQueDevuelve([1, TTL, 0, 0]);
    const storage = new RedisThrottlerStorage(cache);

    await storage.increment('1.2.3.4', TTL, LIMIT, BLOCK, 'login');

    const [, keys, args] = cache.evalNumbers.mock.calls[0];
    expect(keys).toEqual([
      'throttle:login:1.2.3.4:hits',
      'throttle:login:1.2.3.4:block',
    ]);
    expect(args).toEqual([TTL, LIMIT, BLOCK]);
  });

  it('sin Redis: el límite se sigue aplicando en memoria', async () => {
    const storage = new RedisThrottlerStorage(cacheQueDevuelve(null));

    let ultimo;
    for (let i = 0; i < LIMIT + 1; i++) {
      ultimo = await storage.increment('1.2.3.4', TTL, LIMIT, BLOCK, 'default');
    }

    expect(ultimo).toMatchObject({ totalHits: LIMIT + 1, isBlocked: true });
    storage.onApplicationShutdown();
  });
});
