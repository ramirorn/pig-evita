// ===========================================
// Metrics Module
// ===========================================
import { Module } from '@nestjs/common';
import { SurveyModule } from '../survey/survey.module';
import { MetricsController } from './metrics.controller';
import { METRICS_PROVIDERS } from './metrics.providers';
import { MetricsQueryService } from './metrics-query.service';

/**
 * Separado de `SurveyModule` a propósito: survey es el ciclo de vida del
 * cuestionario y el envío público; esto es lectura analítica. Importa
 * `SurveyModule` sólo por la caché por versión que comparten.
 */
@Module({
  imports: [SurveyModule],
  controllers: [MetricsController],
  providers: [...METRICS_PROVIDERS],
  exports: [MetricsQueryService],
})
export class MetricsModule {}
