// ===========================================
// Metrics Service — métricas de la encuesta
// ===========================================
//
// Lectura analítica sobre `SurveyResponse`. No escribe respuestas ni toca el
// cuestionario: eso es de `SurveyService`. Acá se proyectan las respuestas de
// un corte, se cruzan con las funciones puras de `metrics-aggregation.ts` y
// se cachean en Redis bajo la versión de la campaña, que sube con cada
// respuesta nueva (ver `SurveyService.subirVersion`).
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  SurveyCampaignStatus,
  SurveyQuestionKind,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../../common/cache';
import { CAPITAL, zonaDeLocalidad } from '../../common/constants';
import { finDelRango, inicioDelRango } from '../../common/dto/date-range';
import {
  claveVersionCampania,
  MINIMO_PARA_FRASES,
  UMBRAL_K_ANONIMATO,
} from '../survey/survey.constants';
import {
  aplicarSupresionComplementaria,
  aplicarUmbral,
  aplicarUmbralTabla,
  cruzarRespuestas,
  esDimensionValida,
  ETIQUETAS_DIMENSION,
  evaluarDestacado,
  evaluarKpi,
  granularidadPara,
  preguntaDeDimension,
  publicarKpi,
  rankingDestacado,
  serieTemporal,
  validarDefinicionDestacado,
  validarDefinicionKpi,
} from './metrics-aggregation';
import type {
  CreateSurveyHighlightDto,
  CreateSurveyKpiDto,
  MetricsCrossQueryDto,
  MetricsQueryDto,
  UpdateSurveyHighlightDto,
  UpdateSurveyKpiDto,
} from './dto';
import type {
  DefinicionDestacado,
  DefinicionKpi,
  DestacadoResultado,
  Dimension,
  KpiResultado,
  MapasDeNombres,
  MetricsCatalog,
  MetricsCross,
  MetricsFiltros,
  MetricsHighlights,
  MetricsKpis,
  MetricsOverview,
  OpcionCatalogo,
  PreguntaCatalogo,
  RespuestaProyectada,
} from './metrics.types';
import { DIMENSIONES_FIJAS } from './metrics.types';

/** Agregados cacheados dos minutos; la versión los invalida antes si entra algo. */
const TTL_AGREGADOS_SEGUNDOS = 120;

const SELECT_CUESTIONARIO = {
  id: true,
  titulo: true,
  anio: true,
  status: true,
  ventana: true,
  questions: {
    orderBy: { orden: 'asc' as const },
    select: {
      id: true,
      orden: true,
      texto: true,
      kind: true,
      audiencia: true,
      activa: true,
      options: {
        orderBy: { orden: 'asc' as const },
        select: { id: true, valor: true, texto: true, orden: true },
      },
    },
  },
} satisfies Prisma.SurveyCampaignSelect;

