// ===========================================
// Calendar Page — Public
// ===========================================
import { CalendarDays, Loader2, Clock } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

const STAGE_BADGE: Record<string, string> = {
  ZONAL: 'bg-celeste-50 text-celeste-700 border-celeste-200',
  DEPARTAMENTAL: 'bg-accent-50 text-accent-700 border-accent-200',
  PROVINCIAL: 'bg-secondary-50 text-secondary-700 border-secondary-200',
};

export function CalendarPage() {
  const { data: calendarData, isLoading } = useCalendarEvents({ isPublished: true });

  return (
    <div>
      <PageHero
        title="Calendario de Eventos"
        description="Conocé las fechas, horarios y sedes de las próximas competencias de los Juegos Evita Formosa."
        icon={<CalendarDays className="w-8 h-8 text-white" />}
        variant="secondary"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : calendarData?.data && calendarData.data.length > 0 ? (
          <div className="space-y-0 max-w-4xl mx-auto timeline-line">
            {calendarData.data.map((event, idx) => {
              const date = new Date(event.startDate);
              return (
                <div
                  key={event.id}
                  className="relative flex flex-col md:flex-row gap-6 pb-8 animate-fade-in"
                  style={{ animationDelay: `${idx * 0.08}s` }}
                >
                  {/* Date card */}
                  <div className="md:w-48 flex-shrink-0 flex flex-col justify-start items-center text-center">
                    <div className="relative z-10 w-full p-4 bg-white rounded-xl border border-primary-100 shadow-sm hover:shadow-md transition-shadow">
                      <span className="text-primary-500 font-bold uppercase text-xs mb-1 block">
                        {date.toLocaleDateString('es-AR', { weekday: 'short' })}
                      </span>
                      <span className="text-4xl font-black text-primary-900 block">
                        {date.getDate()}
                      </span>
                      <span className="text-primary-700 font-medium capitalize mt-1 block">
                        {date.toLocaleDateString('es-AR', { month: 'long' })}
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-2 text-primary-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm font-medium">
                          {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline dot (visible on md+) */}
                  <div className="hidden md:flex absolute left-[6rem] top-6 w-3 h-3 -translate-x-1/2 z-10">
                    <span className="w-3 h-3 rounded-full bg-primary-400 border-2 border-white shadow-sm" />
                  </div>

                  {/* Event content */}
                  <div className="flex-1 card p-6 hover:shadow-lg transition-shadow">
                    <h3 className="text-xl font-bold text-primary-900 mb-2">{event.title}</h3>
                    {event.description && (
                      <p className="text-primary-600 text-sm mb-4 leading-relaxed">{event.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-auto">
                      {event.stage && (
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border',
                            STAGE_BADGE[event.stage] || 'bg-primary-50 text-primary-700 border-primary-200',
                          )}
                        >
                          Etapa {event.stage.charAt(0) + event.stage.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarDays className="w-10 h-10" />}
            title="Sin eventos"
            description="No hay eventos programados en este momento. ¡Próximamente se publicará el calendario!"
          />
        )}
      </div>
    </div>
  );
}
