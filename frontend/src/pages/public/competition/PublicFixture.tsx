// ===========================================
// PublicFixture — partidos de una competencia, por fecha (F-34)
// ===========================================
import { useMemo } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import type { Match, ResultType } from '@/types';
import { MATCH_STATUS_LABELS } from '@/lib/constants';
import { formatearMarcador } from '@/pages/admin/competition-detail/matchScore';
import {
  esPaseDirecto,
  nombreDelLado,
  ordenarLados,
  rotuloPorDefecto,
} from '@/pages/admin/competition-detail/matchSides';

const ESTILO_ESTADO: Record<string, string> = {
  PROGRAMADO: 'text-blue-700 bg-blue-50 border-blue-200',
  EN_CURSO: 'text-orange-700 bg-orange-50 border-orange-200',
  FINALIZADO: 'text-green-700 bg-green-50 border-green-200',
  SUSPENDIDO: 'text-red-700 bg-red-50 border-red-200',
};

/**
 * Lista los partidos que ya trae `GET /competitions/:id` (`MATCH_PUBLIC`):
 * fecha, competidores, marcador cuando está finalizado y estado.
 */
export function PublicFixture({
  matches,
  resultType,
}: {
  matches: Match[];
  resultType: ResultType | undefined;
}) {
  const porFecha = useMemo(() => {
    const grupos = new Map<number, Match[]>();
    for (const m of matches) {
      const g = grupos.get(m.round);
      if (g) g.push(m);
      else grupos.set(m.round, [m]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a - b);
  }, [matches]);

  if (matches.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-primary-200 rounded-xl bg-primary-50/30">
        <Calendar className="w-12 h-12 text-primary-300 mx-auto mb-3" />
        <h3 className="type-h3 text-primary-900">Fixture sin publicar</h3>
        <p className="text-primary-600 text-sm mt-2 max-w-sm mx-auto">
          Todavía no se generaron los partidos de esta competencia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {porFecha.map(([round, partidos]) => (
        <section key={round} aria-label={`Fecha ${round}`}>
          <h3 className="type-eyebrow text-primary-600 mb-3 tabular-nums">
            Fecha {round}
          </h3>
          <ul className="space-y-2">
            {partidos.map((m) => {
              const { izquierda, derecha, hayLocalia } = ordenarLados(m.results);
              const finalizado = m.status === 'FINALIZADO';
              const paseDirecto = esPaseDirecto(m.results);
              return (
                <li
                  key={m.id}
                  className="border border-primary-100 rounded-lg p-3 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs text-primary-600 tabular-nums">Partido #{m.matchNumber}</span>
                    <span
                      className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${ESTILO_ESTADO[m.status] ?? ''}`}
                    >
                      {MATCH_STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm tabular-nums">
                    <span
                      className={`flex-1 min-w-0 text-right break-words ${izquierda?.isWinner ? 'font-bold text-green-700' : 'font-medium text-primary-900'}`}
                    >
                      {nombreDelLado(izquierda, rotuloPorDefecto(0, hayLocalia))}
                    </span>
                    {paseDirecto ? (
                      <span className="flex-1 min-w-0 text-xs font-semibold text-primary-600">
                        Pasa directo
                      </span>
                    ) : (
                      <>
                        <span className="shrink-0 font-black text-primary-800 bg-primary-50 px-2 py-1 rounded-md min-w-[56px] text-center">
                          {finalizado
                            ? `${formatearMarcador(izquierda, resultType)} : ${formatearMarcador(derecha, resultType)}`
                            : 'vs'}
                        </span>
                        <span
                          className={`flex-1 min-w-0 break-words ${derecha?.isWinner ? 'font-bold text-green-700' : 'font-medium text-primary-900'}`}
                        >
                          {nombreDelLado(derecha, rotuloPorDefecto(1, hayLocalia))}
                        </span>
                      </>
                    )}
                  </div>
                  {m.venue && (
                    <p className="mt-2 flex items-center justify-center gap-1 text-xs text-primary-600">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {m.venue.name}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
