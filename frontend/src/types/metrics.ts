// ===========================================
// Métricas de la encuesta
// ===========================================
import { Sex, DisciplineType, CompetitionStage } from './enums';
import { SurveyWindow, SurveyCampaignStatus, SurveyQuestionKind, SurveyAudience } from './survey';
import type { CorteEncuesta } from './survey';

// ==========================================
// Métricas de la encuesta
// ==========================================
//
// Réplica del contrato de `backend/src/modules/metrics/metrics.types.ts`. Todo
// corte usa el sobre `CorteEncuesta`: uno suprimido trae `conteo: null` y la
// pantalla tiene que decirlo, nunca pintarlo como cero.

export type ZonaTerritorial = 'CAPITAL' | 'INTERIOR';

export type MetricsDimensionFija =
  | 'etapa'
  | 'ventana'
  | 'sexo'
  | 'disciplineType'
  | 'disciplina'
  | 'categoria'
  | 'localidad'
  | 'departamento'
  | 'zona';

/** Eje del cruce: uno fijo o `pregunta:<questionId>`. */
export type MetricsDimension = MetricsDimensionFija | `pregunta:${string}`;

export interface MetricsFiltros {
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
  disciplineId?: string;
  disciplineType?: DisciplineType;
  localityId?: string;
  departmentId?: string;
  zona?: ZonaTerritorial;
  categoryId?: string;
  sexo?: Sex;
  desde?: string;
  hasta?: string;
}

export interface MetricsOpcion {
  optionId: string;
  valor: string;
  texto: string;
  orden: number;
}

export interface MetricsPregunta {
  questionId: string;
  orden: number;
  texto: string;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  activa: boolean;
  opciones: MetricsOpcion[];
}

export interface MetricsCatalog {
  campanias: {
    id: string;
    titulo: string;
    anio: number;
    status: SurveyCampaignStatus;
    ventana: SurveyWindow;
    totalRespuestas: number;
  }[];
  campaniaId: string | null;
  preguntas: MetricsPregunta[];
  dimensiones: { clave: MetricsDimensionFija; etiqueta: string }[];
  departamentos: {
    id: string;
    nombre: string;
    localidades: { id: string; nombre: string; zona: ZonaTerritorial }[];
  }[];
  disciplinas: { id: string; nombre: string; tipo: DisciplineType }[];
  categorias: { id: string; nombre: string; disciplineId: string }[];
  umbral: number;
}

export interface MetricsOverview {
  campaignId: string;
  titulo: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  totalRespuestas: CorteEncuesta;
  porEtapaVentana: ({ etapa: CompetitionStage; ventana: SurveyWindow } & CorteEncuesta)[];
  porZona: ({ zona: ZonaTerritorial } & CorteEncuesta)[];
  serie: { granularidad: 'dia' | 'hora'; puntos: ({ fecha: string } & CorteEncuesta)[] };
}

export type MetricsCelda = { optionId: string; valor: string; texto: string } & CorteEncuesta;

export interface MetricsFila {
  clave: string | null;
  etiqueta: string;
  celdas: MetricsCelda[];
  totalFila: CorteEncuesta;
}

export interface MetricsCross {
  campaignId: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  pregunta: MetricsPregunta;
  dimension: MetricsDimension;
  etiquetaDimension: string;
  columnas: MetricsOpcion[];
  filas: MetricsFila[];
  totalRespuestas: CorteEncuesta;
}

export interface KpiCondicion {
  valores: string[];
}

export interface KpiDefinicion {
  numerador: KpiCondicion[];
  denominador: 'todas' | 'contestaron' | KpiCondicion[];
  formato: 'porcentaje' | 'conteo';
}

export interface SurveyKpi {
  id: string;
  campaignId: string | null;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  definicion: KpiDefinicion;
  createdAt: string;
  updatedAt: string;
}

export interface KpiResultado {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  formato: KpiDefinicion['formato'];
  numerador: CorteEncuesta;
  denominador: CorteEncuesta;
  /** Porcentaje a 1 decimal, o conteo; `null` si no se puede publicar. */
  valor: number | null;
}

export interface MetricsKpis {
  campaignId: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  kpis: KpiResultado[];
}

/** Ranking de opciones del panel ("Lo que más necesitan los deportistas es:"). */
export interface DestacadoDefinicion {
  /** `valor` de las opciones que entran al ranking. */
  opciones: string[];
  /** Cuántas muestra (1 a 10). */
  top: number;
}

export interface SurveyHighlight {
  id: string;
  campaignId: string | null;
  titulo: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  definicion: DestacadoDefinicion;
  createdAt: string;
  updatedAt: string;
}

export interface OpcionDestacada {
  valor: string;
  texto: string;
  conteo: number;
  /** Sobre la base; en opción múltiple suman más de 100. */
  porcentaje: number;
}

export interface DestacadoResultado {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  base: CorteEncuesta;
  opciones: OpcionDestacada[];
  /** Opciones que no se muestran para no identificar a nadie. */
  ocultas: number;
  /** La base alcanza el mínimo para escribir frases en lenguaje simple. */
  puedeAfirmar: boolean;
}

export interface MetricsHighlights {
  campaignId: string;
  version: number;
  umbral: number;
  minimoFrases: number;
  filtros: MetricsFiltros;
  generadoEn: string;
  destacados: DestacadoResultado[];
}
