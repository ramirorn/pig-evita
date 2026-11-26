// ===========================================
// Providers del módulo de métricas
// ===========================================
//
// Lista única para el módulo y para los specs que arman el controller a mano.
// `SurveyVersionCache` lo provee `SurveyModule`; los specs lo suman aparte.
import { MetricsHighlightsService } from './metrics-highlights.service';
import { MetricsKpisService } from './metrics-kpis.service';
import { MetricsQueryService } from './metrics-query.service';

export const METRICS_PROVIDERS = [
  MetricsQueryService,
  MetricsKpisService,
  MetricsHighlightsService,
];
