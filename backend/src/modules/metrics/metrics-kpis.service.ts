// ===========================================
// ABM de KPIs de la encuesta
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
  normalizarDefinicionKpi,
  validarDefinicionKpi,
} from './metrics-aggregation';
import { assertCampaignExists } from './metrics-campaign';
import type { CreateSurveyKpiDto, UpdateSurveyKpiDto } from './dto';
import type { DefinicionKpi } from './metrics.types';

/**
 * Definiciones de KPI. Cada cambio sube la versión de la campaña afectada para
 * que los agregados cacheados se recalculen; un KPI reutilizable (sin campaña)
 * se refresca al vencer el TTL.
 */
@Injectable()
export class MetricsKpisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versions: SurveyVersionCache,
  ) {}

  list(campaignId?: string) {
    return this.prisma.surveyKpi.findMany({
      where: campaignId
        ? { OR: [{ campaignId }, { campaignId: null }] }
        : undefined,
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateSurveyKpiDto) {
    const definition = validDefinition(dto.definicion);
    if (dto.campaignId) await assertCampaignExists(this.prisma, dto.campaignId);

    const created = await this.prisma.surveyKpi.create({
      data: {
        campaignId: dto.campaignId ?? null,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        orden: dto.orden ?? 0,
        activo: dto.activo ?? true,
        definicion: definition as unknown as Prisma.InputJsonValue,
      },
    });
    this.versions.bump(created.campaignId);
    return created;
  }

  async update(id: string, dto: UpdateSurveyKpiDto) {
    const current = await this.prisma.surveyKpi.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('KPI no encontrado');
    const definition = dto.definicion
      ? validDefinition(dto.definicion)
      : undefined;
    if (dto.campaignId) await assertCampaignExists(this.prisma, dto.campaignId);

    const updated = await this.prisma.surveyKpi.update({
      where: { id },
      data: {
        campaignId: dto.campaignId === undefined ? undefined : dto.campaignId,
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        orden: dto.orden,
        activo: dto.activo,
        definicion: definition as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    // Si cambió de campaña, se invalidan las dos.
    this.versions.bump(current.campaignId);
    this.versions.bump(updated.campaignId);
    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.surveyKpi.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('KPI no encontrado');
    const removed = await this.prisma.surveyKpi.delete({ where: { id } });
    this.versions.bump(current.campaignId);
    return removed;
  }
}

/** VULN-40 — se persiste la definición normalizada, no la que llegó. */
function validDefinition(definition: unknown): DefinicionKpi {
  const error = validarDefinicionKpi(definition);
  if (error) throw new BadRequestException(`Definición inválida: ${error}`);
  return normalizarDefinicionKpi(definition as DefinicionKpi);
}
