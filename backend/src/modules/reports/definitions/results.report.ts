// ===========================================
// Reporte: resultados y partidos
// ===========================================
import { Prisma } from '@prisma/client';
import { Alcance, descripcionAlcance } from '../../../common/scope';
import {
  mapBatches,
  paginateByOffset,
} from '../../../common/prisma/batch-pagination';
import {
  ETIQUETAS_EXPORTACION,
  etiquetaExportacion,
  puntajeExportado,
} from '../report-format';
import type { EspecificacionReporte } from '../report.types';
import { ReportContext, TAMANIO_LOTE } from './report-context';

const HEADERS = [
  'Competencia',
  'Disciplina',
  'Categoría',
  'Etapa',
  'Fecha / Ronda',
  'Partido N°',
  'Estado',
  'Local',
  'Puntaje Local',
  'Visitante',
  'Puntaje Visitante',
  'Ganador',
  'Sede',
];

interface Side {
  team: { name: string } | null;
  participant: { firstName: string; lastName: string } | null;
}

function sideName(r: Side | undefined): string {
  if (!r) return '-';
  if (r.team?.name) return r.team.name;
  return r.participant
    ? `${r.participant.lastName}, ${r.participant.firstName}`
    : '-';
}

export function resultsReport(
  { prisma }: ReportContext,
  alcance: Alcance,
  competitionId?: string,
): EspecificacionReporte {
  // M2 — antes `const where: any`.
  const where: Prisma.MatchWhereInput = competitionId ? { competitionId } : {};

  return {
    nombreHoja: 'Resultados y Partidos',
    headers: HEADERS,
    // Los partidos son de competencias provinciales, sin departamento propio:
    // no hay recorte, pero la línea dice con qué alcance se pidió.
    alcance: descripcionAlcance(alcance),
    lotes: () =>
      mapBatches(
        // OFFSET y no cursor: el orden es por `competition.name`, de otra tabla.
        paginateByOffset(
          (skip) =>
            prisma.match.findMany({
              where,
              select: {
                id: true,
                round: true,
                matchNumber: true,
                status: true,
                competition: {
                  select: {
                    name: true,
                    stage: true,
                    discipline: { select: { name: true } },
                    category: { select: { name: true } },
                  },
                },
                venue: { select: { name: true } },
                results: {
                  select: {
                    scoreData: true,
                    isWinner: true,
                    team: { select: { name: true } },
                    participant: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                  // Local primero, como el fixture público (R23). Sin este
                  // orden Postgres puede devolver las filas en cualquier orden
                  // y el archivo invertía local y visitante.
                  orderBy: [
                    { isHome: 'desc' },
                    { createdAt: 'asc' },
                    { id: 'asc' },
                  ],
                },
              },
              // El `id` final vuelve total al orden entre páginas.
              orderBy: [
                { competition: { name: 'asc' } },
                { round: 'asc' },
                { matchNumber: 'asc' },
                { id: 'asc' },
              ],
              take: TAMANIO_LOTE,
              skip,
            }),
          TAMANIO_LOTE,
        ),
        (m): unknown[] => {
          const [home, away] = m.results;
          const homeName = sideName(home);
          const awayName = sideName(away);
          const winner = home?.isWinner
            ? homeName
            : away?.isWinner
              ? awayName
              : '-';
          return [
            m.competition.name ||
              `${m.competition.discipline.name} - ${m.competition.category.name}`,
            m.competition.discipline.name,
            m.competition.category.name,
            etiquetaExportacion(
              ETIQUETAS_EXPORTACION.etapa,
              m.competition.stage,
            ),
            `Fecha ${m.round}`,
            m.matchNumber,
            etiquetaExportacion(ETIQUETAS_EXPORTACION.estadoPartido, m.status),
            homeName,
            puntajeExportado(home?.scoreData),
            awayName,
            puntajeExportado(away?.scoreData),
            winner,
            m.venue?.name || '-',
          ];
        },
      ),
  };
}
