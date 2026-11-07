// ===========================================
// News Form Component
// ===========================================
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Loader2,
  Newspaper,
  FileText,
  Image as ImageIcon,
  ImageOff,
  Link2,
  Send,
  Upload,
} from 'lucide-react';
import { newsSchema, type NewsFormValues } from '@/schemas';
import { useCreateNews, useNews, useUpdateNews } from '@/hooks/useNews';
import type { CreateNewsPayload } from '@/api/news.api';
import type { News } from '@/types';
import { safeImageSrc } from '@/lib/utils';
import {
  imageKeyForPayload,
  isValidExternalImageUrl,
  type NewsImageSource,
} from '@/lib/news/newsImageRules';
import { NewsImageSection } from '../news/NewsImageSection';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logError } from '@/lib/logger';

interface NewsFormProps {
  initialData?: News;
  /**
   * `imageMode` es la pestaña de imagen con la que se guardó: en el alta con
   * "Subir archivo", el diálogo sigue abierto para subirla (necesita el id).
   */
  onSuccess?: (saved: News, imageMode: NewsImageSource) => void;
  onCancel?: () => void;
}

/** URL del campo "Pegar URL": la vigente si es externa; si no, vacía. */
function urlInicial(news: Pick<News, 'imageSource' | 'imageUrl'> | undefined): string {
  return news?.imageSource === 'url' ? (news.imageUrl ?? '') : '';
}

/** Pestaña inicial: "Pegar URL" sólo si la imagen vigente es una URL. */
function modoInicial(news: Pick<News, 'imageSource'> | undefined): NewsImageSource {
  return news?.imageSource === 'url' ? 'url' : 'upload';
}

