// ===========================================
// React Query Hooks — Calendar
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  calendarApi, 
  type CalendarFilters, 
  type CreateCalendarEventPayload,
  type UpdateCalendarEventPayload
} from '@/api/calendar.api';
import { STALE_TIME } from '@/lib/queryClient';
import { fetchAllPages } from '@/lib/fetchAllPages';
import { getFriendlyError } from '@/lib/utils';
import { toast } from 'sonner';

export const CALENDAR_KEYS = {
  all: ['calendar'] as const,
  lists: () => [...CALENDAR_KEYS.all, 'list'] as const,
  list: (filters?: CalendarFilters) => [...CALENDAR_KEYS.lists(), { filters }] as const,
  listAll: (filters: CalendarFilters) => [...CALENDAR_KEYS.lists(), 'all', filters] as const,
  details: () => [...CALENDAR_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CALENDAR_KEYS.details(), id] as const,
};

export function useCalendarEvents(filters?: CalendarFilters) {
  return useQuery({
    queryKey: CALENDAR_KEYS.list(filters),
    queryFn: () => calendarApi.findAll(filters),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

/**
 * Todos los eventos que matchean el filtro, recorriendo la paginación hasta el
 * final.
 *
 * El calendario público filtra en el cliente (mes, etapa, disciplina, texto) y
 * lo hacía sobre un `limit: 100`, que es además el tope duro del backend: el
 * evento 101 no existía para el calendario, y el `EmptyState` decía "no se
 * encontraron eventos con los filtros seleccionados" cuando lo cierto era "no
 * hay eventos entre los 100 que trajimos" (R29). Devuelve el arreglo directo
 * porque ya no queda paginación de la que hablar.
 */
export function useAllCalendarEvents(filters: CalendarFilters = {}) {
  return useQuery({
    queryKey: CALENDAR_KEYS.listAll(filters),
    queryFn: () =>
      fetchAllPages((page, limit) => calendarApi.findAll({ ...filters, page, limit })),
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: CALENDAR_KEYS.detail(id),
    queryFn: () => calendarApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.OPERATIONAL,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCalendarEventPayload) => calendarApi.create(payload),
    onSuccess: () => {
      toast.success('Evento creado exitosamente');
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear el evento'));
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCalendarEventPayload }) => 
      calendarApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Evento actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.detail(variables.id) });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar el evento'));
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calendarApi.delete(id),
    onSuccess: () => {
      toast.success('Evento eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al eliminar el evento'));
    },
  });
}
