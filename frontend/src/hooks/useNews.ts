// ===========================================
// React Query Hooks — News
// ===========================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  newsApi, 
  type NewsFilters, 
  type CreateNewsPayload,
  type UpdateNewsPayload,
  type ReporteSyncNoticias,
} from '@/api/news.api';
import { STALE_TIME } from '@/lib/queryClient';
import { getFriendlyError } from '@/lib/utils';
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
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useNews(id: string) {
  return useQuery({
    queryKey: NEWS_KEYS.detail(id),
    queryFn: () => newsApi.findOne(id),
    enabled: !!id,
    staleTime: STALE_TIME.CATALOG,
  });
}

export function useNewsBySlug(slug: string) {
  return useQuery({
    queryKey: NEWS_KEYS.slug(slug),
    queryFn: () => newsApi.findBySlug(slug),
    enabled: !!slug,
    staleTime: STALE_TIME.CATALOG,
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
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al crear la noticia'));
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
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al actualizar la noticia'));
    },
  });
}

export function useDeleteNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => newsApi.delete(id),
    onSuccess: () => {
      toast.success('Noticia eliminada exitosamente');
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'Error al eliminar la noticia'));
    },
  });
}

/**
 * Disparo manual del sync con el portal oficial (S19).
 *
 * El toast informa **el resultado real**, con números, y no un "listo" fijo: si
 * la corrida miró 60 IDs y no había nada nuevo, eso es lo que tiene que decir.
 * La alternativa —un mensaje de éxito idéntico traiga lo que traiga— es
 * exactamente el modo de falla silenciosa que esta tarea viene a cerrar.
 */
export function useSyncNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => newsApi.sync(),
    onSuccess: (reporte: ReporteSyncNoticias) => {
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });

      const nuevas = reporte.creadas;
      const detalle =
        `Se revisaron ${reporte.paginasLeidas} noticias del portal ` +
        `(IDs ${reporte.desdeId}-${reporte.hastaId}).`;

      if (reporte.estado === 'alerta') {
        toast.warning(
          nuevas > 0
            ? `${nuevas} noticia(s) nueva(s), con advertencias.`
            : 'La sincronización terminó con advertencias.',
          { description: reporte.alertas.join(' · ') || detalle },
        );
        return;
      }

      if (nuevas === 0 && reporte.actualizadas === 0) {
        toast.info('No había noticias nuevas de Juegos Evita.', {
          description: `${detalle} ${reporte.descartadasPorSeccion} eran de otras secciones.`,
        });
        return;
      }

      toast.success(
        `${nuevas} noticia(s) nueva(s) y ${reporte.actualizadas} actualizada(s).`,
        { description: detalle },
      );
    },
    onError: (error: unknown) => {
      // El 503 del backend (portal caído o markup cambiado) llega acá: se
      // muestra el motivo, no un "error al sincronizar" genérico.
      toast.error(
        getFriendlyError(error, 'No se pudo sincronizar con el portal oficial'),
      );
    },
  });
}
