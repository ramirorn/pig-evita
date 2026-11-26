// ===========================================
// Reporte: equipos
// ===========================================
import { Prisma } from '@prisma/client';
import {
  Alcance,
  descripcionAlcance,
  ScopeService,
} from '../../../common/scope';
import {
  mapBatches,
  paginateByCursor,
} from '../../../common/prisma/batch-pagination';
import type { EspecificacionReporte, TeamReportFilters } from '../report.types';
import { ReportContext, TAMANIO_LOTE } from './report-context';

const HEADERS = [
  'ID Equipo',
  'Nombre',
  'Disciplina',
  'Categoría',
  'Departamento',
  'Localidad',
  'Cantidad Miembros',
];

export function teamsReport(
  { prisma, scope }: ReportContext,
  alcance: Alcance,
  filters?: TeamReportFilters,
): EspecificacionReporte {
  const where: Prisma.TeamWhereInput = {};
  if (filters?.disciplineId) where.disciplineId = filters.disciplineId;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.department) {
    where.department = { contains: filters.department, mode: 'insensitive' };
  }
  if (filters?.locality) {
    where.locality = { contains: filters.locality, mode: 'insensitive' };
  }

  const whereInScope = ScopeService.conAlcance(where, scope.whereTeam(alcance));

  return {
    nombreHoja: 'Equipos',
    headers: HEADERS,
    alcance: descripcionAlcance(alcance),
    lotes: () =>
      mapBatches(
        paginateByCursor(
          (cursorId) =>
            prisma.team.findMany({
              where: whereInScope,
              select: {
                id: true,
                name: true,
                department: true,
                locality: true,
                category: {
                  select: {
                    name: true,
                    discipline: { select: { name: true } },
                  },
                },
                _count: { select: { members: true } },
              },
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          TAMANIO_LOTE,
        ),
        (t): unknown[] => [
          t.id,
          t.name,
          t.category.discipline.name,
          t.category.name,
          t.department,
          t.locality,
          t._count.members,
        ],
      ),
  };
}
