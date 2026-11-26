// ===========================================
// Filtro de respuestas de un corte de métricas
// ===========================================
//
// Funciones puras: traducen los filtros del panel al `where` de Prisma y a la
// forma en que se informan en la respuesta. No consultan la base.
import { Prisma } from '@prisma/client';
import { CAPITAL } from '../../common/constants';
import { finDelRango, inicioDelRango } from '../../common/dto/date-range';
import { diaDelFiltro } from './metrics-aggregation';
import type { MetricsQueryDto } from './dto';
import type { MetricsFiltros } from './metrics.types';

/** Localidad capital, por nombre de localidad y de departamento. */
const CAPITAL_LOCALITY: Prisma.LocalityWhereInput = {
  name: { equals: CAPITAL.localidad, mode: 'insensitive' },
  department: {
    name: { equals: CAPITAL.departamento, mode: 'insensitive' },
  },
};

/** `where` de las respuestas de una campaña con los filtros del panel. */
export function responseWhere(
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
  if (query.zona === 'CAPITAL') {
    // Departamento y zona pueden venir juntos: se combinan con AND en vez de
    // mezclar campos en un mismo filtro de relación.
    where.locality = where.locality
      ? { AND: [where.locality, CAPITAL_LOCALITY] }
      : CAPITAL_LOCALITY;
  } else if (query.zona === 'INTERIOR') {
    where.NOT = { locality: CAPITAL_LOCALITY };
  }

  if (query.desde || query.hasta) {
    where.enviadaEn = {};
    // Siempre días completos: la hora que mande el cliente se descarta.
    if (query.desde) {
      where.enviadaEn.gte = inicioDelRango(diaDelFiltro(query.desde));
    }
    if (query.hasta) {
      where.enviadaEn.lte = finDelRango(diaDelFiltro(query.hasta));
    }
  }

  return where;
}

/** Los filtros aplicados, tal como se informan junto a cada resultado. */
export function appliedFilters(query: MetricsQueryDto): MetricsFiltros {
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
    desde: query.desde && diaDelFiltro(query.desde),
    hasta: query.hasta && diaDelFiltro(query.hasta),
  };
}
