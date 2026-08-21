// ===========================================
// CalendarEventCard — item del timeline del calendario público
// ===========================================
import { Clock, Sparkles, Trophy } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { getStageStyle } from './eventStageStyles';

interface CalendarEventCardProps {
  event: CalendarEvent;
  /** Posición en la lista ya filtrada: define el delay de la animación y el recorte del eje. */
  index: number;
  isLast: boolean;
}

export function CalendarEventCard({ event, index, isLast }: CalendarEventCardProps) {
  const date = new Date(event.startDate);
  const stageStyle = getStageStyle(event.stage);

  return (
    <div
      className="group relative flex flex-col md:flex-row items-stretch gap-4 md:gap-8 pb-10 last:pb-0 animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Columna Izquierda: Tarjeta de Fecha */}
      <div className="w-full md:w-44 flex-shrink-0 flex md:justify-end">
        <div className="w-full bg-white rounded-2xl border border-primary-100 shadow-sm group-hover:shadow-md group-hover:border-primary-200 transition-all duration-300 overflow-hidden flex flex-col">
          {/* Cabecera del día */}
          <div className="bg-gradient-to-r from-primary-800 to-primary-700 text-white py-1.5 px-3 text-center">
            <span className="font-bold uppercase tracking-wider text-xs block">
              {date.toLocaleDateString('es-AR', { weekday: 'long' })}
            </span>
          </div>
          {/* Cuerpo de la fecha */}
          <div className="p-4 flex flex-col items-center justify-center flex-1 bg-white">
            <span className="text-4xl md:text-5xl font-black text-primary-900 tracking-tight leading-none">
              {date.getDate()}
            </span>
            <span className="text-primary-700 font-semibold text-sm capitalize mt-1">
              {date.toLocaleDateString('es-AR', { month: 'long' })}
            </span>
            <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100/80">
              <Clock className="w-3.5 h-3.5 text-primary-500" />
              <span>
                {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Central: Eje y Nodo de Conexión (Timeline) */}
      <div className="hidden md:flex flex-col items-center relative w-8 flex-shrink-0">
        {/* Línea vertical continua */}
        <div
          className={cn(
            'w-0.5 bg-gradient-to-b from-primary-200 via-celeste-300 to-primary-200 absolute top-0 bottom-0 left-1/2 -translate-x-1/2',
            index === 0 && 'top-6',
            isLast && 'bottom-[calc(100%-2.5rem)]',
          )}
        />

        {/* Nodo de hito conectado */}
        <div className="relative z-10 w-7 h-7 rounded-full bg-white border-2 border-primary-500 shadow-md flex items-center justify-center mt-6 group-hover:scale-110 group-hover:border-accent-500 transition-all duration-300">
          <span className={cn('w-2.5 h-2.5 rounded-full transition-colors duration-300', stageStyle.dot)} />
        </div>
      </div>

      {/* Columna Derecha: Tarjeta de Contenido del Evento */}
      <div className="flex-1 bg-white rounded-2xl p-6 border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group/card">
        {/* Franja lateral de acento de color de la etapa */}
        <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', stageStyle.stripe)} />

        <div>
          {/* Fila superior: Título y Badges */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <h3 className="text-xl font-bold text-primary-900 group-hover/card:text-primary-700 transition-colors leading-snug">
              {event.title}
            </h3>

            {event.stage && (
              <span
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-xs flex-shrink-0',
                  stageStyle.badge,
                )}
              >
                Etapa {event.stage.charAt(0) + event.stage.slice(1).toLowerCase()}
              </span>
            )}
          </div>

          {/* Descripción */}
          {event.description ? (
            <p className="text-primary-600 text-sm leading-relaxed mb-4">
              {event.description}
            </p>
          ) : (
            <p className="text-primary-400 italic text-xs mb-4">
              Evento oficial del cronograma de los Juegos Evita Formosa.
            </p>
          )}
        </div>

        {/* Fila inferior de metadata complementaria */}
        <div className="pt-3 border-t border-primary-50 flex flex-wrap items-center gap-4 text-xs font-medium text-primary-600">
          <div className="flex items-center gap-1.5 text-primary-700">
            <Trophy className="w-3.5 h-3.5 text-accent-500" />
            <span>Competencia Oficial</span>
          </div>
          <div className="flex items-center gap-1.5 text-primary-500 ml-auto">
            <Sparkles className="w-3.5 h-3.5 text-celeste-500" />
            <span>Juegos Evita Formosa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
