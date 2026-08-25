// ===========================================
// MatchCard — tarjeta de un partido del fixture
// ===========================================
import type { Match, ResultType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatearMarcador } from './matchScore';
import { ordenarLados } from './matchSides';

/**
 * `results` puede venir incompleto, así que con `noUncheckedIndexedAccess` todo
 * el acceso es opcional y cae a los textos por defecto.
 *
 * Qué equipo va de cada lado lo decide `ordenarLados` a partir de `isHome`, no
 * el orden del arreglo (R23).
 */
export function MatchCard({
  match,
  resultType,
}: {
  match: Match;
  /** Tipo de resultado de la disciplina: define qué clave de `scoreData` leer. */
  resultType: ResultType | undefined;
}) {
  const { izquierda, derecha, hayLocalia } = ordenarLados(match.results);

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
          <span className={`font-semibold ${izquierda?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
            {izquierda?.team?.name ||
              izquierda?.participant?.lastName ||
              (hayLocalia ? 'Equipo Local' : 'Equipo A')}
          </span>
        </div>
        <div className="flex items-center gap-1 font-black text-primary-800 bg-primary-50 px-3 py-1 rounded-lg min-w-[60px] justify-center">
          <span>{formatearMarcador(izquierda, resultType)}</span>
          <span className="text-primary-300">:</span>
          <span>{formatearMarcador(derecha, resultType)}</span>
        </div>
        <div className="flex-1">
          <span className={`font-semibold ${derecha?.isWinner ? 'text-green-700' : 'text-primary-900'}`}>
            {derecha?.team?.name ||
              derecha?.participant?.lastName ||
              (hayLocalia ? 'Equipo Visitante' : 'Equipo B')}
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
