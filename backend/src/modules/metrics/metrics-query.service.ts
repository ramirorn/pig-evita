// ===========================================
// Métricas de la encuesta — lectura
// ===========================================
//
// Lectura analítica sobre `SurveyResponse`. No escribe respuestas ni toca el
// cuestionario (eso es de `SurveyService`) ni las definiciones de KPIs y
// destacados (`MetricsKpisService`, `MetricsHighlightsService`). Proyecta las
// respuestas de un corte, las cruza con las funciones puras de
// `metrics-aggregation.ts` y cachea el resultado bajo la versión de la campaña.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SurveyCampaignStatus, SurveyQuestionKind } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { zonaDeLocalidad } from '../../common/constants';
import { finDelRango, inicioDelRango } from '../../common/dto/date-range';
import { SurveyVersionCache } from '../survey/survey-version.cache';
import {
  MINIMO_PARA_FRASES,
  UMBRAL_K_ANONIMATO,
} from '../survey/survey.constants';
import {
  aplicarUmbral,
  aplicarUmbralTabla,
  cruzarRespuestas,
  diaDelFiltro,
  enTandas,
  esDimensionValida,
  ETIQUETAS_DIMENSION,
  evaluarDestacado,
  evaluarKpi,
  filaPublicable,
  filtrosActivos,
  granularidadPara,
  MAXIMO_FILTROS,
  preguntaDeDimension,
  protegerGrupo,
  publicarEnTandas,
  publicarKpi,
  rankingDestacado,
  serieTemporal,
} from './metrics-aggregation';
import {
  CampaignWithQuestionnaire,
  findCampaignWithQuestionnaire,
  toOptionCatalog,
  toQuestionCatalog,
} from './metrics-campaign';
import { appliedFilters, responseWhere } from './response-filter';
import type { MetricsCrossQueryDto, MetricsQueryDto } from './dto';
import type {
  DefinicionDestacado,
  DefinicionKpi,
  DestacadoResultado,
  Dimension,
  KpiResultado,
  MapasDeNombres,
  MetricsCatalog,
  MetricsCross,
  MetricsHighlights,
  MetricsKpis,
  MetricsOverview,
  RespuestaProyectada,
} from './metrics.types';
import { DIMENSIONES_FIJAS } from './metrics.types';

/** Columnas que necesita `isCoherentSlice` para comparar un corte con su padre. */
const SLICE_ROW_SELECT = {
  id: true,
  enviadaEn: true,
  etapa: true,
  ventana: true,
  sexo: true,
  disciplineType: true,
  disciplineId: true,
  categoryId: true,
  localityId: true,
} as const;

/**
 * Filas de los cortes padre ya leídas durante un mismo pedido. Con dos filtros,
 * el corte sin filtros se pedía dos veces (una por cada rama de la recursión).
 */
type SliceMemo = Map<string, Promise<SliceRow[]>>;

interface SliceRow {
  id: string;
  enviadaEn: Date;
  etapa: string;
  ventana: string;
  sexo: string | null;
  disciplineType: string;
  disciplineId: string | null;
  categoryId: string | null;
  localityId: string | null;
}

