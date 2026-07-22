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
import { toast } from 'sonner';

export const CALENDAR_KEYS = {
  all: ['calendar'] as const,
  lists: () => [...CALENDAR_KEYS.all, 'list'] as const,
  list: (filters?: CalendarFilters) => [...CALENDAR_KEYS.lists(), { filters }] as const,
  details: () => [...CALENDAR_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...CALENDAR_KEYS.details(), id] as const,
};

export function useCalendarEvents(filters?: CalendarFilters) {
  return useQuery({
    queryKey: CALENDAR_KEYS.list(filters),
    queryFn: () => calendarApi.findAll(filters),
  });
}

export function useCalendarEvent(id: string) {
  return useQuery({
    queryKey: CALENDAR_KEYS.detail(id),
    queryFn: () => calendarApi.findOne(id),
    enabled: !!id,
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
    onError: () => {
      toast.error('Error al crear el evento');
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
    onError: () => {
      toast.error('Error al actualizar el evento');
    },
  });
}
