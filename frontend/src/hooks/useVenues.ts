// ===========================================
// React Query Hooks — Venues
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  venuesApi, 
  type VenueFilters, 
  type CreateVenuePayload,
  type UpdateVenuePayload
} from '@/api/venues.api';
import { toast } from 'sonner';

export const VENUE_KEYS = {
  all: ['venues'] as const,
  lists: () => [...VENUE_KEYS.all, 'list'] as const,
  list: (filters?: VenueFilters) => [...VENUE_KEYS.lists(), { filters }] as const,
  details: () => [...VENUE_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...VENUE_KEYS.details(), id] as const,
};

export function useVenues(filters?: VenueFilters) {
  return useQuery({
    queryKey: VENUE_KEYS.list(filters),
    queryFn: () => venuesApi.findAll(filters),
  });
}

export function useVenue(id: string) {
  return useQuery({
    queryKey: VENUE_KEYS.detail(id),
    queryFn: () => venuesApi.findOne(id),
    enabled: !!id,
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateVenuePayload) => venuesApi.create(payload),
    onSuccess: () => {
      toast.success('Sede creada exitosamente');
      queryClient.invalidateQueries({ queryKey: VENUE_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al crear la sede');
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVenuePayload }) => 
      venuesApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Sede actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: VENUE_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VENUE_KEYS.detail(variables.id) });
    },
    onError: () => {
      toast.error('Error al actualizar la sede');
    },
  });
}