@Injectable()
export class MetricsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: SurveyVersionCache,
  ) {}

  /**
   * Versión publicada de la campaña (VULN-19): el contador de Redis, que sube
   * de a tandas de 5 respuestas o con cambios del cuestionario, KPIs o
   * destacados; sin Redis, el conteo **redondeado a la tanda**. Nunca dice
   * más que el total publicado.
   */
  async version(campaignId: string): Promise<number> {
    const cached = await this.versions.current(campaignId);
    if (cached !== null) return cached;
    return enTandas(
      await this.prisma.surveyResponse.count({ where: { campaignId } }),
    );
  }

  // ===========================================
  // Catálogo
  // ===========================================

  async catalog(campaignId?: string): Promise<MetricsCatalog> {
    const [campaigns, departments, disciplines, categories] = await Promise.all(
      [
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
      ],
    );

    // Sin campaña pedida: la activa; si no hay activa, la más reciente.
    const chosen =
      campaigns.find((c) => c.id === campaignId) ??
      campaigns.find((c) => c.status === SurveyCampaignStatus.ACTIVA) ??
      campaigns[0] ??
      null;

    const questions = chosen
      ? (
          await findCampaignWithQuestionnaire(this.prisma, chosen.id)
        ).questions.map(toQuestionCatalog)
      : [];

    return {
      campanias: campaigns.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        anio: c.anio,
        status: c.status,
        ventana: c.ventana,
        // De a k, como cada corte: si no, el catálogo delata cada envío.
        totalRespuestas: enTandas(c._count.responses),
      })),
      campaniaId: chosen?.id ?? null,
      preguntas: questions,
      dimensiones: DIMENSIONES_FIJAS.map((clave) => ({
        clave,
        etiqueta: ETIQUETAS_DIMENSION[clave],
      })),
      departamentos: departments.map((d) => ({
        id: d.id,
        nombre: d.name,
        localidades: d.localities.map((l) => ({
          id: l.id,
          nombre: l.name,
          zona: zonaDeLocalidad(l.name, d.name),
        })),
      })),
      disciplinas: disciplines.map((d) => ({
        id: d.id,
        nombre: d.name,
        tipo: d.type,
      })),
      categorias: categories.map((c) => ({
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
    // La caché va primero: un acierto no toca la base (sólo resultados ya
    // calculados, y por lo tanto válidos, quedan cacheados).
    const version = await this.version(campaignId);
    const key = this.versions.key(campaignId, version, 'overview', query);
    const cached = await this.versions.read<MetricsOverview>(key);
    if (cached) return cached;

    const campaign = await findCampaignWithQuestionnaire(
      this.prisma,
      campaignId,
    );
    const where = this.whereWithinLimit(campaignId, query);
    const coherent = await this.isCoherentSlice(campaignId, query, new Map());
    const responses = !coherent
      ? []
      : publicarEnTandas(
          await this.prisma.surveyResponse.findMany({
            where,
            select: {
              id: true,
              etapa: true,
              ventana: true,
              localityId: true,
              enviadaEn: true,
            },
          }),
          (r) => r.id,
        );
    const names = await this.resolveNames(
      responses.map((r) => r.localityId),
      [],
      [],
      [],
    );

    const byStageWindow = new Map<string, number>();
    const byZone = new Map<'CAPITAL' | 'INTERIOR', number>([
      ['CAPITAL', 0],
      ['INTERIOR', 0],
    ]);
    for (const r of responses) {
      const k = `${r.etapa}|${r.ventana}`;
      byStageWindow.set(k, (byStageWindow.get(k) ?? 0) + 1);
      const zone = r.localityId
        ? (names.localidades.get(r.localityId)?.zona ?? 'INTERIOR')
        : 'INTERIOR';
      byZone.set(zone, (byZone.get(zone) ?? 0) + 1);
    }

    const dates = responses.map((r) => r.enviadaEn);
    const granularity = granularidadPara(dates);

    const result: MetricsOverview = {
      campaignId,
      titulo: campaign.titulo,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: appliedFilters(query),
      totalRespuestas: aplicarUmbral(responses.length),
      // Las partes suman el total publicado: además del umbral, lo oculto
      // tiene que sumar 0 o al menos k (si no, total − visibles lo despeja).
      porEtapaVentana: (() => {
        const entries = [...byStageWindow.entries()];
        const cuts = protegerGrupo(
          entries.map(([, count]) => count),
          responses.length,
        );
        return entries.map(([k], i) => {
          const [etapa, ventana] = k.split('|');
          return {
            etapa: etapa as MetricsOverview['porEtapaVentana'][number]['etapa'],
            ventana:
              ventana as MetricsOverview['porEtapaVentana'][number]['ventana'],
            ...cuts[i]!,
          };
        });
      })(),
      porZona: (() => {
        const entries = [...byZone.entries()];
        const cuts = protegerGrupo(
          entries.map(([, count]) => count),
          responses.length,
        );
        return entries.map(([zona], i) => ({ zona, ...cuts[i]! }));
      })(),
      serie: {
        granularidad: granularity,
        puntos: serieTemporal(dates, granularity),
      },
    };

    await this.versions.write(key, result);
    return result;
  }

  // ===========================================
  // Cruce
  // ===========================================

  async cross(
    campaignId: string,
    query: MetricsCrossQueryDto,
  ): Promise<MetricsCross> {
    const version = await this.version(campaignId);
    const key = this.versions.key(campaignId, version, 'cross', query);
    const cached = await this.versions.read<MetricsCross>(key);
    if (cached) return cached;

    const campaign = await findCampaignWithQuestionnaire(
      this.prisma,
      campaignId,
    );
    const question = campaign.questions.find((q) => q.id === query.pregunta);
    if (!question) {
      throw new NotFoundException('La pregunta no pertenece a esta campaña');
    }
    if (!esDimensionValida(query.por)) {
      throw new BadRequestException('Dimensión de cruce inválida');
    }
    const dimension: Dimension = query.por;
    const otherQuestion = preguntaDeDimension(dimension);
    if (otherQuestion) {
      if (otherQuestion === question.id) {
        throw new BadRequestException(
          'Una pregunta no se puede cruzar consigo misma',
        );
      }
      if (!campaign.questions.some((q) => q.id === otherQuestion)) {
        throw new NotFoundException(
          'La pregunta del cruce no pertenece a esta campaña',
        );
      }
    }

    const responses = await this.sliceResponses(campaignId, query);
    const names = await this.resolveNames(
      responses.map((r) => r.localityId),
      responses.map((r) => r.disciplineId),
      responses.map((r) => r.categoryId),
      campaign.questions,
    );

    const columns = question.options.map(toOptionCatalog);
    // Opción única: las celdas de una fila suman su total. Partición: cada
    // respuesta cae en una sola fila (dimensión fija, u otra pregunta de
    // opción única con su fila "Sin dato").
    const single = question.kind === SurveyQuestionKind.UNICA;
    const partition =
      !otherQuestion ||
      campaign.questions.find((q) => q.id === otherQuestion)?.kind ===
        SurveyQuestionKind.UNICA;
    const { filas, totalRespuestas, totalOculto } = cruzarRespuestas(
      responses,
      question.id,
      columns,
      dimension,
      names,
      { unica: single, particion: partition },
    );

    const result: MetricsCross = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: appliedFilters(query),
      pregunta: toQuestionCatalog(question),
      dimension,
      etiquetaDimension: otherQuestion
        ? (campaign.questions.find((q) => q.id === otherQuestion)?.texto ??
          dimension)
        : ETIQUETAS_DIMENSION[dimension as keyof typeof ETIQUETAS_DIMENSION],
      columnas: columns,
      // En opción única cada fila suma su total, que puede saberse por otro
      // lado: una sola celda oculta se despejaría restando.
      filas: aplicarUmbralTabla(filas),
      totalRespuestas: totalOculto
        ? aplicarUmbral(0)
        : aplicarUmbral(totalRespuestas),
    };

    await this.versions.write(key, result);
    return result;
  }

  // ===========================================
  // KPIs
  // ===========================================

  async kpis(campaignId: string, query: MetricsQueryDto): Promise<MetricsKpis> {
    const version = await this.version(campaignId);
    const key = this.versions.key(campaignId, version, 'kpis', query);
    const cached = await this.versions.read<MetricsKpis>(key);
    if (cached) return cached;

    const campaign = await findCampaignWithQuestionnaire(
      this.prisma,
      campaignId,
    );
    const [definitions, responses] = await Promise.all([
      this.prisma.surveyKpi.findMany({
        where: { activo: true, OR: [{ campaignId }, { campaignId: null }] },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      }),
      this.sliceResponses(campaignId, query),
    ]);

    const valueOfOption = new Map<string, string>();
    const questionOfValue = new Map<string, string>();
    for (const q of campaign.questions) {
      for (const o of q.options) {
        valueOfOption.set(o.id, o.valor);
        questionOfValue.set(o.valor, q.id);
      }
    }

    const kpis: KpiResultado[] = definitions.map((k) => {
      const def = k.definicion as unknown as DefinicionKpi;
      const { numerador, denominador } = evaluarKpi(
        responses,
        def,
        valueOfOption,
        questionOfValue,
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

    const result: MetricsKpis = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      filtros: appliedFilters(query),
      kpis,
    };

    await this.versions.write(key, result);
    return result;
  }

  // ===========================================
  // Destacados
  // ===========================================

  async highlights(
    campaignId: string,
    query: MetricsQueryDto,
  ): Promise<MetricsHighlights> {
    const version = await this.version(campaignId);
    const key = this.versions.key(campaignId, version, 'highlights', query);
    const cached = await this.versions.read<MetricsHighlights>(key);
    if (cached) return cached;

    const campaign = await findCampaignWithQuestionnaire(
      this.prisma,
      campaignId,
    );
    const [definitions, responses] = await Promise.all([
      this.prisma.surveyHighlight.findMany({
        where: { activo: true, OR: [{ campaignId }, { campaignId: null }] },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      }),
      this.sliceResponses(campaignId, query),
    ]);

    const valueOfOption = new Map<string, string>();
    const optionOfValue = new Map<
      string,
      { texto: string; questionId: string; kind: SurveyQuestionKind }
    >();
    for (const q of campaign.questions) {
      for (const o of q.options) {
        valueOfOption.set(o.id, o.valor);
        optionOfValue.set(o.valor, {
          texto: o.texto,
          questionId: q.id,
          kind: q.kind,
        });
      }
    }

    // Un destacado reutilizable cuyas opciones no existen en esta campaña no
    // aparece: sin la pregunta no hay de dónde afirmarlo. De los demás, sólo
    // cuentan las opciones presentes.
    const applicable = definitions
      .map((h) => ({ h, def: h.definicion as unknown as DefinicionDestacado }))
      .map(({ h, def }) => ({
        h,
        def,
        present: def.opciones.filter((v) => optionOfValue.has(v)),
      }))
      .filter(({ present }) => present.length > 0);

    const highlights: DestacadoResultado[] = applicable.map(
      ({ h, def, present }) => {
        const { base, conteos } = evaluarDestacado(
          responses,
          { ...def, opciones: present },
          valueOfOption,
        );
        const questions = new Set(
          present.map((v) => optionOfValue.get(v)!.questionId),
        );
        const single =
          questions.size === 1 &&
          present.every(
            (v) => optionOfValue.get(v)!.kind === SurveyQuestionKind.UNICA,
          );
        return {
          id: h.id,
          titulo: h.titulo,
          descripcion: h.descripcion,
          orden: h.orden,
          ...rankingDestacado(
            base,
            present.map((v) => ({
              valor: v,
              texto: optionOfValue.get(v)!.texto,
              conteo: conteos.get(v) ?? 0,
            })),
            { top: def.top, unica: single },
          ),
        };
      },
    );

    const result: MetricsHighlights = {
      campaignId,
      version,
      umbral: UMBRAL_K_ANONIMATO,
      minimoFrases: MINIMO_PARA_FRASES,
      filtros: appliedFilters(query),
      generadoEn: new Date().toISOString(),
      destacados: highlights,
    };

    await this.versions.write(key, result);
    return result;
  }

  // ===========================================
  // Helpers
  // ===========================================

  /** El `where` del corte, con el tope de filtros que cuida el anonimato. */
  private whereWithinLimit(campaignId: string, query: MetricsQueryDto) {
    if (filtrosActivos(query).length > MAXIMO_FILTROS) {
      throw new BadRequestException(
        `Se pueden combinar hasta ${MAXIMO_FILTROS} filtros a la vez, para cuidar el anonimato`,
      );
    }
    return responseWhere(campaignId, query);
  }

  /**
   * Las respuestas publicables de un corte: vacío si el corte no es coherente
   * (ver `isCoherentSlice`), y si no, sus tandas completas.
   */
  private async sliceResponses(
    campaignId: string,
    query: MetricsQueryDto,
  ): Promise<RespuestaProyectada[]> {
    const where = this.whereWithinLimit(campaignId, query);
    if (!(await this.isCoherentSlice(campaignId, query, new Map()))) return [];
    return this.projectResponses(where);
  }

  /**
   * Un corte filtrado sólo se publica si, para cada filtro, su fila se
   * publicaría en el cruce del corte sin ese filtro por esa dimensión (las
   * fechas, como "dentro" y "fuera" del rango). Así, el total sin filtro menos
   * el filtrado no despeja una fila chica. El corte sin el filtro también tiene
   * que ser coherente: si no, un segundo filtro redundante destrababa un corte
   * bloqueado. Con el tope de 2 filtros la recursión baja dos niveles, y `memo`
   * evita leer dos veces el mismo corte padre.
   */
  private async isCoherentSlice(
    campaignId: string,
    query: MetricsQueryDto,
    memo: SliceMemo,
  ): Promise<boolean> {
    for (const filter of filtrosActivos(query)) {
      const parent: MetricsQueryDto = { ...query };
      if (filter === 'fecha') {
        delete parent.desde;
        delete parent.hasta;
      } else {
        delete parent[filter];
      }
      if (!(await this.isCoherentSlice(campaignId, parent, memo))) return false;

      const rows = publicarEnTandas(
        await this.sliceRows(campaignId, parent, memo),
        (r) => r.id,
      );

      const territorial = filter === 'zona' || filter === 'departmentId';
      const localities = territorial
        ? (
            await this.resolveNames(
              rows.map((r) => r.localityId),
              [],
              [],
              [],
            )
          ).localidades
        : new Map<
            string,
            { departmentId: string; zona: 'CAPITAL' | 'INTERIOR' }
          >();

      const from = query.desde
        ? inicioDelRango(diaDelFiltro(query.desde))
        : null;
      const to = query.hasta ? finDelRango(diaDelFiltro(query.hasta)) : null;
      const keyOf = (r: SliceRow): string | null => {
        switch (filter) {
          case 'fecha':
            return (!from || r.enviadaEn >= from) && (!to || r.enviadaEn <= to)
              ? 'dentro'
              : 'fuera';
          case 'zona':
            // Sin localidad cuenta como interior, igual que el resumen.
            return r.localityId
              ? (localities.get(r.localityId)?.zona ?? 'INTERIOR')
              : 'INTERIOR';
          case 'departmentId':
            return r.localityId
              ? (localities.get(r.localityId)?.departmentId ?? null)
              : null;
          default:
            return r[filter];
        }
      };
      const own = filter === 'fecha' ? 'dentro' : String(query[filter]);

      const counts = new Map<string | null, number>();
      for (const r of rows) {
        const k = keyOf(r);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      if (!filaPublicable([...counts.entries()], rows.length, own)) {
        return false;
      }
    }
    return true;
  }

  /** Filas de un corte padre, leídas una sola vez por pedido. */
  private sliceRows(
    campaignId: string,
    query: MetricsQueryDto,
    memo: SliceMemo,
  ): Promise<SliceRow[]> {
    const where = responseWhere(campaignId, query);
    const id = JSON.stringify(where);
    let rows = memo.get(id);
    if (!rows) {
      rows = this.prisma.surveyResponse.findMany({
        where,
        select: SLICE_ROW_SELECT,
      }) as Promise<SliceRow[]>;
      memo.set(id, rows);
    }
    return rows;
  }

  /**
   * Proyecta las respuestas del corte con lo justo para cruzar. Nunca trae
   * nada que la tabla no guarde ya; y la tabla no guarda a nadie.
   */
  private async projectResponses(
    where: ReturnType<typeof responseWhere>,
  ): Promise<RespuestaProyectada[]> {
    const rows = await this.prisma.surveyResponse.findMany({
      where,
      select: {
        ...SLICE_ROW_SELECT,
        answers: { select: { questionId: true, optionId: true } },
      },
    });

    // Cada corte se publica de a k (ver `publicarEnTandas`).
    return publicarEnTandas(rows, (r) => r.id).map((r) => {
      const options = new Map<string, string[]>();
      for (const a of r.answers) {
        const list = options.get(a.questionId);
        if (list) list.push(a.optionId);
        else options.set(a.questionId, [a.optionId]);
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
        opciones: options,
      };
    });
  }

  private async resolveNames(
    localityIds: (string | null)[],
    disciplineIds: (string | null)[],
    categoryIds: (string | null)[],
    questions: CampaignWithQuestionnaire['questions'],
  ): Promise<MapasDeNombres> {
    const unique = (ids: (string | null)[]) => [
      ...new Set(ids.filter((x): x is string => Boolean(x))),
    ];
    const localities = unique(localityIds);
    const disciplines = unique(disciplineIds);
    const categories = unique(categoryIds);

    const [locRows, disRows, catRows] = await Promise.all([
      localities.length
        ? this.prisma.locality.findMany({
            where: { id: { in: localities } },
            select: {
              id: true,
              name: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      disciplines.length
        ? this.prisma.discipline.findMany({
            where: { id: { in: disciplines } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      categories.length
        ? this.prisma.category.findMany({
            where: { id: { in: categories } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      localidades: new Map(
        locRows.map((l) => [
          l.id,
          {
            nombre: l.name,
            departmentId: l.departmentId,
            zona: zonaDeLocalidad(l.name, l.department.name),
          },
        ]),
      ),
      departamentos: new Map(
        locRows.map((l) => [l.departmentId, l.department.name]),
      ),
      disciplinas: new Map(disRows.map((d) => [d.id, d.name])),
      categorias: new Map(catRows.map((c) => [c.id, c.name])),
      preguntas: new Map(
        questions.map((q) => [q.id, q.options.map(toOptionCatalog)]),
      ),
    };
  }
}