type CampaniaConCuestionario = Prisma.SurveyCampaignGetPayload<{
  select: typeof SELECT_CUESTIONARIO;
}>;

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: RedisCacheService,
  ) {}

  // ===========================================
  // Versión
  // ===========================================

  /**
   * Versión de la campaña: el contador de Redis o, si no hay Redis, el conteo
   * de respuestas (sube con cada envío, que es lo que importa para refrescar).
   */
  async version(campaignId: string): Promise<number> {
    const enCache = await this.cache?.getNumero(
      claveVersionCampania(campaignId),
    );
    if (enCache !== null && enCache !== undefined) return enCache;
    return this.prisma.surveyResponse.count({ where: { campaignId } });
  }

  // ===========================================
  // Catálogo
  // ===========================================

  async catalog(campaignId?: string): Promise<MetricsCatalog> {
    const [campanias, departamentos, disciplinas, categorias] =
      await Promise.all([
        this.prisma.surveyCampaign.findMany({
          select: {
            id: true,
            titulo: true,
            anio: true,
            status: true,
            ventana: true,
            _count: { select: { responses: true } },
          },
          orderBy: [{ anio: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.department.findMany({
          select: {
            id: true,
            name: true,
            localities: {
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.discipline.findMany({
          select: { id: true, name: true, type: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.findMany({
          select: { id: true, name: true, disciplineId: true },
          orderBy: { name: 'asc' },
        }),
      ]);

    // Sin campaña pedida: la activa; si no hay activa, la más reciente.
    const elegida =
      campanias.find((c) => c.id === campaignId) ??
      campanias.find((c) => c.status === SurveyCampaignStatus.ACTIVA) ??
      campanias[0] ??
      null;

    const preguntas = elegida ? await this.preguntasDe(elegida.id) : [];

    return {
      campanias: campanias.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        anio: c.anio,
        status: c.status,
        ventana: c.ventana,
        totalRespuestas: c._count.responses,
      })),
      campaniaId: elegida?.id ?? null,
      preguntas,
      dimensiones: DIMENSIONES_FIJAS.map((clave) => ({
        clave,
        etiqueta: ETIQUETAS_DIMENSION[clave],
      })),
      departamentos: departamentos.map((d) => ({
        id: d.id,
        nombre: d.name,
        localidades: d.localities.map((l) => ({
          id: l.id,
          nombre: l.name,
          zona: zonaDeLocalidad(l.name, d.name),
        })),
      })),
      disciplinas: disciplinas.map((d) => ({
        id: d.id,
        nombre: d.name,
        tipo: d.type,
      })),
      categorias: categorias.map((c) => ({
        id: c.id,
        nombre: c.name,
        disciplineId: c.disciplineId,
      })),
      umbral: UMBRAL_K_ANONIMATO,
    };
  }

  // ===========================================
  // Overview
  // ===========================================

  async overview(
    campaignId: string,
    query: MetricsQueryDto,
  ): Promise<MetricsOverview> {
    const campania = await this.findCampania(campaignId);
    const version = await this.version(campaignId);
    const clave = this.claveDeCache(campaignId, version, 'overview', query);
    const cacheado = await this.cache?.get<MetricsOverview>(clave);
    if (cacheado) return cacheado;

    const where = this.construirWhere(campaignId, query);
    const respuestas = await this.prisma.surveyResponse.findMany({
      where,
      select: { etapa: true, ventana: true, localityId: true, enviadaEn: true },
    });
    const mapas = await this.resolverNombres(
      respuestas.map((r) => r.localityId),
      [],
      [],
      [],
    );

    const porEtapaVentana = new Map<string, number>();
    const porZona = new Map<'CAPITAL' | 'INTERIOR', number>([
      ['CAPITAL', 0],
      ['INTERIOR', 0],
    ]);
    for (const r of respuestas) {
      const k = `${r.etapa}|${r.ventana}`;
      porEtapaVentana.set(k, (porEtapaVentana.get(k) ?? 0) + 1);
      const zona = r.localityId
        ? (mapas.localidades.get(r.localityId)?.zona ?? 'INTERIOR')
        : 'INTERIOR';
      porZona.set(zona, (porZona.get(zona) ?? 0) + 1);
    }

    const fechas = respuestas.map((r) => r.enviadaEn);
    const granularidad = granularidadPara(fechas);

    const resultado: MetricsOverview = {
      campaignId,
      titulo: campania.titulo,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: this.filtrosDe(query),
      totalRespuestas: respuestas.length,
      porEtapaVentana: [...porEtapaVentana.entries()].map(([k, conteo]) => {
        const [etapa, ventana] = k.split('|');
        return {
          etapa: etapa as MetricsOverview['porEtapaVentana'][number]['etapa'],
          ventana:
            ventana as MetricsOverview['porEtapaVentana'][number]['ventana'],
          ...aplicarUmbral(conteo),
        };
      }),
      porZona: [...porZona.entries()].map(([zona, conteo]) => ({
        zona,
        ...aplicarUmbral(conteo),
      })),
      serie: { granularidad, puntos: serieTemporal(fechas, granularidad) },
    };

    await this.cache?.setex(clave, TTL_AGREGADOS_SEGUNDOS, resultado);
    return resultado;
  }

  // ===========================================
  // Cruce
  // ===========================================

  async cross(
    campaignId: string,
    query: MetricsCrossQueryDto,
  ): Promise<MetricsCross> {
    const campania = await this.findCampania(campaignId);
    const pregunta = campania.questions.find((q) => q.id === query.pregunta);
    if (!pregunta) {
      throw new NotFoundException('La pregunta no pertenece a esta campaña');
    }
    if (!esDimensionValida(query.por)) {
      throw new BadRequestException('Dimensión de cruce inválida');
    }
    const dimension: Dimension = query.por;
    const otraPregunta = preguntaDeDimension(dimension);
    if (otraPregunta) {
      if (otraPregunta === pregunta.id) {
        throw new BadRequestException(
          'Una pregunta no se puede cruzar consigo misma',
        );
      }
      if (!campania.questions.some((q) => q.id === otraPregunta)) {
        throw new NotFoundException(
          'La pregunta del cruce no pertenece a esta campaña',
        );
      }
    }

    const version = await this.version(campaignId);
    const clave = this.claveDeCache(campaignId, version, 'cross', query);
    const cacheado = await this.cache?.get<MetricsCross>(clave);
    if (cacheado) return cacheado;

    const where = this.construirWhere(campaignId, query);
    const respuestas = await this.proyectarRespuestas(where);
    const mapas = await this.resolverNombres(
      respuestas.map((r) => r.localityId),
      respuestas.map((r) => r.disciplineId),
      respuestas.map((r) => r.categoryId),
      campania.questions,
    );

    const columnas = pregunta.options.map(this.aOpcionCatalogo);
    const { filas, totalRespuestas } = cruzarRespuestas(
      respuestas,
      pregunta.id,
      columnas,
      dimension,
      mapas,
    );

    const resultado: MetricsCross = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: this.filtrosDe(query),
      pregunta: this.aPreguntaCatalogo(pregunta),
      dimension,
      etiquetaDimension: otraPregunta
        ? (campania.questions.find((q) => q.id === otraPregunta)?.texto ??
          dimension)
        : ETIQUETAS_DIMENSION[dimension as keyof typeof ETIQUETAS_DIMENSION],
      columnas,
      // En opción única cada fila suma su total, que puede saberse por otro
      // lado (el resumen por zona, el total de respuestas): una sola celda
      // oculta se despejaría restando.
      filas: aplicarUmbralTabla(
        pregunta.kind === SurveyQuestionKind.UNICA
          ? aplicarSupresionComplementaria(filas)
          : filas,
      ),
      totalRespuestas,
    };

    await this.cache?.setex(clave, TTL_AGREGADOS_SEGUNDOS, resultado);
    return resultado;
  }

  // ===========================================
  // KPIs
  // ===========================================

  async kpis(campaignId: string, query: MetricsQueryDto): Promise<MetricsKpis> {
    const campania = await this.findCampania(campaignId);
    const version = await this.version(campaignId);
    const clave = this.claveDeCache(campaignId, version, 'kpis', query);
    const cacheado = await this.cache?.get<MetricsKpis>(clave);
    if (cacheado) return cacheado;

    const definiciones = await this.prisma.surveyKpi.findMany({
      where: {
        activo: true,
        OR: [{ campaignId }, { campaignId: null }],
      },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });

    const where = this.construirWhere(campaignId, query);
    const respuestas = await this.proyectarRespuestas(where);

    const valorDeOpcion = new Map<string, string>();
    const preguntaDeValor = new Map<string, string>();
    for (const q of campania.questions) {
      for (const o of q.options) {
        valorDeOpcion.set(o.id, o.valor);
        preguntaDeValor.set(o.valor, q.id);
      }
    }

    const kpis: KpiResultado[] = definiciones.map((k) => {
      const def = k.definicion as unknown as DefinicionKpi;
      const { numerador, denominador } = evaluarKpi(
        respuestas,
        def,
        valorDeOpcion,
        preguntaDeValor,
      );
      return {
        id: k.id,
        nombre: k.nombre,
        descripcion: k.descripcion,
        orden: k.orden,
        formato: def.formato,
        ...publicarKpi(numerador, denominador, def.formato),
      };
    });

    const resultado: MetricsKpis = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: this.filtrosDe(query),
      kpis,
    };

    await this.cache?.setex(clave, TTL_AGREGADOS_SEGUNDOS, resultado);
    return resultado;
  }

  // ===========================================
  // Destacados
  // ===========================================

  async highlights(
    campaignId: string,
    query: MetricsQueryDto,
  ): Promise<MetricsHighlights> {
    const campania = await this.findCampania(campaignId);
    const version = await this.version(campaignId);
    const clave = this.claveDeCache(campaignId, version, 'highlights', query);
    const cacheado = await this.cache?.get<MetricsHighlights>(clave);
    if (cacheado) return cacheado;

    const definiciones = await this.prisma.surveyHighlight.findMany({
      where: {
        activo: true,
        OR: [{ campaignId }, { campaignId: null }],
      },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });

    const where = this.construirWhere(campaignId, query);
    const respuestas = await this.proyectarRespuestas(where);

    const valorDeOpcion = new Map<string, string>();
    const opcionDeValor = new Map<
      string,
      { texto: string; questionId: string; kind: SurveyQuestionKind }
    >();
    for (const q of campania.questions) {
      for (const o of q.options) {
        valorDeOpcion.set(o.id, o.valor);
        opcionDeValor.set(o.valor, {
          texto: o.texto,
          questionId: q.id,
          kind: q.kind,
        });
      }
    }

    // Un destacado reutilizable cuyas opciones no existen en esta campaña (otra
    // edición, otro cuestionario) no aparece: sin la pregunta no hay de dónde
    // afirmarlo. De los demás, sólo cuentan las opciones presentes.
    const aplicables = definiciones
      .map((h) => ({
        h,
        def: h.definicion as unknown as DefinicionDestacado,
      }))
      .map(({ h, def }) => ({
        h,
        def,
        presentes: def.opciones.filter((v) => opcionDeValor.has(v)),
      }))
      .filter(({ presentes }) => presentes.length > 0);

    const destacados: DestacadoResultado[] = aplicables.map(
      ({ h, def, presentes }) => {
        const { base, conteos } = evaluarDestacado(
          respuestas,
          { ...def, opciones: presentes },
          valorDeOpcion,
        );
        const preguntas = new Set(
          presentes.map((v) => opcionDeValor.get(v)!.questionId),
        );
        const unica =
          preguntas.size === 1 &&
          presentes.every(
            (v) => opcionDeValor.get(v)!.kind === SurveyQuestionKind.UNICA,
          );
        return {
          id: h.id,
          titulo: h.titulo,
          descripcion: h.descripcion,
          orden: h.orden,
          ...rankingDestacado(
            base,
            presentes.map((v) => ({
              valor: v,
              texto: opcionDeValor.get(v)!.texto,
              conteo: conteos.get(v) ?? 0,
            })),
            { top: def.top, unica },
          ),
        };
      },
    );

    const resultado: MetricsHighlights = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      minimoFrases: MINIMO_PARA_FRASES,
      filtros: this.filtrosDe(query),
      generadoEn: new Date().toISOString(),
      destacados,
    };

    await this.cache?.setex(clave, TTL_AGREGADOS_SEGUNDOS, resultado);
    return resultado;
  }

  async listHighlights(campaignId?: string) {
    return this.prisma.surveyHighlight.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : undefined,
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createHighlight(dto: CreateSurveyHighlightDto) {
    this.validarDestacado(dto.definicion);
    if (dto.campaignId) await this.findCampania(dto.campaignId);

    const creado = await this.prisma.surveyHighlight.create({
      data: {
        campaignId: dto.campaignId ?? null,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
        definicion: dto.definicion as Prisma.InputJsonValue,
      },
    });
    this.invalidar(creado.campaignId);
    return creado;
  }

  async updateHighlight(id: string, dto: UpdateSurveyHighlightDto) {
    const actual = await this.prisma.surveyHighlight.findUnique({
      where: { id },
    });
    if (!actual) throw new NotFoundException('Destacado no encontrado');
    if (dto.definicion) this.validarDestacado(dto.definicion);
    if (dto.campaignId) await this.findCampania(dto.campaignId);

    const actualizado = await this.prisma.surveyHighlight.update({
      where: { id },
      data: {
        campaignId: dto.campaignId === undefined ? undefined : dto.campaignId,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        orden: dto.orden,
        activo: dto.activo,
        definicion: dto.definicion as Prisma.InputJsonValue | undefined,
      },
    });
    this.invalidar(actual.campaignId);
    this.invalidar(actualizado.campaignId);
    return actualizado;
  }

  async removeHighlight(id: string) {
    const actual = await this.prisma.surveyHighlight.findUnique({
      where: { id },
    });
    if (!actual) throw new NotFoundException('Destacado no encontrado');
    const borrado = await this.prisma.surveyHighlight.delete({
      where: { id },
    });
    this.invalidar(actual.campaignId);
    return borrado;
  }

  // ===========================================
  // ABM de KPIs
  // ===========================================

  async listKpis(campaignId?: string) {
    return this.prisma.surveyKpi.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : undefined,
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createKpi(dto: CreateSurveyKpiDto) {
    this.validarDefinicion(dto.definicion);
    if (dto.campaignId) await this.findCampania(dto.campaignId);

    const creado = await this.prisma.surveyKpi.create({
      data: {
        campaignId: dto.campaignId ?? null,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
        definicion: dto.definicion as Prisma.InputJsonValue,
      },
    });
    this.invalidar(creado.campaignId);
    return creado;
  }

  async updateKpi(id: string, dto: UpdateSurveyKpiDto) {
    const actual = await this.prisma.surveyKpi.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('KPI no encontrado');
    if (dto.definicion) this.validarDefinicion(dto.definicion);
    if (dto.campaignId) await this.findCampania(dto.campaignId);

    const actualizado = await this.prisma.surveyKpi.update({
      where: { id },
      data: {
        campaignId: dto.campaignId === undefined ? undefined : dto.campaignId,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        orden: dto.orden,
        activo: dto.activo,
        definicion: dto.definicion as Prisma.InputJsonValue | undefined,
      },
    });
    this.invalidar(actual.campaignId);
    this.invalidar(actualizado.campaignId);
    return actualizado;
  }

  async removeKpi(id: string) {
    const actual = await this.prisma.surveyKpi.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('KPI no encontrado');
    const borrado = await this.prisma.surveyKpi.delete({ where: { id } });
    this.invalidar(actual.campaignId);
    return borrado;
  }

  // ===========================================
  // Helpers
  // ===========================================

  private validarDefinicion(definicion: unknown): void {
    const error = validarDefinicionKpi(definicion);
    if (error) throw new BadRequestException(`Definición inválida: ${error}`);
  }

  private validarDestacado(definicion: unknown): void {
    const error = validarDefinicionDestacado(definicion);
    if (error) throw new BadRequestException(`Definición inválida: ${error}`);
  }

  /**
   * Un KPI reutilizable (sin campaña) afecta a todas: sin una lista de
   * campañas a mano, se sube la versión de la pedida si la hay. El resto se
   * refresca al vencer el TTL de 2 minutos.
   */
  private invalidar(campaignId: string | null): void {
    if (campaignId) void this.cache?.incr(claveVersionCampania(campaignId));
  }

  private async findCampania(id: string): Promise<CampaniaConCuestionario> {
    const campania = await this.prisma.surveyCampaign.findUnique({
      where: { id },
      select: SELECT_CUESTIONARIO,
    });
    if (!campania) {
      throw new NotFoundException('Campaña de encuesta no encontrada');
    }
    return campania;
  }

  private async preguntasDe(campaignId: string): Promise<PreguntaCatalogo[]> {
    const campania = await this.findCampania(campaignId);
    return campania.questions.map((q) => this.aPreguntaCatalogo(q));
  }

  private aOpcionCatalogo = (o: {
    id: string;
    valor: string;
    texto: string;
    orden: number;
  }): OpcionCatalogo => ({
    optionId: o.id,
    valor: o.valor,
    texto: o.texto,
    orden: o.orden,
  });

  private aPreguntaCatalogo(
    q: CampaniaConCuestionario['questions'][number],
  ): PreguntaCatalogo {
    return {
      questionId: q.id,
      orden: q.orden,
      texto: q.texto,
      kind: q.kind,
      audiencia: q.audiencia,
      activa: q.activa,
      opciones: q.options.map(this.aOpcionCatalogo),
    };
  }

  private filtrosDe(query: MetricsQueryDto): MetricsFiltros {
    return {
      etapa: query.etapa,
      ventana: query.ventana,
      disciplineId: query.disciplineId,
      disciplineType: query.disciplineType,
      localityId: query.localityId,
      departmentId: query.departmentId,
      zona: query.zona,
      categoryId: query.categoryId,
      sexo: query.sexo,
      desde: query.desde,
      hasta: query.hasta,
    };
  }

  /** Mismo recorte que `SurveyService.buildResponseWhere`. */
  private construirWhere(
    campaignId: string,
    query: MetricsQueryDto,
  ): Prisma.SurveyResponseWhereInput {
    const where: Prisma.SurveyResponseWhereInput = { campaignId };

    if (query.etapa) where.etapa = query.etapa;
    if (query.ventana) where.ventana = query.ventana;
    if (query.disciplineId) where.disciplineId = query.disciplineId;
    if (query.disciplineType) where.disciplineType = query.disciplineType;
    if (query.localityId) where.localityId = query.localityId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.sexo) where.sexo = query.sexo;

    if (query.departmentId) {
      where.locality = { departmentId: query.departmentId };
    }
    const capital: Prisma.LocalityWhereInput = {
      name: { equals: CAPITAL.localidad, mode: 'insensitive' },
      department: {
        name: { equals: CAPITAL.departamento, mode: 'insensitive' },
      },
    };
    if (query.zona === 'CAPITAL') {
      // Departamento y zona pueden venir juntos: se combinan con AND en vez
      // de mezclar campos en un mismo filtro de relación.
      where.locality = where.locality
        ? { AND: [where.locality, capital] }
        : capital;
    } else if (query.zona === 'INTERIOR') {
      where.NOT = { locality: capital };
    }

    if (query.desde || query.hasta) {
      where.enviadaEn = {};
      if (query.desde) where.enviadaEn.gte = inicioDelRango(query.desde);
      if (query.hasta) where.enviadaEn.lte = finDelRango(query.hasta);
    }

    return where;
  }

  /**
   * Proyecta las respuestas del corte con lo justo para cruzar. Nunca trae
   * nada que la tabla no guarde ya; y la tabla no guarda a nadie.
   */
  private async proyectarRespuestas(
    where: Prisma.SurveyResponseWhereInput,
  ): Promise<RespuestaProyectada[]> {
    const filas = await this.prisma.surveyResponse.findMany({
      where,
      select: {
        id: true,
        etapa: true,
        ventana: true,
        sexo: true,
        disciplineType: true,
        disciplineId: true,
        categoryId: true,
        localityId: true,
        enviadaEn: true,
        answers: { select: { questionId: true, optionId: true } },
      },
    });

    return filas.map((r) => {
      const opciones = new Map<string, string[]>();
      for (const a of r.answers) {
        const lista = opciones.get(a.questionId);
        if (lista) lista.push(a.optionId);
        else opciones.set(a.questionId, [a.optionId]);
      }
      return {
        responseId: r.id,
        etapa: r.etapa,
        ventana: r.ventana,
        sexo: r.sexo,
        disciplineType: r.disciplineType,
        disciplineId: r.disciplineId,
        categoryId: r.categoryId,
        localityId: r.localityId,
        enviadaEn: r.enviadaEn,
        opciones,
      };
    });
  }

  private async resolverNombres(
    localityIds: (string | null)[],
    disciplineIds: (string | null)[],
    categoryIds: (string | null)[],
    preguntas: CampaniaConCuestionario['questions'],
  ): Promise<MapasDeNombres> {
    const unicos = (ids: (string | null)[]) => [
      ...new Set(ids.filter((x): x is string => Boolean(x))),
    ];
    const localidades = unicos(localityIds);
    const disciplinas = unicos(disciplineIds);
    const categorias = unicos(categoryIds);

    const [filasLoc, filasDis, filasCat] = await Promise.all([
      localidades.length
        ? this.prisma.locality.findMany({
            where: { id: { in: localidades } },
            select: {
              id: true,
              name: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      disciplinas.length
        ? this.prisma.discipline.findMany({
            where: { id: { in: disciplinas } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      categorias.length
        ? this.prisma.category.findMany({
            where: { id: { in: categorias } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      localidades: new Map(
        filasLoc.map((l) => [
          l.id,
          {
            nombre: l.name,
            departmentId: l.departmentId,
            zona: zonaDeLocalidad(l.name, l.department.name),
          },
        ]),
      ),
      departamentos: new Map(
        filasLoc.map((l) => [l.departmentId, l.department.name]),
      ),
      disciplinas: new Map(filasDis.map((d) => [d.id, d.name])),
      categorias: new Map(filasCat.map((c) => [c.id, c.name])),
      preguntas: new Map(
        preguntas.map((q) => [q.id, q.options.map(this.aOpcionCatalogo)]),
      ),
    };
  }

  /** `metrics:survey:{id}:v{version}:{endpoint}:{sha1(query canónica)}`. */
  private claveDeCache(
    campaignId: string,
    version: number,
    endpoint: string,
    query: object,
  ): string {
    const canonico = JSON.stringify(
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const huella = createHash('sha1')
      .update(canonico)
      .digest('hex')
      .slice(0, 16);
    return `metrics:survey:${campaignId}:v${version}:${endpoint}:${huella}`;
  }
}
