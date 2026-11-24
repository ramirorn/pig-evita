// ===========================================
// RedisCacheService — cache opcional compartido
// ===========================================
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Un único cliente de Redis para todos los módulos que cachean lecturas.
 *
 * Mismo contrato que `StatsService` y `DashboardService` ya aplicaban cada uno
 * por su cuenta: Redis es **opcional**. Si no está, si se cae a mitad de una
 * jornada o si una clave no se puede escribir, acá se devuelve `null` o se
 * ignora la escritura y el llamador calcula contra la base. Ninguna operación
 * lanza: un cache caído nunca justifica un 500 en un endpoint de lectura.
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private cliente: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      const host = this.configService.get<string>('redis.host', 'localhost');
      const port = this.configService.get<number>('redis.port', 6379);
      const password = this.configService.get<string>('redis.password');

      this.cliente = new Redis({ host, port, password, lazyConnect: true });
      this.cliente.on('error', (err) => {
        this.logger.warn(
          `Redis no disponible: ${err.message}. Las lecturas se calculan contra la base sin cache.`,
        );
      });
      // Conexión en background: el arranque no espera a Redis.
      this.cliente.connect().catch(() => {});
    } catch {
      this.logger.warn('No se pudo crear el cliente de Redis. Sin cache.');
    }
  }

  async onModuleDestroy() {
    if (this.cliente) {
      await this.cliente.quit().catch(() => {});
    }
  }

  /** `true` sólo cuando hay una conexión lista para usar. */
  get disponible(): boolean {
    return this.cliente?.status === 'ready';
  }

  /** Lee y deserializa; `null` si no hay cache, no existe la clave o falla. */
  async get<T>(clave: string): Promise<T | null> {
    if (!this.disponible) return null;
    try {
      const crudo = await this.cliente!.get(clave);
      return crudo ? (JSON.parse(crudo) as T) : null;
    } catch (e) {
      this.logger.error(`Error leyendo ${clave}: ${(e as Error).message}`);
      return null;
    }
  }

  /** Serializa y guarda con vencimiento. Una falla se registra y se ignora. */
  async setex(
    clave: string,
    ttlSegundos: number,
    valor: unknown,
  ): Promise<void> {
    if (!this.disponible) return;
    try {
      await this.cliente!.setex(clave, ttlSegundos, JSON.stringify(valor));
    } catch (e) {
      this.logger.error(`Error escribiendo ${clave}: ${(e as Error).message}`);
    }
  }

  /**
   * Incrementa un contador y devuelve el valor nuevo; `null` si no hay Redis.
   * Lo usa el versionado de métricas: cada respuesta nueva de la encuesta
   * sube la versión de su campaña y deja obsoletos los agregados cacheados.
   */
  async incr(clave: string): Promise<number | null> {
    if (!this.disponible) return null;
    try {
      return await this.cliente!.incr(clave);
    } catch (e) {
      this.logger.error(
        `Error incrementando ${clave}: ${(e as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Corre un script Lua que devuelve una lista de enteros; `null` si no hay
   * Redis o falla. Para operaciones que tienen que ser atómicas entre varias
   * claves, como el contador del throttler (`RedisThrottlerStorage`).
   */
  async evalNumbers(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<number[] | null> {
    if (!this.disponible) return null;
    try {
      const resultado = await this.cliente!.eval(
        script,
        keys.length,
        ...keys,
        ...args,
      );
      return Array.isArray(resultado) ? resultado.map(Number) : null;
    } catch (e) {
      this.logger.error(`Error en script de Redis: ${(e as Error).message}`);
      return null;
    }
  }

  /** Lee un contador numérico; `null` si no hay Redis o la clave no existe. */
  async getNumero(clave: string): Promise<number | null> {
    if (!this.disponible) return null;
    try {
      const crudo = await this.cliente!.get(clave);
      if (crudo === null) return null;
      const n = Number(crudo);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      this.logger.error(`Error leyendo ${clave}: ${(e as Error).message}`);
      return null;
    }
  }
}
