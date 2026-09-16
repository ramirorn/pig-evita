// ===========================================
// Survey Service (S20)
// ===========================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionStage,
  DisciplineType,
  Prisma,
  SurveyAudience,
  SurveyCampaignStatus,
  SurveyQuestionKind,
  SurveyWindow,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildOrderBy, buildPaginatedResponse } from '../../common/dto';
import {
  ActiveSurveyQueryDto,
  CAMPOS_ORDEN_SURVEY_CAMPAIGNS,
  CreateSurveyCampaignDto,
  CreateSurveyOptionDto,
  CreateSurveyQuestionDto,
  SubmitSurveyResponseDto,
  SurveyCampaignFilterDto,
  SurveyMetricsQueryDto,
  UpdateSurveyCampaignDto,
  UpdateSurveyOptionDto,
  UpdateSurveyQuestionDto,
} from './dto';
import { MOTIVO_SUPRESION, UMBRAL_K_ANONIMATO } from './survey.constants';
import type {
  Corte,
  SurveyFlowDisciplina,
  SurveyFlowDisciplinaLocalidad,
  SurveyFlowEtapaVentana,
  SurveyFlowResult,
  SurveyMetricsResult,
  SurveyQuestionMetric,
  SurveySubmitResult,
} from './survey.types';

/** Campaña con sus preguntas y opciones ya ordenadas, como la ve el formulario. */
const INCLUDE_CUESTIONARIO = {
  questions: {
    orderBy: { orden: 'asc' as const },
    include: { options: { orderBy: { orden: 'asc' as const } } },
  },
} satisfies Prisma.SurveyCampaignInclude;

