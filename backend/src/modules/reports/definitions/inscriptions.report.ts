// ===========================================
// Reporte: inscripciones
// ===========================================
import { InscriptionStatus, Prisma } from '@prisma/client';
import {
  Alcance,
  descripcionAlcance,
  ScopeService,
} from '../../../common/scope';
import {
  mapBatches,
  paginateByCursor,
} from '../../../common/prisma/batch-pagination';
import { ETIQUETAS_EXPORTACION, etiquetaExportacion } from '../report-format';
import type { EspecificacionReporte } from '../report.types';
import { ReportContext, TAMANIO_LOTE } from './report-context';

const HEADERS = [
  'Código QR',
  'DNI Participante',
  'Nombre',
  'Apellido',
  'Sexo',
  'Disciplina',
  'Categoría',
  'Equipo',
  'Departamento',
  'Localidad',
  'Estado',
  'Fecha Inscripción',
];

export function inscriptionsReport(
  { prisma, scope }: ReportContext,
  alcance: Alcance,
  disciplineId?: string,
  categoryId?: string,
  status?: InscriptionStatus,
): EspecificacionReporte {
  // M2 — antes `const where: any`: un estado mal escrito no fallaba al compilar.
  const where: Prisma.InscriptionWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
    ...(disciplineId ? { category: { disciplineId } } : {}),
  };

  const whereInScope = ScopeService.conAlcance(
    where,
    scope.whereInscription(alcance),
  );

  return {
    nombreHoja: 'Inscripciones',
    headers: HEADERS,
    alcance: descripcionAlcance(alcance),
    lotes: () =>
      mapBatches(
        paginateByCursor(
          (cursorId) =>
            prisma.inscription.findMany({
              where: whereInScope,
              // M3 — sólo las columnas del archivo; antes `participant: true`
              // traía la fila entera, domicilio incluido.
              select: {
                id: true,
                qrCode: true,
                status: true,
                createdAt: true,
                participant: {
                  select: {
                    dni: true,
                    firstName: true,
                    lastName: true,
                    sex: true,
                    department: true,
                    locality: true,
                  },
                },
                category: {
                  select: {
                    name: true,
                    discipline: { select: { name: true } },
                  },
                },
                team: { select: { name: true } },
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          TAMANIO_LOTE,
        ),
        (i): unknown[] => [
          i.qrCode,
          i.participant.dni,
          i.participant.firstName,
          i.participant.lastName,
          etiquetaExportacion(ETIQUETAS_EXPORTACION.sexo, i.participant.sex),
          i.category.discipline.name,
          i.category.name,
          i.team?.name || 'Individual',
          i.participant.department,
          i.participant.locality,
          etiquetaExportacion(
            ETIQUETAS_EXPORTACION.estadoInscripcion,
            i.status,
          ),
          i.createdAt ? i.createdAt.toISOString().split('T')[0] : '',
        ],
      ),
  };
}
