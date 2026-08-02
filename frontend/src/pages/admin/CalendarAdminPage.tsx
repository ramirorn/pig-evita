// ===========================================
// Calendar Admin Page
// ===========================================
import { useState } from 'react';
import { CalendarDays, Search, Plus, Pencil } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';

export function CalendarAdminPage() {
  const [search, setSearch] = useState('');
  const { data: calendarData, isLoading } = useCalendarEvents();

  const filtered = (calendarData?.data || []).filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Calendario"
        description="Gestión de eventos y programación deportiva"
        icon={<CalendarDays className="w-5 h-5 text-white" />}
        actions={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Crear Evento
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar evento por título..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-10 h-10" />}
              title="Sin eventos en calendario"
              description="No hay eventos programados en el calendario."
              action={
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Crear Evento
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="w-[100px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-primary-900">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-primary-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-primary-600">
                      {new Date(item.startDate).toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-primary-600 capitalize">{item.stage || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
