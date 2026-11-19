// ===========================================
// Métricas — formas de respuesta y definiciones
// ===========================================
//
// Como `survey.types.ts`: este archivo es el contrato que el frontend replica
// en `frontend/src/types/`. Todo lo que sale de `/metrics` pasa por acá,
// incluido el sobre de supresión (`Corte`), para que ningún corte con menos
// de `UMBRAL_K_ANONIMATO` respuestas se publique con un conteo adentro.
import {
  CompetitionStage,
  DisciplineType,
  Sex,
  SurveyAudience,
  SurveyQuestionKind,
  SurveyWindow,
} from '@prisma/client';
import type { Corte } from '../survey/survey.types';
import type { Zona } from '../../common/constants';

export type { Corte } from '../survey/survey.types';

// ===========================================
// Dimensiones (ejes de cruce)
// ===========================================

/**
 * Ejes fijos por los que se puede desglosar una pregunta. Además, cualquier
 * otra pregunta de la campaña es un eje válido con la forma `pregunta:<id>`.
 */
export const DIMENSIONES_FIJAS = [
  'etapa',
  'ventana',
  'sexo',
  'disciplineType',
  'disciplina',
  'categoria',
  'localidad',
  'departamento',
  'zona',
] as const;

export type DimensionFija = (typeof DIMENSIONES_FIJAS)[number];

/** `pregunta:<uuid>` — cruzar contra otra pregunta de la misma campaña. */
export type DimensionPregunta = `pregunta:${string}`;

export type Dimension = DimensionFija | DimensionPregunta;

/** Granularidad de la serie temporal. */
export type Granularidad = 'dia' | 'hora';

// ===========================================
// Filtros
// ===========================================

export interface MetricsFiltros {
  etapa?: CompetitionStage;
  ventana?: SurveyWindow;
  disciplineId?: string;
  disciplineType?: DisciplineType;
  localityId?: string;
  departmentId?: string;
  zona?: Zona;
  categoryId?: string;
  sexo?: Sex;
  desde?: string;
  hasta?: string;
}

// ===========================================
// Respuesta "cruda" que agregan las funciones puras
// ===========================================

/**
 * Una respuesta ya proyectada con lo justo para cruzar: sus cortes y las
 * opciones elegidas por pregunta. Es lo que el service le pasa a las funciones
 * puras; nunca lleva nada que identifique a la persona.
 */
export interface RespuestaProyectada {
  responseId: string;
  etapa: CompetitionStage;
  ventana: SurveyWindow;
  sexo: Sex | null;
  disciplineType: DisciplineType;
  disciplineId: string | null;
  categoryId: string | null;
  localityId: string | null;
  enviadaEn: Date;
  /** questionId → optionIds elegidos (varios en preguntas MULTIPLE). */
  opciones: Map<string, string[]>;
}

/** Nombres para pintar los ejes; el service los resuelve una sola vez. */
export interface MapasDeNombres {
  disciplinas: Map<string, string>;
  categorias: Map<string, string>;
  localidades: Map<
    string,
    { nombre: string; departmentId: string; zona: Zona }
  >;
  departamentos: Map<string, string>;
  /** questionId → opciones ordenadas, para las dimensiones `pregunta:<id>`. */
  preguntas: Map<string, OpcionCatalogo[]>;
}

// ===========================================
// Catálogo (lo que necesita el constructor de gráficos)
// ===========================================

export interface OpcionCatalogo {
  optionId: string;
  valor: string;
  texto: string;
  orden: number;
}

export interface PreguntaCatalogo {
  questionId: string;
  orden: number;
  texto: string;
  kind: SurveyQuestionKind;
  audiencia: SurveyAudience;
  activa: boolean;
  opciones: OpcionCatalogo[];
}

export interface CampaniaCatalogo {
  id: string;
  titulo: string;
  anio: number;
  status: string;
  ventana: SurveyWindow;
  totalRespuestas: number;
}

