// ===========================================
// UpcomingEventsPanel — "Próximos eventos" junto al carrusel de /noticias
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { getStageStyle } from '../calendar/eventStageStyles';
import {
  claveDia,
  diaDeSemanaCorto,
  etiquetaDeEtapa,
  fechaLarga,
  horaCorta,
  mesCorto,
} from '../calendar/agendaPorMes';

interface UpcomingEventsPanelProps {
  /** Ya recortados y ordenados por `proximosEventos`. */
  eventos: readonly CalendarEvent[];
  /** Nombre de sede por id, resuelto contra el catálogo (ver U13 en CalendarPage). */
  sedePorId: ReadonlyMap<string, string>;
  estado: 'cargando' | 'error' | 'listo';
}

/**
 * Panel oscuro a la derecha del carrusel.
 *
 * ⚠️ En el diseño de referencia este lugar es "Top Scores" (resultados de
 * partidos). La plataforma no publica marcadores en vivo, pero sí tiene un
 * calendario real: el panel muestra **los próximos eventos publicados**, con los
 * datos que el evento trae —fecha, hora, título, sede y etapa si existen—. Los
 * escudos y las ligas de la referencia no tienen equivalente y no se inventan.
 *
 * Sin eventos próximos el panel **no se esconde** (dejaría un hueco junto al
 * carrusel): dice que no hay y lleva al calendario.
 *
 * Los renglones no son enlaces: el calendario no tiene página de detalle por
 * evento. El único destino real es el calendario completo ("Ver todos").
 */
export function UpcomingEventsPanel({ eventos, sedePorId, estado }: UpcomingEventsPanelProps) {
  return (
    <section
      aria-labelledby="proximos-eventos-titulo"
      className="flex h-full flex-col rounded-2xl bg-primary-900 p-5 text-white shadow-sm lg:rounded-l-none"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="proximos-eventos-titulo"
          className="font-display text-lg font-bold text-white"
        >
          Próximos eventos
        </h2>
        <Link
          to="/calendario"
          className="rounded-md text-sm font-semibold text-primary-100 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        >
          Ver todos<span className="sr-only"> los eventos del calendario</span>
        </Link>
      </div>

      {estado === 'cargando' ? (
        <ul aria-hidden="true" className="flex flex-col divide-y divide-white/10">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="py-3">
              <div className="mb-2 h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/15" />
            </li>
          ))}
        </ul>
      ) : estado === 'error' || eventos.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3 py-6">
          <CalendarDays className="h-8 w-8 text-primary-200" aria-hidden="true" />
          <p className="text-sm text-primary-100">
            {estado === 'error'
              ? 'No pudimos cargar el calendario en este momento.'
              : 'No hay eventos próximos publicados por ahora.'}
          </p>
          <Link
            to="/calendario"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-primary-900 transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            Ir al calendario
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-white/10">
          {eventos.map((evento) => (
            <RenglonDeEvento
              key={evento.id}
              evento={evento}
              sede={evento.venueId ? (sedePorId.get(evento.venueId) ?? null) : null}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function RenglonDeEvento({ evento, sede }: { evento: CalendarEvent; sede: string | null }) {
  const inicio = new Date(evento.startDate);
  const fechaValida = !Number.isNaN(inicio.getTime());
  const estilo = getStageStyle(evento.stage);
  const etapa = estilo ? etiquetaDeEtapa(evento.stage) : null;

  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-primary-100">
          {fechaValida ? (
            <time dateTime={claveDia(inicio)}>
              <span aria-hidden="true">
                {diaDeSemanaCorto(inicio)} {inicio.getDate()} {mesCorto(inicio)}
              </span>
              <span className="sr-only">{fechaLarga(inicio)}</span>
            </time>
          ) : (
            <span>Fecha a confirmar</span>
          )}
          {estilo && etapa && (
            // Las clases del chip son las del calendario (contraste ≥ 5.87:1
            // sobre su propio fondo), así que también se leen sobre el panel.
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-px text-[11px] font-bold leading-4',
                estilo.chip,
              )}
            >
              <span className="sr-only">Etapa </span>
              {etapa}
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm leading-snug font-bold text-white">{evento.title}</p>
        {sede && (
          <p className="mt-1 flex items-center gap-1 text-xs text-primary-200">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">Sede: </span>
            <span className="truncate">{sede}</span>
          </p>
        )}
      </div>
      {fechaValida && (
        <span className="font-display shrink-0 text-lg leading-none font-bold text-white tabular-nums">
          <time dateTime={evento.startDate}>{horaCorta(inicio)}</time>
          <span className="sr-only"> hs</span>
        </span>
      )}
    </li>
  );
}
