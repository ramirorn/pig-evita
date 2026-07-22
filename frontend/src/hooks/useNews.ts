// ===========================================
// React Query Hooks — News
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  newsApi, 
  type NewsFilters, 
  type CreateNewsPayload,
  type UpdateNewsPayload
} from '@/api/news.api';
import { toast } from 'sonner';

export const NEWS_KEYS = {
  all: ['news'] as const,
  lists: () => [...NEWS_KEYS.all, 'list'] as const,
  list: (filters?: NewsFilters) => [...NEWS_KEYS.lists(), { filters }] as const,
  details: () => [...NEWS_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...NEWS_KEYS.details(), id] as const,
  slugs: () => [...NEWS_KEYS.all, 'slug'] as const,
  slug: (slug: string) => [...NEWS_KEYS.slugs(), slug] as const,
};

export function useNewsList(filters?: NewsFilters) {
  return useQuery({
    queryKey: NEWS_KEYS.list(filters),
    queryFn: () => newsApi.findAll(filters),
  });
}

export function useNews(id: string) {
  return useQuery({
    queryKey: NEWS_KEYS.detail(id),
    queryFn: () => newsApi.findOne(id),
    enabled: !!id,
  });
}

export function useNewsBySlug(slug: string) {
  return useQuery({
    queryKey: NEWS_KEYS.slug(slug),
    queryFn: () => newsApi.findBySlug(slug),
    enabled: !!slug,
  });
}

export function useCreateNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateNewsPayload) => newsApi.create(payload),
    onSuccess: () => {
      toast.success('Noticia creada exitosamente');
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });
    },
    onError: () => {
      toast.error('Error al crear la noticia');
    },
  });
}

export function useUpdateNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateNewsPayload }) => 
      newsApi.update(id, payload),
    onSuccess: (_, variables) => {
      toast.success('Noticia actualizada exitosamente');
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.slugs() });
    },
    onError: () => {
      toast.error('Error al actualizar la noticia');
    },
  });
}
