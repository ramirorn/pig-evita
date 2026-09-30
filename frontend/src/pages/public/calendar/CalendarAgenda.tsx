// ===========================================
// CalendarAgenda — "Próximos eventos" / "Ya se disputaron" como agenda por mes
// ===========================================
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { getStageStyle } from './eventStageStyles';
import { esMismoDia } from './calendarSecciones';
import {
  agruparPorMes,
  diaDeSemanaCorto,
  etiquetaDeEtapa,
  horaCorta,
  lineaDeDetalle,
  rangoDeDias,
} from './agendaPorMes';

interface CalendarAgendaProps {
  /** Los eventos de la sección, ya ordenados (próximos ↑, pasados ↓). */
  eventos: readonly CalendarEvent[];
  /**
   * Nombres de sede y disciplina ya resueltos por la página.
   *
   * ⚠️ Llegan resueltos y no como relación porque `CalendarEvent` no tiene
   * `@relation` con `Venue` ni con `Discipline` en `schema.prisma` (ver U13):
   * la página cruza contra los catálogos, que son chicos y ya están en cache.
   * Un id que no resuelve (sede dada de baja) no produce texto: nada de "Sede a
   * confirmar", que sería inventar.
   */
  nombreDeSede: (event: CalendarEvent) => string | null;
  nombreDeDisciplina: (event: CalendarEvent) => string | null;
  /** "Ya se disputaron": se atenúa, no se oculta. */
  esPasado: boolean;
  /** Para marcar el día de hoy. Se recibe para que el render sea determinista. */
  hoy: Date;
}

/**
 * La agenda: un encabezado por mes (fijo arriba al scrollear) y una fila
 * compacta por evento. El día se escribe una sola vez aunque tenga varios
 * eventos.
 *
 * Reemplaza a las tarjetas con columna de fecha y línea de tiempo: con más de
 * un puñado de eventos ocupaban tres pantallas para decir fecha, hora, título y
 * sede.
 *
 * Encabezados: el `h2` de la sección lo pone la página; cada mes es un `h3`.
 * Los eventos son ítems de lista, no encabezados, para que el esquema del
 * documento no tenga un nivel por cada evento.
 */
export function CalendarAgenda({ eventos, nombreDeSede, nombreDeDisciplina, esPasado, hoy }: CalendarAgendaProps) {
  const meses = agruparPorMes(eventos);

  return (
    <div className={cn('space-y-6', esPasado && 'opacity-75')}>
      {meses.map((mes) => (
        <section key={mes.clave} aria-labelledby={`agenda-${esPasado ? 'pasados' : 'proximos'}-${mes.clave}`}>
          {/* Fijo debajo de la barra del sitio (h-16) al hacer scroll. */}
          <h3
            id={`agenda-${esPasado ? 'pasados' : 'proximos'}-${mes.clave}`}
            className="sticky top-16 z-10 border-b-2 border-primary-200 bg-surface/95 py-2 text-sm font-bold uppercase tracking-widest text-primary-800 backdrop-blur"
          >
            {mes.titulo}
          </h3>

          <ol className="divide-y divide-primary-100">
            {mes.dias.map((dia) => {
              const fechaValida = !Number.isNaN(dia.fecha.getTime());
              const esHoy = !esPasado && fechaValida && esMismoDia(dia.fecha, hoy);
              return (
                <li
                  key={dia.clave}
                  className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4"
                >
                  {/* Día: se escribe una vez aunque haya varios eventos. */}
                  <div className="pt-1 text-center sm:text-left">
                    {fechaValida && (
                      <>
                        <p className="text-[11px] font-bold tracking-wider text-primary-600">
                          {diaDeSemanaCorto(dia.fecha)}
                        </p>
                        <p className="font-display text-2xl font-black leading-none text-primary-900">
                          <time dateTime={dia.clave}>{dia.fecha.getDate()}</time>
                        </p>
                      </>
                    )}
                    {esHoy && (
                      // accent-500 sobre primary-900 = 7.96:1.
                      <span className="mt-1 inline-block rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-900">
                        Hoy
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1">
                    {dia.eventos.map((evento) => (
                      <FilaDeEvento
                        key={evento.id}
                        evento={evento}
                        sede={nombreDeSede(evento)}
                        disciplina={nombreDeDisciplina(evento)}
                      />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function FilaDeEvento({
  evento,
  sede,
  disciplina,
}: {
  evento: CalendarEvent;
  sede: string | null;
  disciplina: string | null;
}) {
  const inicio = new Date(evento.startDate);
  const fechaValida = !Number.isNaN(inicio.getTime());
  const rango = rangoDeDias(evento);
  const etapa = etiquetaDeEtapa(evento.stage);
  const detalle = lineaDeDetalle([sede, etapa, disciplina]);
  const estiloEtapa = getStageStyle(evento.stage);

  return (
    <li className="grid gap-x-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-primary-50/70 focus-within:bg-primary-50/70 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
      {fechaValida && (
        <p className="text-sm font-semibold tabular-nums text-primary-700 sm:pt-0.5">
          <time dateTime={evento.startDate}>{horaCorta(inicio)}</time>
        </p>
      )}
      <div className={fechaValida ? 'min-w-0' : 'min-w-0 sm:col-start-2'}>
        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold leading-snug text-primary-900">
          <span className="min-w-0 break-words">{evento.title}</span>
          {rango && (
            <span className="rounded-md bg-celeste-100 px-1.5 py-0.5 text-xs font-semibold text-celeste-800">
              {rango}
            </span>
          )}
        </p>
        {detalle.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-primary-600">
            {etapa && <span aria-hidden="true" className={cn('inline-block h-2 w-2 shrink-0 rounded-full', estiloEtapa.dot)} />}
            <span className="min-w-0 break-words">{detalle.join(' · ')}</span>
          </p>
        )}
        {evento.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-primary-600">{evento.description}</p>
        )}
      </div>
    </li>
  );
}

/** Esqueleto con la forma de la agenda (sin saltos de alto al cargar). */
export function CalendarAgendaSkeleton() {
  return (
    <div className="max-w-4xl space-y-3" aria-hidden="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-primary-100" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
          <div className="h-12 animate-pulse rounded-lg bg-primary-50" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-primary-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-primary-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
