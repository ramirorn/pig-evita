import { CalendarDays, Loader2 } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';

export function CalendarPage() {
  const { data: calendarData, isLoading } = useCalendarEvents({ isPublished: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800 mb-4">Calendario de Eventos</h1>
        <p className="text-primary-600 max-w-2xl mx-auto text-lg">
          Conocé las fechas, horarios y sedes de las próximas competencias de los Juegos Evita Formosa.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl mx-auto">
          {calendarData?.data.map((event) => (
            <div key={event.id} className="card p-6 flex flex-col md:flex-row gap-6 hover:shadow-lg transition-shadow">
              <div className="md:w-48 flex flex-col justify-center items-center text-center p-4 bg-primary-50 rounded-xl border border-primary-100">
                <span className="text-primary-500 font-bold uppercase text-xs mb-1">
                  {new Date(event.startDate).toLocaleDateString('es-AR', { weekday: 'short' })}
                </span>
                <span className="text-4xl font-black text-primary-900">
                  {new Date(event.startDate).getDate()}
                </span>
                <span className="text-primary-700 font-medium capitalize mt-1">
                  {new Date(event.startDate).toLocaleDateString('es-AR', { month: 'long' })}
                </span>
                <span className="text-primary-500 text-sm mt-2 font-medium">
                  {new Date(event.startDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                </span>
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="text-xl font-bold text-primary-900 mb-2">{event.title}</h3>
                {event.description && (
                  <p className="text-primary-600 text-sm mb-4">{event.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm mt-auto">
                  {event.stage && (
                    <div className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-primary-100 text-primary-700">
                      Etapa {event.stage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {calendarData?.data.length === 0 && (
            <div className="py-12 text-center text-primary-500 bg-white rounded-2xl border border-primary-100">
              No hay eventos programados en este momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
