// ===========================================
// Reporte: padrón de participantes
// ===========================================
import { Prisma } from '@prisma/client';
import {
  Alcance,
  descripcionAlcance,
  ScopeService,
} from '../../../common/scope';
import { PARTICIPANT_REPORT } from '../../../common/prisma-selects';
import {
  mapBatches,
  paginateByCursor,
} from '../../../common/prisma/batch-pagination';
import { ETIQUETAS_EXPORTACION, etiquetaExportacion } from '../report-format';
import type {
  EspecificacionReporte,
  ParticipantReportFilters,
} from '../report.types';
import { ReportContext, TAMANIO_LOTE } from './report-context';

const HEADERS = [
  'DNI',
  'Nombre',
  'Apellido',
  'Sexo',
  'Fecha Nacimiento',
  'Departamento',
  'Localidad',
  'Teléfono',
  'Email',
  'Categorías',
];

export function participantsReport(
  { prisma, scope }: ReportContext,
  alcance: Alcance,
  filters?: ParticipantReportFilters,
): EspecificacionReporte {
  const where: Prisma.ParticipantWhereInput = {};
  if (filters?.department) {
    where.department = { contains: filters.department, mode: 'insensitive' };
  }
  if (filters?.locality) {
    where.locality = { contains: filters.locality, mode: 'insensitive' };
  }
  if (filters?.disciplineId || filters?.categoryId) {
    where.inscriptions = {
      some: {
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.disciplineId
          ? { category: { disciplineId: filters.disciplineId } }
          : {}),
      },
    };
  }

  // R05 — el recorte territorial va bajo `AND` con el filtro del cliente:
  // pedir un departamento ajeno devuelve cero filas, no un 403.
  const whereInScope = ScopeService.conAlcance(
    where,
    scope.whereParticipant(alcance),
  );

  return {
    nombreHoja: 'Padrón Participantes',
    headers: HEADERS,
    alcance: descripcionAlcance(alcance),
    lotes: () =>
      mapBatches(
        paginateByCursor(
          (cursorId) =>
            prisma.participant.findMany({
              where: whereInScope,
              // M3 — sólo las columnas del archivo (sin domicilio).
              select: {
                id: true,
                ...PARTICIPANT_REPORT,
                inscriptions: {
                  select: {
                    category: {
                      select: {
                        name: true,
                        discipline: { select: { name: true } },
                      },
                    },
                  },
                },
              },
              // `@@index([lastName, firstName])` cubre el orden; `id` desempata.
              orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' },
                { id: 'asc' },
              ],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          TAMANIO_LOTE,
        ),
        (p): unknown[] => [
          p.dni,
          p.firstName,
          p.lastName,
          etiquetaExportacion(ETIQUETAS_EXPORTACION.sexo, p.sex),
          p.birthDate ? p.birthDate.toISOString().split('T')[0] : '',
          p.department,
          p.locality,
          p.phone || '',
          p.email || '',
          p.inscriptions
            .map((i) => `${i.category.discipline.name} - ${i.category.name}`)
            .join(' | '),
        ],
      ),
  };
}
