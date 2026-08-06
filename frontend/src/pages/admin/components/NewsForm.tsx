// ===========================================
// News Form Component
// ===========================================
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Newspaper, FileText, Image as ImageIcon, Send } from 'lucide-react';
import { newsSchema, type NewsFormValues } from '@/schemas';
import { useCreateNews, useUpdateNews } from '@/hooks/useNews';
import type { News } from '@/types';

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

interface NewsFormProps {
  initialData?: News;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NewsForm({ initialData, onSuccess, onCancel }: NewsFormProps) {
  const createMutation = useCreateNews();
  const updateMutation = useUpdateNews();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema) as any,
    defaultValues: {
      title: initialData?.title || '',
      excerpt: initialData?.excerpt || '',
      content: initialData?.content || '',
      imageKey: initialData?.imageKey || '',
      isPublished: initialData?.isPublished ?? false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        title: initialData.title,
        excerpt: initialData.excerpt || '',
        content: initialData.content,
        imageKey: initialData.imageKey || '',
        isPublished: initialData.isPublished,
      });
    }
  }, [initialData, form]);

  const onSubmit = async (values: NewsFormValues) => {
    try {
      const payload = {
        title: values.title.trim(),
        excerpt: values.excerpt ? values.excerpt.trim() : undefined,
        content: values.content.trim(),
        imageKey: values.imageKey ? values.imageKey.trim() : undefined,
        isPublished: values.isPublished,
      };

      if (initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch (error) {
      console.error(error);
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

        {/* URL o Clave de Imagen */}
        <FormField
          control={form.control as any}
          name="imageKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-primary-900 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-primary-600" />
                Imagen de Portada (URL o clave)
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Ej. https://miservidor.com/imagen.jpg" 
                  className="bg-white h-10" 
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormDescription className="text-[11px] text-primary-500">
                Opcional. Enlace a la imagen principal del artículo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
