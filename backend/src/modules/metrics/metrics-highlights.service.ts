// ===========================================
// ABM de destacados de la encuesta
// ===========================================
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SurveyVersionCache } from '../survey/survey-version.cache';
import {
  normalizarDefinicionDestacado,
  validarDefinicionDestacado,
} from './metrics-aggregation';
import { assertCampaignExists } from './metrics-campaign';
import type { CreateSurveyHighlightDto, UpdateSurveyHighlightDto } from './dto';
import type { DefinicionDestacado } from './metrics.types';

/**
 * Definiciones de destacados. Mismo criterio de invalidación que los KPIs: cada
 * cambio sube la versión de la campaña afectada.
 */
@Injectable()
export class MetricsHighlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: SurveyVersionCache,
  ) {}

  list(campaignId?: string) {
    return this.prisma.surveyHighlight.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : undefined,
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateSurveyHighlightDto) {
    const definition = validDefinition(dto.definicion);
    if (dto.campaignId) await assertCampaignExists(this.prisma, dto.campaignId);

    const created = await this.prisma.surveyHighlight.create({
      data: {
        campaignId: dto.campaignId ?? null,
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
        definicion: definition as unknown as Prisma.InputJsonValue,
      },
    });
    this.versions.bump(created.campaignId);
    return created;
  }

  async update(id: string, dto: UpdateSurveyHighlightDto) {
    const current = await this.prisma.surveyHighlight.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Destacado no encontrado');
    const definition = dto.definicion
      ? validDefinition(dto.definicion)
      : undefined;
    if (dto.campaignId) await assertCampaignExists(this.prisma, dto.campaignId);

    const updated = await this.prisma.surveyHighlight.update({
      where: { id },
      data: {
        campaignId: dto.campaignId === undefined ? undefined : dto.campaignId,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        orden: dto.orden,
        activo: dto.activo,
        definicion: definition as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    this.versions.bump(current.campaignId);
    this.versions.bump(updated.campaignId);
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.surveyHighlight.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Destacado no encontrado');
    const removed = await this.prisma.surveyHighlight.delete({ where: { id } });
    this.versions.bump(current.campaignId);
    return removed;
  }
}

/** VULN-40 — se persiste la definición normalizada, no la que llegó. */
function validDefinition(definition: unknown): DefinicionDestacado {
  const error = validarDefinicionDestacado(definition);
  if (error) throw new BadRequestException(`Definición inválida: ${error}`);
  return normalizarDefinicionDestacado(definition as DefinicionDestacado);
}