@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================
  // Público
  // ===========================================

  /**
   * Campaña vigente para una etapa/ventana, con su cuestionario.
   *
   * Devuelve `null` —no 404— cuando no hay ninguna: "todavía no hay encuesta
   * abierta" es un estado normal del sitio público, no un error del cliente, y
   * un 404 obligaría a cada consumidor a tratar un caso esperable como falla.
   *
   * Las preguntas de audiencia INDIVIDUAL/EQUIPO se devuelven **todas**: el
   * formulario recién sabe el tipo de disciplina cuando la persona la elige, y
   * filtra en pantalla. El servidor vuelve a verificar la compatibilidad al
   * recibir el envío (`submitResponse`), que es donde importa.
   */
  async findActive(query: ActiveSurveyQueryDto) {
    const ahora = new Date();

    const where: Prisma.SurveyCampaignWhereInput = {
      status: SurveyCampaignStatus.ACTIVA,
      AND: [
        { OR: [{ abreEn: null }, { abreEn: { lte: ahora } }] },
        { OR: [{ cierraEn: null }, { cierraEn: { gte: ahora } }] },
      ],
    };

    if (query.ventana) {
      where.ventana = query.ventana;
    }

    // Una campaña con `etapa: null` sirve para cualquier etapa.
    if (query.etapa) {
      where.OR = [{ etapa: query.etapa }, { etapa: null }];
    }

    const candidatas = await this.prisma.surveyCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: INCLUDE_CUESTIONARIO,
    });

    if (candidatas.length === 0) return null;

    // La campaña hecha para esta etapa le gana a la genérica, aunque sea más
    // vieja: si alguien se tomó el trabajo de escribir una para el provincial,
    // es la que tiene que aparecer en el provincial.
    const elegida =
      (query.etapa
        ? candidatas.find((c) => c.etapa === query.etapa)
        : undefined) ?? candidatas[0];

    return {
      ...elegida,
      questions: elegida.questions.filter((q) => q.activa),
    };
  }

  /**
   * Envío anónimo.
   *
   * Todo lo que llega se vuelve a verificar contra la campaña guardada: que la
   * pregunta sea de esta campaña, que la opción sea de esa pregunta, que la
   * cantidad de opciones respete el tipo, que la audiencia corresponda al tipo
   * de disciplina y que no falte ninguna obligatoria. El formulario ya hace
   * casi todo eso, pero el endpoint es público: lo que llega puede no venir de
   * ese formulario.
   *
   * **No se deduplica.** Sin identidad no hay forma de saber si dos envíos son
   * de la misma persona, y averiguarlo requeriría guardar algo que la ate — que
   * es exactamente lo que este modelo no hace. El único freno al duplicado es
   * el rate limit del controller.
   */
  async submitResponse(
    dto: SubmitSurveyResponseDto,
  ): Promise<SurveySubmitResult> {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id: dto.campaignId },
      include: INCLUDE_CUESTIONARIO,
    });

    if (!campaign) {
      throw new NotFoundException(
        'La encuesta no existe o ya no está disponible',
      );
    }

    if (campaign.status !== SurveyCampaignStatus.ACTIVA) {
      throw new BadRequestException(
        'La encuesta no está abierta para recibir respuestas',
      );
    }

    const ahora = new Date();
    if (campaign.abreEn && ahora < campaign.abreEn) {
      throw new BadRequestException('La encuesta todavía no está abierta');
    }
    if (campaign.cierraEn && ahora > campaign.cierraEn) {
      throw new BadRequestException('La encuesta ya está cerrada');
    }

    const activas = campaign.questions.filter((q) => q.activa);
    const porId = new Map(activas.map((q) => [q.id, q]));
    const vistas = new Set<string>();

    for (const respuesta of dto.respuestas) {
      const pregunta = porId.get(respuesta.questionId);

      if (!pregunta) {
        throw new BadRequestException(
          'Una de las preguntas enviadas no pertenece a esta encuesta o ya no está activa',
        );
      }

      if (vistas.has(pregunta.id)) {
        throw new BadRequestException(
          `La pregunta "${pregunta.texto}" vino repetida en el envío`,
        );
      }
      vistas.add(pregunta.id);

      if (!this.audienciaCompatible(pregunta.audiencia, dto.disciplineType)) {
        throw new BadRequestException(
          `La pregunta "${pregunta.texto}" no corresponde a una disciplina ${dto.disciplineType.toLowerCase()}`,
        );
      }

      const opcionesValidas = new Set(pregunta.options.map((o) => o.id));
      const elegidas = new Set(respuesta.optionIds);

      if (elegidas.size !== respuesta.optionIds.length) {
        throw new BadRequestException(
          `Se eligió dos veces la misma opción en "${pregunta.texto}"`,
        );
      }

      for (const optionId of respuesta.optionIds) {
        if (!opcionesValidas.has(optionId)) {
          throw new BadRequestException(
            `Una de las opciones elegidas no pertenece a la pregunta "${pregunta.texto}"`,
          );
        }
      }

      if (
        pregunta.kind === SurveyQuestionKind.UNICA &&
        respuesta.optionIds.length !== 1
      ) {
        throw new BadRequestException(
          `La pregunta "${pregunta.texto}" admite una sola opción`,
        );
      }
    }

    // Las obligatorias que le tocan a esta persona tienen que estar todas.
    const faltante = activas.find(
      (q) =>
        q.obligatoria &&
        this.audienciaCompatible(q.audiencia, dto.disciplineType) &&
        q.options.length > 0 &&
        !vistas.has(q.id),
    );

    if (faltante) {
      throw new BadRequestException(
        `Falta responder la pregunta obligatoria "${faltante.texto}"`,
      );
    }

    await this.validarCortes(dto);

    const answersData = dto.respuestas.flatMap((respuesta) =>
      respuesta.optionIds.map((optionId) => ({
        questionId: respuesta.questionId,
        optionId,
      })),
    );

    // `ventana` sale de la campaña, no del cliente: es lo que hace comparable el
    // análisis de flujo entre PRE / DURANTE / POST.
    const response = await this.prisma.surveyResponse.create({
      data: {
        campaignId: campaign.id,
        ventana: campaign.ventana,
        etapa: dto.etapa,
        disciplineId: dto.disciplineId ?? null,
        disciplineType: dto.disciplineType,
        localityId: dto.localityId ?? null,
        categoryId: dto.categoryId ?? null,
        sexo: dto.sexo ?? null,
        answers: { create: answersData },
      },
      select: { enviadaEn: true },
    });

    // ⚠️ El log no lleva ni el id de la respuesta ni ningún corte: un log con
    // "disciplina X, localidad Y, 14:32" reconstruye por afuera lo que la tabla
    // se cuidó de no guardar.
    this.logger.log(
      `Respuesta de encuesta registrada (campaña ${campaign.id})`,
    );

    return { registrada: true, enviadaEn: response.enviadaEn };
  }

  /** `TODOS` va siempre; el resto tiene que coincidir con el tipo de disciplina. */
  private audienciaCompatible(
    audiencia: SurveyAudience,
    tipo: DisciplineType,
  ): boolean {
    if (audiencia === SurveyAudience.TODOS) return true;
    return audiencia === SurveyAudience.INDIVIDUAL
      ? tipo === DisciplineType.INDIVIDUAL
      : tipo === DisciplineType.EQUIPO;
  }

  /**
   * Los cortes demográficos tienen que existir de verdad.
   *
   * Si no se validan, un uuid inventado termina en un error de clave foránea de
   * Prisma, que el filtro global devuelve como 500 — cuando en realidad el que
   * se equivocó fue el cliente. Y el tipo de la disciplina se contrasta con el
   * `disciplineType` declarado porque de ese campo depende qué preguntas son
   * válidas: mandar ajedrez con `EQUIPO` colaría las preguntas de equipo.
   */
  private async validarCortes(dto: SubmitSurveyResponseDto): Promise<void> {
    if (dto.disciplineId) {
      const disciplina = await this.prisma.discipline.findUnique({
        where: { id: dto.disciplineId },
        select: { type: true },
      });

      if (!disciplina) {
        throw new BadRequestException('La disciplina indicada no existe');
      }

      if (disciplina.type !== dto.disciplineType) {
        throw new BadRequestException(
          'El tipo de disciplina no coincide con la disciplina elegida',
        );
      }
    }

    if (dto.localityId) {
      const localidad = await this.prisma.locality.findUnique({
        where: { id: dto.localityId },
        select: { id: true },
      });
      if (!localidad) {
        throw new BadRequestException('La localidad indicada no existe');
      }
    }

    if (dto.categoryId) {
      const categoria = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!categoria) {
        throw new BadRequestException('La categoría indicada no existe');
      }
    }
  }

  // ===========================================
  // Campañas (admin)
  // ===========================================

  async createCampaign(dto: CreateSurveyCampaignDto, createdById: string) {
    this.validarVentanaTemporal(dto.abreEn, dto.cierraEn);

    const campaign = await this.prisma.surveyCampaign.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        anio: dto.anio,
        ventana: dto.ventana,
        etapa: dto.etapa ?? null,
        abreEn: dto.abreEn ? new Date(dto.abreEn) : null,
        cierraEn: dto.cierraEn ? new Date(dto.cierraEn) : null,
        createdById,
      },
      include: INCLUDE_CUESTIONARIO,
    });

    this.logger.log(`Campaña de encuesta creada: ${campaign.titulo}`);
    return campaign;
  }

  async findAllCampaigns(filterDto: SurveyCampaignFilterDto) {
    const where: Prisma.SurveyCampaignWhereInput = {};

    if (filterDto.anio !== undefined) where.anio = filterDto.anio;
    if (filterDto.status) where.status = filterDto.status;
    if (filterDto.ventana) where.ventana = filterDto.ventana;
    if (filterDto.etapa) where.etapa = filterDto.etapa;
    if (filterDto.search) {
      where.titulo = { contains: filterDto.search, mode: 'insensitive' };
    }

    const [campaigns, total] = await Promise.all([
      this.prisma.surveyCampaign.findMany({
        where,
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: buildOrderBy(
          CAMPOS_ORDEN_SURVEY_CAMPAIGNS,
          'createdAt',
          filterDto.sortBy,
          filterDto.sortOrder,
        ),
        include: {
          _count: { select: { questions: true, responses: true } },
        },
      }),
      this.prisma.surveyCampaign.count({ where }),
    ]);

    return buildPaginatedResponse(campaigns, total, filterDto);
  }

  async findCampaign(id: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id },
      include: {
        ...INCLUDE_CUESTIONARIO,
        _count: { select: { responses: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaña de encuesta no encontrada');
    }

    return campaign;
  }

  async updateCampaign(id: string, dto: UpdateSurveyCampaignDto) {
    const campaign = await this.findCampaign(id);
    this.rechazarSiEstaCerrada(campaign.status, 'editar');
    this.validarVentanaTemporal(
      dto.abreEn ?? campaign.abreEn?.toISOString(),
      dto.cierraEn ?? campaign.cierraEn?.toISOString(),
    );

    const data: Prisma.SurveyCampaignUpdateInput = {
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      anio: dto.anio,
      ventana: dto.ventana,
      etapa: dto.etapa,
    };

    if (dto.abreEn !== undefined) data.abreEn = new Date(dto.abreEn);
    if (dto.cierraEn !== undefined) data.cierraEn = new Date(dto.cierraEn);

    const actualizada = await this.prisma.surveyCampaign.update({
      where: { id },
      data,
      include: INCLUDE_CUESTIONARIO,
    });

    this.logger.log(`Campaña de encuesta actualizada: ${actualizada.titulo}`);
    return actualizada;
  }

  /**
   * Borrar una campaña borra en cascada sus respuestas.
   *
   * Por eso sólo se puede borrar mientras no tenga ninguna: una vez que hay
   * chicos que contestaron, el borrado deja de ser "sacar un borrador que quedó
   * mal" y pasa a ser destruir la muestra. Para sacarla de circulación está
   * `POST /:id/close`, que la cierra y conserva los datos.
   */
  async removeCampaign(id: string) {
    const campaign = await this.findCampaign(id);

    if (campaign._count.responses > 0) {
      throw new ConflictException(
        `Esta campaña ya tiene ${campaign._count.responses} respuestas y borrarla las borraría también. Cerrala en vez de eliminarla.`,
      );
    }

    const borrada = await this.prisma.surveyCampaign.delete({ where: { id } });
    this.logger.log(`Campaña de encuesta eliminada: ${borrada.titulo}`);
    return borrada;
  }

  /**
   * BORRADOR → ACTIVA.
   *
   * Se exige al menos una pregunta activa, y que ninguna activa esté sin
   * opciones: una pregunta obligatoria sin opciones es un formulario que no se
   * puede enviar nunca, y el envío fallido sobre una conexión mala es
   * exactamente el problema que hundió la tasa de respuesta anterior.
   */
  async publishCampaign(id: string) {
    const campaign = await this.findCampaign(id);

    if (campaign.status === SurveyCampaignStatus.CERRADA) {
      throw new ConflictException(
        'La campaña está cerrada: no se puede volver a activar',
      );
    }

    if (campaign.status === SurveyCampaignStatus.ACTIVA) {
      return campaign;
    }

    const activas = campaign.questions.filter((q) => q.activa);

    if (activas.length === 0) {
      throw new BadRequestException(
        'La campaña no tiene ninguna pregunta activa: no se puede publicar',
      );
    }

    const sinOpciones = activas.find((q) => q.options.length === 0);
    if (sinOpciones) {
      throw new BadRequestException(
        `La pregunta "${sinOpciones.texto}" no tiene opciones cargadas`,
      );
    }

    const publicada = await this.prisma.surveyCampaign.update({
      where: { id },
      data: { status: SurveyCampaignStatus.ACTIVA },
      include: INCLUDE_CUESTIONARIO,
    });

    this.logger.log(`Campaña de encuesta publicada: ${publicada.titulo}`);
    return publicada;
  }

  /** ACTIVA → CERRADA. No hay vuelta atrás: cerrar congela el cuestionario. */
  async closeCampaign(id: string) {
    const campaign = await this.findCampaign(id);

    if (campaign.status === SurveyCampaignStatus.CERRADA) {
      return campaign;
    }

    if (campaign.status !== SurveyCampaignStatus.ACTIVA) {
      throw new ConflictException(
        'Sólo se puede cerrar una campaña activa. Un borrador se elimina, no se cierra.',
      );
    }

    const cerrada = await this.prisma.surveyCampaign.update({
      where: { id },
      data: { status: SurveyCampaignStatus.CERRADA },
      include: INCLUDE_CUESTIONARIO,
    });

    this.logger.log(`Campaña de encuesta cerrada: ${cerrada.titulo}`);
    return cerrada;
  }

  // ===========================================
  // Preguntas y opciones (admin)
  // ===========================================

  async createQuestion(campaignId: string, dto: CreateSurveyQuestionDto) {
    const campaign = await this.findCampaign(campaignId);
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    const orden = dto.orden ?? this.siguienteOrden(campaign.questions);
    this.validarValoresUnicos(dto.opciones);

    const question = await this.prisma.surveyQuestion.create({
      data: {
        campaignId,
        orden,
        texto: dto.texto,
        ayuda: dto.ayuda,
        kind: dto.kind ?? SurveyQuestionKind.UNICA,
        audiencia: dto.audiencia ?? SurveyAudience.TODOS,
        obligatoria: dto.obligatoria ?? true,
        activa: dto.activa ?? true,
        options: dto.opciones?.length
          ? {
              create: dto.opciones.map((opcion, indice) => ({
                texto: opcion.texto,
                valor: opcion.valor,
                orden: opcion.orden ?? indice,
              })),
            }
          : undefined,
      },
      include: { options: { orderBy: { orden: 'asc' } } },
    });

    return question;
  }

  async updateQuestion(
    campaignId: string,
    questionId: string,
    dto: UpdateSurveyQuestionDto,
  ) {
    const { campaign } = await this.findQuestion(campaignId, questionId);
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    return this.prisma.surveyQuestion.update({
      where: { id: questionId },
      data: {
        texto: dto.texto,
        ayuda: dto.ayuda,
        kind: dto.kind,
        audiencia: dto.audiencia,
        obligatoria: dto.obligatoria,
        activa: dto.activa,
        orden: dto.orden,
      },
      include: { options: { orderBy: { orden: 'asc' } } },
    });
  }

  /**
   * Borrar una pregunta borra en cascada las respuestas que la eligieron.
   *
   * Mientras la campaña no tenga respuestas es una corrección de borrador y se
   * permite. Con respuestas cargadas, lo correcto es `activa: false`: la
   * pregunta deja de mostrarse y el desglose histórico sigue existiendo.
   */
  async removeQuestion(campaignId: string, questionId: string) {
    const { campaign } = await this.findQuestion(campaignId, questionId);
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    if (campaign._count.responses > 0) {
      throw new ConflictException(
        'La campaña ya tiene respuestas: desactivá la pregunta (activa: false) en vez de borrarla, o perdés el desglose ya recolectado.',
      );
    }

    return this.prisma.surveyQuestion.delete({ where: { id: questionId } });
  }

  async createOption(
    campaignId: string,
    questionId: string,
    dto: CreateSurveyOptionDto,
  ) {
    const { campaign, question } = await this.findQuestion(
      campaignId,
      questionId,
    );
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    if (question.options.some((o) => o.valor === dto.valor)) {
      throw new ConflictException(
        `Ya existe una opción con el valor "${dto.valor}" en esta pregunta`,
      );
    }

    return this.prisma.surveyOption.create({
      data: {
        questionId,
        texto: dto.texto,
        valor: dto.valor,
        orden: dto.orden ?? this.siguienteOrden(question.options),
      },
    });
  }

  /**
   * Editar una opción.
   *
   * El `texto` se puede reescribir siempre — es el punto del CMS. El `valor`
   * **no** se puede cambiar una vez que hay respuestas: es la clave con la que
   * se agregan las métricas, y cambiarlo renombra retroactivamente lo que
   * contestaron los chicos de la etapa anterior.
   */
  async updateOption(
    campaignId: string,
    questionId: string,
    optionId: string,
    dto: UpdateSurveyOptionDto,
  ) {
    const { campaign, question } = await this.findQuestion(
      campaignId,
      questionId,
    );
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    const option = question.options.find((o) => o.id === optionId);
    if (!option) {
      throw new NotFoundException('La opción no pertenece a esta pregunta');
    }

    if (dto.valor && dto.valor !== option.valor) {
      if (campaign._count.responses > 0) {
        throw new ConflictException(
          'La campaña ya tiene respuestas: el valor de la opción no se puede cambiar porque es la clave de las métricas. El texto sí.',
        );
      }
      if (question.options.some((o) => o.valor === dto.valor)) {
        throw new ConflictException(
          `Ya existe una opción con el valor "${dto.valor}" en esta pregunta`,
        );
      }
    }

    return this.prisma.surveyOption.update({
      where: { id: optionId },
      data: { texto: dto.texto, valor: dto.valor, orden: dto.orden },
    });
  }

  async removeOption(campaignId: string, questionId: string, optionId: string) {
    const { campaign, question } = await this.findQuestion(
      campaignId,
      questionId,
    );
    this.rechazarSiEstaCerrada(campaign.status, 'editar');

    if (!question.options.some((o) => o.id === optionId)) {
      throw new NotFoundException('La opción no pertenece a esta pregunta');
    }

    const elegida = await this.prisma.surveyAnswer.count({
      where: { optionId },
    });

    if (elegida > 0) {
      throw new ConflictException(
        'Esta opción ya fue elegida por alguien: borrarla borraría esas respuestas. Reescribí el texto o desactivá la pregunta.',
      );
    }

    return this.prisma.surveyOption.delete({ where: { id: optionId } });
  }

  // ===========================================
  // Métricas
  // ===========================================

  /**
   * Agregados por pregunta y opción, con cortes opcionales.
   *
   * Regla de k-anonimato: si el corte pedido tiene menos de
   * `UMBRAL_K_ANONIMATO` respuestas, **no se devuelve ningún desglose**. Se
   * suprime el corte entero y no cada opción por separado, porque publicar el
   * total y esconder sólo las celdas chicas permite despejarlas por resta.
   */
  async getMetrics(
    id: string,
    query: SurveyMetricsQueryDto,
  ): Promise<SurveyMetricsResult> {
    const campaign = await this.findCampaign(id);
    const where = this.buildResponseWhere(id, query);
    const totalRespuestas = await this.prisma.surveyResponse.count({ where });

    const base = {
      campaignId: campaign.id,
      titulo: campaign.titulo,
      filtros: {
        etapa: query.etapa,
        ventana: query.ventana,
        disciplineId: query.disciplineId,
        disciplineType: query.disciplineType,
        localityId: query.localityId,
      },
      umbral: UMBRAL_K_ANONIMATO,
      totalRespuestas,
    };

    if (totalRespuestas < UMBRAL_K_ANONIMATO) {
      return {
        ...base,
        suprimido: true,
        motivo: MOTIVO_SUPRESION,
        preguntas: [],
      };
    }

    const conteos = await this.prisma.surveyAnswer.groupBy({
      by: ['questionId', 'optionId'],
      where: { response: where },
      _count: { _all: true },
    });

    const porOpcion = new Map(
      conteos.map((c) => [`${c.questionId}:${c.optionId}`, c._count._all]),
    );

    // Cuántas personas contestaron cada pregunta. No alcanza con sumar las
    // opciones: en una pregunta MULTIPLE una misma persona suma varias veces y
    // los porcentajes pasarían del 100%.
    const totalesPorPregunta = await Promise.all(
      campaign.questions.map((pregunta) =>
        this.prisma.surveyResponse.count({
          where: { ...where, answers: { some: { questionId: pregunta.id } } },
        }),
      ),
    );

    const preguntas: SurveyQuestionMetric[] = campaign.questions.map(
      (pregunta, indice) => {
        const totalPregunta = totalesPorPregunta[indice];

        return {
          questionId: pregunta.id,
          orden: pregunta.orden,
          texto: pregunta.texto,
          kind: pregunta.kind,
          audiencia: pregunta.audiencia,
          activa: pregunta.activa,
          totalRespuestas: totalPregunta,
          opciones: pregunta.options.map((opcion) => {
            const conteo = porOpcion.get(`${pregunta.id}:${opcion.id}`) ?? 0;
            return {
              optionId: opcion.id,
              valor: opcion.valor,
              texto: opcion.texto,
              orden: opcion.orden,
              conteo,
              porcentaje:
                totalPregunta > 0
                  ? Math.round((conteo / totalPregunta) * 1000) / 10
                  : 0,
            };
          }),
        };
      },
    );

    return { ...base, suprimido: false, motivo: null, preguntas };
  }

  /**
   * Conteos para el análisis de flujo: cuántos contestaron en cada etapa y
   * ventana, en qué disciplinas, y qué disciplinas aparecen por localidad.
   *
   * Cada celda pasa por el mismo umbral que las métricas. Acá importa más que
   * en ningún lado: "Ramón Lista, handball, etapa zonal: 2 respuestas" ya es
   * casi un nombre propio, aunque no se muestre ninguna respuesta.
   */
  async getFlow(id: string): Promise<SurveyFlowResult> {
    const campaign = await this.findCampaign(id);
    const where: Prisma.SurveyResponseWhereInput = { campaignId: id };

    const [totalRespuestas, porEtapa, porDisciplina, porDisciplinaLocalidad] =
      await Promise.all([
        this.prisma.surveyResponse.count({ where }),
        this.prisma.surveyResponse.groupBy({
          by: ['etapa', 'ventana'],
          where,
          _count: { _all: true },
        }),
        this.prisma.surveyResponse.groupBy({
          by: ['disciplineId', 'disciplineType'],
          where,
          _count: { _all: true },
        }),
        this.prisma.surveyResponse.groupBy({
          by: ['localityId', 'disciplineId'],
          where,
          _count: { _all: true },
        }),
      ]);

    const nombres = await this.resolverNombres(
      porDisciplina
        .map((d) => d.disciplineId)
        .concat(porDisciplinaLocalidad.map((d) => d.disciplineId)),
      porDisciplinaLocalidad.map((d) => d.localityId),
    );

    const porEtapaVentana: SurveyFlowEtapaVentana[] = porEtapa.map((fila) => ({
      etapa: fila.etapa as CompetitionStage,
      ventana: fila.ventana as SurveyWindow,
      ...this.aplicarUmbral(fila._count._all),
    }));

    const disciplinas: SurveyFlowDisciplina[] = porDisciplina.map((fila) => ({
      disciplineId: fila.disciplineId,
      disciplina: fila.disciplineId
        ? (nombres.disciplinas.get(fila.disciplineId) ?? null)
        : null,
      disciplineType: fila.disciplineType as DisciplineType,
      ...this.aplicarUmbral(fila._count._all),
    }));

    const porDisciplinaYLocalidad: SurveyFlowDisciplinaLocalidad[] =
      porDisciplinaLocalidad.map((fila) => ({
        localityId: fila.localityId,
        localidad: fila.localityId
          ? (nombres.localidades.get(fila.localityId) ?? null)
          : null,
        disciplineId: fila.disciplineId,
        disciplina: fila.disciplineId
          ? (nombres.disciplinas.get(fila.disciplineId) ?? null)
          : null,
        ...this.aplicarUmbral(fila._count._all),
      }));

    return {
      campaignId: campaign.id,
      titulo: campaign.titulo,
      umbral: UMBRAL_K_ANONIMATO,
      totalRespuestas,
      porEtapaVentana,
      porDisciplina: disciplinas,
      porDisciplinaYLocalidad,
    };
  }

  /** Un conteo sale publicado o sale suprimido; nunca a medias. */
  private aplicarUmbral(conteo: number): Corte {
    return conteo < UMBRAL_K_ANONIMATO
      ? { suprimido: true, motivo: MOTIVO_SUPRESION, conteo: null }
      : { suprimido: false, conteo };
  }

  private async resolverNombres(
    disciplineIds: (string | null)[],
    localityIds: (string | null)[],
  ) {
    const disciplinas = [...new Set(disciplineIds.filter(Boolean))] as string[];
    const localidades = [...new Set(localityIds.filter(Boolean))] as string[];

    const [filasDisciplinas, filasLocalidades] = await Promise.all([
      disciplinas.length
        ? this.prisma.discipline.findMany({
            where: { id: { in: disciplinas } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      localidades.length
        ? this.prisma.locality.findMany({
            where: { id: { in: localidades } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      disciplinas: new Map(filasDisciplinas.map((d) => [d.id, d.name])),
      localidades: new Map(filasLocalidades.map((l) => [l.id, l.name])),
    };
  }

  private buildResponseWhere(
    campaignId: string,
    query: SurveyMetricsQueryDto,
  ): Prisma.SurveyResponseWhereInput {
    const where: Prisma.SurveyResponseWhereInput = { campaignId };

    if (query.etapa) where.etapa = query.etapa;
    if (query.ventana) where.ventana = query.ventana;
    if (query.disciplineId) where.disciplineId = query.disciplineId;
    if (query.disciplineType) where.disciplineType = query.disciplineType;
    if (query.localityId) where.localityId = query.localityId;

    return where;
  }

  // ===========================================
  // Helpers
  // ===========================================

  private async findQuestion(campaignId: string, questionId: string) {
    const campaign = await this.findCampaign(campaignId);
    const question = campaign.questions.find((q) => q.id === questionId);

    if (!question) {
      throw new NotFoundException('La pregunta no pertenece a esta campaña');
    }

    return { campaign, question };
  }

  /**
   * Una campaña cerrada es el registro de lo que se preguntó.
   *
   * Editarle una pregunta después de cerrarla haría que el informe describa un
   * cuestionario distinto del que contestaron los chicos, sin ninguna marca de
   * que eso pasó.
   */
  private rechazarSiEstaCerrada(
    status: SurveyCampaignStatus,
    verbo: string,
  ): void {
    if (status !== SurveyCampaignStatus.CERRADA) return;

    throw new ConflictException(
      `La campaña está cerrada y no se puede ${verbo}. Duplicala en una campaña nueva si hay que cambiar el cuestionario.`,
    );
  }

  private validarVentanaTemporal(abreEn?: string, cierraEn?: string): void {
    if (!abreEn || !cierraEn) return;

    if (new Date(cierraEn) <= new Date(abreEn)) {
      throw new BadRequestException(
        'La fecha de cierre tiene que ser posterior a la de apertura',
      );
    }
  }

  private siguienteOrden(filas: { orden: number }[]): number {
    return filas.length === 0 ? 0 : Math.max(...filas.map((f) => f.orden)) + 1;
  }

  private validarValoresUnicos(opciones?: CreateSurveyOptionDto[]): void {
    if (!opciones?.length) return;

    const valores = new Set(opciones.map((o) => o.valor));
    if (valores.size !== opciones.length) {
      throw new BadRequestException(
        'Hay dos opciones con el mismo valor en la misma pregunta',
      );
    }
  }
}
