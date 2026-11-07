// ===========================================
// React Query Hooks — News
// ===========================================
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  newsApi,
  type NewsFilters,
  type CreateNewsPayload,
  type UpdateNewsPayload,
  type ReporteSyncNoticias,
  type UploadNewsImageOptions,
} from '@/api/news.api';
import type { News } from '@/types';
import { newsImageSrc } from '@/lib/news/newsImageRules';
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
  /** Bytes de la imagen subida de un borrador; la URL versionada es parte de la clave. */
  draftImage: (id: string, imageUrl: string) => [...NEWS_KEYS.all, 'draft-image', id, imageUrl] as const,
};

/**
 * `enabled` deja que una página con varias vistas (la portada editorial de
 * `/noticias` y su grilla de resultados) pida sólo la que está mostrando.
 */
export function useNewsList(
  filters?: NewsFilters,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: NEWS_KEYS.list(filters),
    queryFn: () => newsApi.findAll(filters),
    staleTime: STALE_TIME.CATALOG,
    enabled: options.enabled ?? true,
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
const SYNC_TOAST_ID = 'news-sync';

/**
 * Qué miró la corrida, con números reales: cuántos IDs, de cuál a cuál, y si
 * quedó un tramo pendiente para las próximas (el recorrido va de lo más nuevo
 * hacia atrás y tiene tope por corrida).
 */
function detalleDelSync(reporte: ReporteSyncNoticias): string {
  const rango =
    reporte.desdeId === null
      ? 'No había IDs nuevos que revisar en el portal.'
      : `Se revisaron ${reporte.idsRevisados} IDs del portal ` +
        `(entre ${reporte.desdeId} y ${reporte.hastaId}` +
        (reporte.idMasRecientePortal !== null
          ? `; la más reciente publicada es la ${reporte.idMasRecientePortal}).`
          : ').');
  const pendiente = reporte.pendiente
    ? ` Quedan ${reporte.pendiente.hastaId - reporte.pendiente.desdeId + 1} IDs ` +
      `anteriores (${reporte.pendiente.desdeId}-${reporte.pendiente.hastaId}) ` +
      'para las próximas corridas.'
    : '';
  return rango + pendiente;
}

export function useSyncNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => newsApi.sync(),
    // La corrida tarda ~2 min: sin aviso, el botón girando parece colgado.
    onMutate: () => {
      toast.loading('Sincronizando con el portal oficial…', {
        id: SYNC_TOAST_ID,
        description: 'Puede tardar un par de minutos. Podés seguir usando el panel.',
      });
    },
    onSettled: () => {
      toast.dismiss(SYNC_TOAST_ID);
    },
    onSuccess: (reporte: ReporteSyncNoticias) => {
      queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });

      const nuevas = reporte.creadas;
      const detalle = detalleDelSync(reporte);

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

// -------------------------------------------------
// Imagen de la noticia
// -------------------------------------------------

/**
 * Deja el detalle en cache con la respuesta del backend (ya trae la
 * `imageUrl` nueva) y refresca listados y slugs, que la muestran.
 */
function syncNews(queryClient: ReturnType<typeof useQueryClient>, news: News) {
  queryClient.setQueryData(NEWS_KEYS.detail(news.id), news);
  void queryClient.invalidateQueries({ queryKey: NEWS_KEYS.lists() });
  void queryClient.invalidateQueries({ queryKey: NEWS_KEYS.slugs() });
}

/**
 * Sube o reemplaza la imagen de la noticia.
 *
 * Sin toast de error: el uploader explica cada falla en línea (pesada, no es
 * imagen, red, conflicto) con qué hacer, como la foto de sede.
 */
export function useUploadNewsImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file, options }: { id: string; file: File; options?: UploadNewsImageOptions }) =>
      newsApi.uploadImage(id, file, options),
    onSuccess: (news) => {
      syncNews(queryClient, news);
      toast.success('Imagen de la noticia actualizada');
    },
  });
}

export function useDeleteNewsImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => newsApi.deleteImage(id),
    onSuccess: (news) => {
      syncNews(queryClient, news);
      toast.success('Imagen quitada');
    },
    onError: (error: unknown) => {
      toast.error(getFriendlyError(error, 'No se pudo quitar la imagen. Probá de nuevo en un rato.'));
    },
  });
}

/**
 * `src` para MOSTRAR en el panel la imagen actual de una noticia.
 *
 * Publicada o con URL externa: la URL resuelta, directo al `<img>`. Imagen
 * SUBIDA de un borrador: el backend sólo la sirve con sesión, y un `<img>` no
 * manda el token; se pide con Axios y se muestra como `blob:` (que se suelta
 * al cambiar o desmontar).
 */
export function useNewsImagePreviewSrc(news: Pick<News, 'id' | 'imageUrl' | 'imageSource' | 'isPublished'> | null) {
  const direct = news ? newsImageSrc(news.imageUrl) : null;
  const needsSession = Boolean(news && news.imageSource === 'upload' && !news.isPublished && direct);

  const { data: blob } = useQuery({
    queryKey: NEWS_KEYS.draftImage(news?.id ?? '', news?.imageUrl ?? ''),
    queryFn: () => newsApi.fetchImageBlob(news?.id ?? ''),
    enabled: needsSession,
    // La URL lleva la versión: el contenido de esta clave no cambia nunca.
    staleTime: Infinity,
    retry: false,
  });

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!needsSession || !blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, needsSession]);

  return needsSession ? objectUrl : direct;
}
