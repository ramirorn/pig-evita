// ===========================================
// Cache Module — Redis opcional, global
// ===========================================
import { Global, Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';

/**
 * Global como `ScopeModule`: el cache lo necesita cualquier módulo de
 * lectura agregada (métricas, y a futuro dashboard y stats). Un único cliente
 * evita que cada servicio abra su propia conexión a Redis.
 */
@Global()
@Module({
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class CacheModule {}
