// ===========================================
// MatchCard — tarjeta de un partido del fixture
// ===========================================
import type { Match, ResultType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatearMarcador } from './matchScore';

/**
 * `results` viene con dos entradas (local y visitante) pero el backend no
 * garantiza que estén completas, así que con `noUncheckedIndexedAccess` todo
 * el acceso es opcional y cae a los textos por defecto.
 */
export function MatchCard({
  match,
  resultType,
}: {
  match: Match;
  /** Tipo de resultado de la disciplina: define qué clave de `scoreData` leer. */
  resultType: ResultType | undefined;
}) {
  const results = match.results || [];
  const home = results[0];
  const away = results[1];

  return (
    <div className="border border-primary-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between text-sm mb-2">
        <Badge variant="outline" className={
          match.status === 'PROGRAMADO' ? 'text-blue-600 bg-blue-50 border-blue-200' :
          match.status === 'EN_CURSO' ? 'text-orange-600 bg-orange-50 border-orange-200' :
          match.status === 'FINALIZADO' ? 'text-green-600 bg-green-50 border-green-200' :
          'text-red-600 bg-red-50 border-red-200'
        }>
          {match.status}
        </Badge>
        <span className="text-xs text-primary-400">
          Partido #{match.matchNumber}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="flex-1 text-right">
          <span className={`font-semibold ${home?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
            {home?.team?.name || home?.participant?.lastName || 'Equipo Local'}
          </span>
        </div>
        <div className="flex items-center gap-1 font-black text-primary-800 bg-primary-50 px-3 py-1 rounded-lg min-w-[60px] justify-center">
          <span>{formatearMarcador(home, resultType)}</span>
          <span className="text-primary-300">:</span>
          <span>{formatearMarcador(away, resultType)}</span>
        </div>
        <div className="flex-1">
          <span className={`font-semibold ${away?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
            {away?.team?.name || away?.participant?.lastName || 'Equipo Visitante'}
          </span>
        </div>
      </div>
      {match.venue && (
        <p className="text-xs text-primary-400 mt-2 text-center">
          📍 {match.venue.name}
        </p>
      )}
    </div>
  );
}
