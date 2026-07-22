// ===========================================
// Calendar Admin Page
// ===========================================
import { useState } from 'react';
import { CalendarDays, Search, Plus, Loader2 } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CalendarAdminPage() {
  const [search, setSearch] = useState('');
  const { data: calendarData, isLoading } = useCalendarEvents();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Calendario</h1>
            <p className="text-sm text-primary-500">Gestión de eventos y programación</p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Crear Evento
        </Button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar evento por título..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-primary-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Cargando eventos...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="px-6 py-3">Evento</th>
                  <th className="px-6 py-3">Fecha y Hora</th>
                  <th className="px-6 py-3">Sede</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {calendarData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-primary-500">
                      No se encontraron eventos.
                    </td>
                  </tr>
                ) : (
                  calendarData?.data.map((event) => (
                    <tr key={event.id} className="hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary-900">
                        {event.title}
                      </td>
                      <td className="px-6 py-4 text-primary-600">
                        {new Date(event.startDate).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-primary-600">
                        {event.venueId ? 'Sede asignada' : 'Sin sede'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
