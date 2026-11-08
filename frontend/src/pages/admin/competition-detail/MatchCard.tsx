// ===========================================
// MatchCard — tarjeta de un partido del fixture
// ===========================================
import { useState } from 'react';
import { ClipboardPen, MapPin } from 'lucide-react';
import type { Match, ResultType } from '@/types';
import { MATCH_STATUS_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatearMarcador } from './matchScore';
import { esPaseDirecto, nombreDelLado, ordenarLados, rotuloPorDefecto } from './matchSides';
import { MatchResultDialog } from './MatchResultDialog';

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
  puedeCargar = false,
  puedeCorregir = false,
}: {
  match: Match;
  /** Tipo de resultado de la disciplina: define qué clave de `scoreData` leer. */
  resultType: ResultType | undefined;
  /** El rol puede cargar el resultado de un partido sin jugar (`RESULT_LOAD`). */
  puedeCargar?: boolean;
  /**
   * El rol puede corregir un partido ya FINALIZADO. El backend sólo se lo
   * permite a ADMIN_PROVINCIAL y SUPER_ADMIN (CA-C3.4): al resto el botón no se
   * le muestra, porque recibiría un 403.
   */
  puedeCorregir?: boolean;
}) {
  const { izquierda, derecha, hayLocalia } = ordenarLados(match.results);
  const [abierto, setAbierto] = useState(false);
  const finalizado = match.status === 'FINALIZADO';
  const paseDirecto = esPaseDirecto(match.results);
  const tieneCompetidores = (match.results?.length ?? 0) > 0;
  // Un pase directo no tiene marcador: el backend rechaza cargarlo o corregirlo.
  const mostrarAccion =
    tieneCompetidores && !paseDirecto && (finalizado ? puedeCorregir : puedeCargar);

  return (
    <article className="border border-primary-100 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between text-sm mb-2">
        <Badge variant="outline" className={
          match.status === 'PROGRAMADO' ? 'text-primary-700 bg-primary-50 border-primary-200' :
          match.status === 'EN_CURSO' ? 'text-accent-800 bg-accent-50 border-accent-300' :
          match.status === 'FINALIZADO' ? 'text-secondary-700 bg-secondary-50 border-secondary-200' :
          'text-destructive-700 bg-destructive-50 border-destructive/30'
        }>
          {MATCH_STATUS_LABELS[match.status as keyof typeof MATCH_STATUS_LABELS] ?? match.status}
        </Badge>
        <span className="text-xs text-primary-600 tabular-nums">
          Partido #{match.matchNumber}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="flex-1 text-right">
          <span className={`font-semibold ${izquierda?.isWinner ? 'text-success-700' : 'text-primary-900'}`}>
            {nombreDelLado(izquierda, rotuloPorDefecto(0, hayLocalia))}
          </span>
        </div>
        {paseDirecto ? (
          <div className="flex-1 pl-3 text-xs font-semibold text-primary-500">Pasa directo</div>
        ) : (
          <>
            <div className="flex items-center gap-1 font-black tabular-nums text-primary-800 bg-primary-50 px-3 py-1 rounded-lg min-w-[60px] justify-center">
              <span>{formatearMarcador(izquierda, resultType)}</span>
              <span className="text-primary-300">:</span>
              <span>{formatearMarcador(derecha, resultType)}</span>
            </div>
            <div className="flex-1">
              <span className={`font-semibold ${derecha?.isWinner ? 'text-success-700' : 'text-primary-900'}`}>
                {nombreDelLado(derecha, rotuloPorDefecto(1, hayLocalia))}
              </span>
            </div>
          </>
        )}
      </div>
      {match.venue && (
        <p className="text-xs text-primary-500 mt-2 flex items-center justify-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
          {match.venue.name}
        </p>
      )}
      {mostrarAccion && (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant={finalizado ? 'outline' : 'default'}
            className="gap-2"
            onClick={() => setAbierto(true)}
          >
            <ClipboardPen className="w-4 h-4" aria-hidden="true" />
            {finalizado ? 'Corregir resultado' : 'Cargar resultado'}
          </Button>
        </div>
      )}
      {abierto && (
        <MatchResultDialog
          match={match}
          resultType={resultType}
          esCorreccion={finalizado}
          open={abierto}
          onOpenChange={setAbierto}
        />
      )}
    </article>
  );
}
