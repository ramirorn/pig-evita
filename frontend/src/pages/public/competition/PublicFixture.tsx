// ===========================================
// PublicFixture — partidos de una competencia, por fecha (F-34)
// ===========================================
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Calendar, CalendarDays, MapPin } from 'lucide-react';
import type { Match, ResultType } from '@/types';
import { ROUTES, MATCH_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { LocalityChip } from '@/components/localityMap/LocalityChip';
import { formatearMarcador } from '@/pages/admin/competition-detail/matchScore';
import {
  esPaseDirecto,
  nombreDelLado,
  ordenarLados,
  rotuloPorDefecto,
} from '@/pages/admin/competition-detail/matchSides';

/**
 * Estado del partido: el color acompaña a la palabra, nunca la reemplaza.
 * Clases completas (nunca interpoladas). Texto 700/800 sobre 50 = AA.
 */
const ESTILO_ESTADO: Record<string, string> = {
  PROGRAMADO: 'text-celeste-800 bg-celeste-50 border-celeste-200',
  EN_CURSO: 'text-warning-800 bg-warning-50 border-warning-200',
  FINALIZADO: 'text-success-800 bg-success-50 border-success-200',
  SUSPENDIDO: 'text-destructive-700 bg-destructive-50 border-destructive-500/30',
};

/** "vie 14 nov · 18:30". `null` si el partido no tiene fecha o es inválida. */
function cuandoSeJuega(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  const dia = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dia.replace(/\./g, '')} · ${hora} hs`;
}

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
      <div className="rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/30 px-4 py-12 text-center">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-primary-400" aria-hidden="true" />
        <h3 className="type-h3 text-primary-900">Fixture sin publicar</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-primary-700">
          Todavía no se cargaron los partidos de esta competencia. Cuando estén, vas a ver acá
          los cruces, los horarios y los resultados.
        </p>
        <Link
          to={ROUTES.CALENDAR}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-800 px-5 py-2.5 text-sm font-bold text-white transition-colors duration-120 hover:bg-primary-900 active:bg-primary-950 pointer-coarse:min-h-11"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Ver el calendario
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {porFecha.map(([round, partidos]) => (
        <section key={round} aria-label={`Fecha ${round}`}>
          <h3 className="type-eyebrow mb-3 text-primary-700 tabular-nums">Fecha {round}</h3>
          <ul className="space-y-2">
            {partidos.map((m) => {
              const { izquierda, derecha, hayLocalia } = ordenarLados(m.results);
              const finalizado = m.status === 'FINALIZADO';
              const paseDirecto = esPaseDirecto(m.results);
              const cuando = cuandoSeJuega(m.scheduledAt);
              const clasesLado = (gano: boolean | undefined) =>
                gano ? 'font-bold text-success-700' : 'font-medium text-primary-900';
              return (
                <li key={m.id} className="rounded-lg border border-primary-100 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="min-w-0 text-xs text-primary-700 tabular-nums">
                      <span className="font-semibold">Partido {m.matchNumber}</span>
                      {cuando && <span className="text-primary-600"> · {cuando}</span>}
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
                        ESTILO_ESTADO[m.status] ?? 'border-primary-200 bg-primary-50 text-primary-800',
                      )}
                    >
                      {m.status === 'EN_CURSO' && (
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-warning-600 motion-safe:animate-pulse"
                        />
                      )}
                      {MATCH_STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm tabular-nums">
                    <span className={cn('min-w-0 text-right break-words', clasesLado(izquierda?.isWinner))}>
                      {nombreDelLado(izquierda, rotuloPorDefecto(0, hayLocalia))}
                      {izquierda?.isWinner && <span className="sr-only"> (ganó)</span>}
                    </span>
                    {paseDirecto ? (
                      <span className="col-span-2 text-xs font-semibold text-primary-700">
                        Pasa directo
                      </span>
                    ) : (
                      <>
                        <span className="min-w-14 rounded-md bg-primary-50 px-2 py-1 text-center font-black text-primary-900">
                          {finalizado
                            ? `${formatearMarcador(izquierda, resultType)} : ${formatearMarcador(derecha, resultType)}`
                            : 'vs'}
                        </span>
                        <span className={cn('min-w-0 break-words', clasesLado(derecha?.isWinner))}>
                          {nombreDelLado(derecha, rotuloPorDefecto(1, hayLocalia))}
                          {derecha?.isWinner && <span className="sr-only"> (ganó)</span>}
                        </span>
                      </>
                    )}
                  </div>

                  {m.venue && (
                    <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-primary-700">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="sr-only">Sede: </span>
                        {m.venue.name}
                      </span>
                      <LocalityChip name={m.venue.locality} />
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