export function NewsForm({ initialData, onSuccess, onCancel }: NewsFormProps) {
  const createMutation = useCreateNews();
  const updateMutation = useUpdateNews();
  // El detalle en cache es lo que cambia al subir o quitar la imagen (lo
  // actualiza la sección de subida): `initialData` es una foto del listado.
  const { data: fresh } = useNews(initialData?.id ?? '');
  const current = initialData ? (fresh ?? initialData) : undefined;
  const currentSource = current?.imageSource ?? null;
  const currentUrl = current?.imageUrl ?? null;

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema) as any,
    defaultValues: {
      title: initialData?.title || '',
      excerpt: initialData?.excerpt || '',
      content: initialData?.content || '',
      imageMode: modoInicial(initialData),
      imageUrl: urlInicial(initialData),
      isPublished: initialData?.isPublished ?? false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        title: initialData.title,
        excerpt: initialData.excerpt || '',
        content: initialData.content,
        imageMode: modoInicial(initialData),
        imageUrl: urlInicial(initialData),
        isPublished: initialData.isPublished,
      });
    }
  }, [initialData, form]);

  // Si la imagen cambió por una subida (o se quitó), el campo de URL deja de
  // mostrar la URL vieja: ya no es la vigente.
  useEffect(() => {
    if (!initialData) return;
    form.setValue('imageUrl', currentSource === 'url' ? (currentUrl ?? '') : '');
  }, [initialData, currentSource, currentUrl, form]);

  const imageMode: NewsImageSource = form.watch('imageMode') === 'url' ? 'url' : 'upload';
  const typedUrl = form.watch('imageUrl') ?? '';

  const onSubmit = async (values: NewsFormValues) => {
    try {
      const mode: NewsImageSource = values.imageMode === 'url' ? 'url' : 'upload';
      const payload: CreateNewsPayload = {
        title: values.title.trim(),
        excerpt: values.excerpt ? values.excerpt.trim() : undefined,
        content: values.content.trim(),
        isPublished: values.isPublished,
      };
      // Sólo "Pegar URL" manda imagen; la subida se guarda sola. Un campo
      // vacío no borra una imagen subida (ver `imageKeyForPayload`).
      const imageKey = imageKeyForPayload({
        mode,
        value: values.imageUrl,
        currentSource,
        currentUrl,
      });
      if (imageKey !== undefined) payload.imageKey = imageKey;

      const saved = initialData
        ? await updateMutation.mutateAsync({ id: initialData.id, payload })
        : await createMutation.mutateAsync(payload);
      onSuccess?.(saved, mode);
    } catch (error) {
      logError('NewsForm.onSubmit', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4 pt-1">
        {/* Título */}
        <FormField
          control={form.control as any}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-primary-600" />
                Título de la Noticia *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej. Gran inauguración de los Juegos Evita Formosa 2026"
                  className="bg-white h-10"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Resumen / Bajada (Excerpt) */}
        <FormField
          control={form.control as any}
          name="excerpt"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary-600" />
                Resumen / Copete
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Breve introducción o resumen para mostrar en la tarjeta de inicio..."
                  className="bg-white resize-none min-h-[60px]"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormDescription className="text-[11px] text-primary-500">
                Opcional. Se mostrará en listados y vistas previas.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contenido Completo */}
        <FormField
          control={form.control as any}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary-600" />
                Cuerpo de la Noticia *
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Escribe el cuerpo completo del artículo o comunicado..."
                  className="bg-white resize-y min-h-[140px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Imagen de la noticia: subir un archivo o pegar una URL */}
        <fieldset className="space-y-2 rounded-lg border border-primary-200/80 bg-white p-3">
          <legend className="px-1 text-xs font-semibold text-primary-900 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
            Imagen de la noticia
          </legend>
          <p className="text-[11px] text-primary-500">
            Opcional. Es la portada de la noticia en el sitio público.
          </p>

          <Tabs
            value={imageMode}
            onValueChange={(value) =>
              form.setValue('imageMode', value === 'url' ? 'url' : 'upload', { shouldDirty: true })
            }
          >
            <TabsList aria-label="Cómo cargar la imagen">
              <TabsTrigger value="upload" className="gap-1.5">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Subir archivo
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                Pegar URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="pt-2">
              {current ? (
                <NewsImageSection news={current} />
              ) : (
                <p className="rounded-lg border border-dashed border-primary-200 bg-primary-50 p-3 text-xs text-primary-700">
                  Vas a poder subir la imagen apenas crees la noticia: el formulario queda abierto
                  para que la elijas. JPG, PNG o WebP de hasta 5 MB.
                </p>
              )}
            </TabsContent>

            <TabsContent value="url" className="pt-2 space-y-2">
              <FormField
                control={form.control as any}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-primary-900">
                      Dirección de la imagen
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        inputMode="url"
                        placeholder="Ej. https://sitio.gob.ar/imagen.jpg"
                        className="bg-white h-10"
                        name={field.name}
                        ref={field.ref}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-primary-500">
                      {currentSource === 'upload'
                        ? 'Ahora la noticia tiene una imagen subida. Si guardás una URL, la reemplaza y la subida se borra.'
                        : 'Tiene que empezar con https://. Si la dejás vacía y guardás, la noticia queda sin imagen.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <UrlPreview url={typedUrl} />
            </TabsContent>
          </Tabs>
        </fieldset>

        {/* Estado Publicado */}
        <FormField
          control={form.control as any}
          name="isPublished"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary-200/80 p-3 bg-white">
              <div className="space-y-0.5">
                <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5 cursor-pointer">
                  <Send className="w-4 h-4 text-primary-600" />
                  Publicar Inmediatamente
                </FormLabel>
                <FormDescription className="text-[11px] text-primary-500">
                  Si está marcado, el artículo será visible para todo el público en el portal.
                </FormDescription>
              </div>
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-primary-100">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 cursor-pointer min-w-[140px]"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {initialData ? 'Guardar Cambios' : 'Crear Noticia'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * Vista previa de la URL pegada. Sólo se pinta una dirección `https://` válida
 * (la misma regla que el backend y que la página pública); si no carga, se
 * dice en vez de mostrar el ícono de imagen rota.
 */
function UrlPreview({ url }: { url: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = isValidExternalImageUrl(url) ? safeImageSrc(url.trim()) : null;
  if (!src) return null;

  if (failedSrc === src) {
    return (
      <div className="flex aspect-video w-full max-w-sm flex-col items-center justify-center gap-1 rounded-xl border border-primary-100 bg-primary-50 p-3 text-center text-xs text-primary-600">
        <ImageOff className="w-6 h-6 text-primary-500" aria-hidden="true" />
        No se pudo cargar la imagen de esa dirección. Revisá que sea pública y que sea una imagen.
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Vista previa de la imagen pegada"
      width={384}
      height={216}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className="aspect-video w-full max-w-sm rounded-xl border border-primary-100 bg-primary-50 object-cover"
    />
  );
}
