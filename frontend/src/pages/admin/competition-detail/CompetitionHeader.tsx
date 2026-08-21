// ===========================================
// CompetitionHeader — título, badges y metadata de la competencia
// ===========================================
import { ArrowLeft, LayoutGrid, Swords, Trophy, Users } from 'lucide-react';
import type { Competition } from '@/types';
import { FORMAT_LABELS, STAGE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CompetitionHeaderProps {
  competition: Competition;
  /** Cantidad de equipos elegibles; se muestra junto al formato. */
  teamCount: number;
  onBack: () => void;
}

export function CompetitionHeader({ competition, teamCount, onBack }: CompetitionHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Button variant="outline" size="icon" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-primary-800">
            {competition.name || `${competition.discipline?.name} - ${competition.category?.name}`}
          </h1>
          <Badge variant="outline" className="bg-primary-50 text-primary-700 border-primary-200 uppercase">
            {STAGE_LABELS[competition.stage as keyof typeof STAGE_LABELS] || competition.stage}
          </Badge>
          <Badge variant="outline" className={
            competition.status === 'BORRADOR' ? 'bg-orange-50 text-orange-700 border-orange-200' :
            competition.status === 'ACTIVA' ? 'bg-green-50 text-green-700 border-green-200' :
            'bg-blue-50 text-blue-700 border-blue-200'
          }>
            {competition.status}
          </Badge>
        </div>
        <div className="flex gap-4 text-sm text-primary-500 mt-2">
          <span className="flex items-center gap-1">
            <Trophy className="w-4 h-4" /> {competition.discipline?.name}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" /> {competition.category?.name}
          </span>
          <span className="flex items-center gap-1">
            <LayoutGrid className="w-4 h-4" /> {FORMAT_LABELS[competition.format as keyof typeof FORMAT_LABELS] || competition.format}
          </span>
          <span className="flex items-center gap-1">
            <Swords className="w-4 h-4" /> {teamCount} equipos
          </span>
        </div>
      </div>
    </div>
  );
}
