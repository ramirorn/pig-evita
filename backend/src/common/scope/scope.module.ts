// ===========================================
// Scope Module (R05)
// ===========================================
import { Global, Module } from '@nestjs/common';
import { ScopeService } from './scope.service';

/**
 * Global igual que `DatabaseModule`: el alcance territorial lo consumen cinco
 * módulos y va a consumirlo cualquiera que sume un listado de participantes o
 * equipos. Repetir el import en cada módulo sólo agrega una forma de olvidarse.
 */
@Global()
@Module({
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
