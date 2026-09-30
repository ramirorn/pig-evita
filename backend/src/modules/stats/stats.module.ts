// ===========================================
// Stats Module — estadísticas públicas agregadas
// ===========================================
import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

/**
 * Separado de `DashboardModule` a propósito: el dashboard es privado y recorta
 * por alcance territorial; esto es público y es igual para todos. Mezclarlos en
 * el mismo controller invitaba a que alguien le pusiera `@Public()` a un
 * endpoint con datos recortados, o el recorte a uno público.
 */
@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