export interface MetricsCatalog {
  campanias: CampaniaCatalogo[];
  /** Campaña elegida (o la activa por defecto); `null` si no hay ninguna. */
  campaniaId: string | null;
  preguntas: PreguntaCatalogo[];
  dimensiones: { clave: DimensionFija; etiqueta: string }[];
  departamentos: {
    id: string;
    nombre: string;
    localidades: { id: string; nombre: string; zona: Zona }[];
  }[];
  disciplinas: { id: string; nombre: string; tipo: DisciplineType }[];
  categorias: { id: string; nombre: string; disciplineId: string }[];
  umbral: number;
}

// ===========================================
// Overview
// ===========================================

export type CorteEtapaVentana = {
  etapa: CompetitionStage;
  ventana: SurveyWindow;
} & Corte;

export type PuntoSerie = { fecha: string } & Corte;

export interface MetricsOverview {
  campaignId: string;
  titulo: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  /** Total del corte, con el mismo umbral que cualquier otra cifra. */
  totalRespuestas: Corte;
  porEtapaVentana: CorteEtapaVentana[];
  porZona: ({ zona: Zona } & Corte)[];
  serie: { granularidad: Granularidad; puntos: PuntoSerie[] };
}

// ===========================================
// Cruce (tabla cruzada)
// ===========================================

export type CeldaCruce = {
  optionId: string;
  valor: string;
  texto: string;
} & Corte;

export interface FilaCruce {
  /** Valor de la dimensión (id, enum o `null` para "sin dato"). */
  clave: string | null;
  etiqueta: string;
  celdas: CeldaCruce[];
  totalFila: Corte;
}

export interface MetricsCross {
  campaignId: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  pregunta: PreguntaCatalogo;
  dimension: Dimension;
  etiquetaDimension: string;
  columnas: OpcionCatalogo[];
  filas: FilaCruce[];
  totalRespuestas: Corte;
}

// ===========================================
// KPIs
// ===========================================

/** Una condición: la respuesta eligió alguna opción cuyo `valor` está en la lista. */
export interface CondicionKpi {
  valores: string[];
}

export type DenominadorKpi = 'todas' | 'contestaron' | CondicionKpi[];

export interface DefinicionKpi {
  /** AND de condiciones. */
  numerador: CondicionKpi[];
  /**
   * `todas`: todas las respuestas del corte. `contestaron`: las que eligieron
   * alguna opción de las preguntas que aparecen en el numerador. Lista: AND de
   * condiciones, como el numerador.
   */
  denominador: DenominadorKpi;
  formato: 'porcentaje' | 'conteo';
}

export interface KpiResultado {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  formato: DefinicionKpi['formato'];
  numerador: Corte;
  denominador: Corte;
  /** Porcentaje a 1 decimal; `null` si algún lado está suprimido o el denominador es 0. */
  valor: number | null;
}

export interface MetricsKpis {
  campaignId: string;
  version: number;
  umbral: number;
  filtros: MetricsFiltros;
  kpis: KpiResultado[];
}

// ===========================================
// Destacados
// ===========================================

/**
 * Ranking de opciones definido por el panel ("Lo que más necesitan los
 * deportistas es:"). Como los KPIs, se refiere a opciones por su `valor`, así
 * sobrevive a que cada edición reescriba las preguntas.
 */
export interface DefinicionDestacado {
  opciones: string[];
  /** Cuántas opciones muestra el ranking (1 a 10). */
  top: number;
}

export interface OpcionDestacada {
  valor: string;
  texto: string;
  conteo: number;
  /** Sobre la base, a 1 decimal. En MULTIPLE los porcentajes suman más de 100. */
  porcentaje: number;
}

export interface DestacadoResultado {
  id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
  /** Quienes eligieron alguna de las opciones del destacado. */
  base: Corte;
  /** Ranking publicable, de mayor a menor; nunca incluye un "resto". */
  opciones: OpcionDestacada[];
  /** Opciones que no se muestran para no identificar a nadie. */
  ocultas: number;
  /** La base alcanza `MINIMO_PARA_FRASES`: el panel puede escribir frases. */
  puedeAfirmar: boolean;
}

export interface MetricsHighlights {
  campaignId: string;
  version: number;
  umbral: number;
  minimoFrases: number;
  filtros: MetricsFiltros;
  /** Momento del cálculo (ISO), para el "datos al …" del panel. */
  generadoEn: string;
  destacados: DestacadoResultado[];
}
