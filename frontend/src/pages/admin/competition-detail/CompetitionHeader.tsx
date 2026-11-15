// ===========================================
// CompetitionHeader — título, badges y metadata de la competencia
// ===========================================
import { LayoutGrid, Swords, Trophy, Users } from 'lucide-react';
import type { Competition } from '@/types';
import { COMPETITION_STATUS_LABELS, FORMAT_LABELS, STAGE_LABELS } from '@/lib/constants';
import { DetailHeader } from '../components/DetailHeader';
import { Badge } from '@/components/ui/badge';

interface CompetitionHeaderProps {
  competition: Competition;
  /**
   * Cantidad de competidores elegibles; se muestra junto al formato. Sin dato
   * (un rol que no puede leer equipos), no se muestra.
   */
  teamCount?: number;
  /** "equipos" o "participantes". */
  unidad?: string;
  onBack: () => void;
}

export function CompetitionHeader({ competition, teamCount, unidad = 'equipos', onBack }: CompetitionHeaderProps) {
  const titulo = competition.name || `${competition.discipline?.name} - ${competition.category?.name}`;
  const estado =
    COMPETITION_STATUS_LABELS[competition.status as keyof typeof COMPETITION_STATUS_LABELS] ?? competition.status;

  return (
    <DetailHeader
      title={titulo}
      status={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200 uppercase">
            {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
          </Badge>
          <Badge
            variant="outline"
            className={
              competition.status === 'BORRADOR'
                ? 'bg-warning-50 text-warning-700 border-warning-200'
                : competition.status === 'ACTIVA'
                  ? 'bg-success-50 text-success-700 border-success-200'
                  : 'bg-celeste-50 text-primary-700 border-celeste-200'
            }
          >
            {estado}
          </Badge>
        </span>
      }
      meta={
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4" aria-hidden="true" /> {competition.discipline?.name}
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="w-4 h-4" aria-hidden="true" /> {competition.category?.name}
          </li>
          <li className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />{' '}
            {FORMAT_LABELS[competition.format as keyof typeof FORMAT_LABELS] || competition.format}
          </li>
          {teamCount !== undefined && (
            <li className="flex items-center gap-1.5 tabular-nums">
              <Swords className="w-4 h-4" aria-hidden="true" /> {teamCount} {unidad}
            </li>
          )}
        </ul>
      }
      backLabel="Volver al listado de competencias"
      onBack={onBack}
    />
  );
}
