// ===========================================
// Metrics Module
// ===========================================
import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Separado de `SurveyModule` a propósito: survey es el ciclo de vida del
 * cuestionario y el envío público; esto es lectura analítica que mañana puede
 * cruzar otras fuentes (inscripciones, resultados) sin tocar la encuesta.
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
