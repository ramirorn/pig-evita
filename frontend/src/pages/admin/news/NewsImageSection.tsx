// ===========================================
// NewsImageSection — "Subir archivo" de la imagen de una noticia
// ===========================================
//
// Reusa el `DocumentUploader` (arrastrar o elegir, vista previa, progreso,
// cancelar, reemplazar, errores accesibles) con las reglas de imagen: JPG, PNG
// o WebP de hasta 5 MB, mensajes propios y reducción con canvas antes de
// subir. Como la foto de sede, la imagen se guarda sola, aparte de los datos
// del formulario.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { News } from '@/types';
import {
  useDeleteNewsImage,
  useNews,
  useNewsImagePreviewSrc,
  useUploadNewsImage,
} from '@/hooks/useNews';
import { usePermisos } from '@/hooks/usePermisos';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/logger';
import type { UploaderRules } from '@/lib/uploads/uploaderRules';
import { optimizeImage } from '@/lib/images/optimizeImage';
import { NEWS_IMAGE_UPLOADER_RULES, newsImageAlt } from '@/lib/news/newsImageRules';

/** Reglas puras + la reducción con canvas (lo único que necesita DOM). */
const NEWS_IMAGE_RULES: UploaderRules = {
  ...NEWS_IMAGE_UPLOADER_RULES,
  prepare: (file) => optimizeImage(file, 'imagen-noticia'),
};

interface NewsImageSectionProps {
  news: News;
}

export function NewsImageSection({ news }: NewsImageSectionProps) {
  const { puede } = usePermisos();
  // El `news` del padre es una foto fija del listado: el detalle en cache es
  // lo que se actualiza al subir o quitar (ver `syncNews`).
  const { data: fresh } = useNews(news.id);
  const current = fresh ?? news;
  const previewSrc = useNewsImagePreviewSrc(current);

  const upload = useUploadNewsImage();
  const remove = useDeleteNewsImage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Mismo permiso que editar la noticia (backend: ACCIONES.NEWS_MANAGE).
  if (!puede('NEWS_MANAGE')) return null;

  const handleRemove = async () => {
    try {
      await remove.mutateAsync(current.id);
      setConfirmOpen(false);
      setAnnouncement('Imagen quitada. La noticia queda sin imagen.');
    } catch (error) {
      logError('NewsImageSection.handleRemove', error);
    }
  };

  return (
    <div className="space-y-2">
      {/* `key` por versión: al cambiar la imagen el uploader arranca limpio y
          muestra la nueva como vigente. */}
      <DocumentUploader
        key={current.imageUrl ?? 'sin-imagen'}
        title="Archivo de imagen"
        hint="Es la portada de la noticia en el sitio. Se guarda apenas termina de subir: no hace falta tocar «Guardar cambios»."
        headingLevel={4}
        rules={NEWS_IMAGE_RULES}
        currentImage={previewSrc ? { src: previewSrc, alt: newsImageAlt(current.title) } : null}
        currentActions={
          current.imageUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive-600 hover:text-destructive-700 hover:bg-destructive-50"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Quitar imagen
            </Button>
          ) : null
        }
        onUpload={async (file, { onProgress, signal }) => {
          setAnnouncement('');
          await upload.mutateAsync({ id: current.id, file, options: { onProgress, signal } });
          setAnnouncement('Imagen de la noticia subida.');
        }}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Quitar la imagen?"
        description={`«${current.title}» va a mostrarse sin imagen en el sitio. Podés subir otra o pegar una URL cuando quieras.`}
        confirmLabel="Sí, quitar"
        pendingLabel="Quitando..."
        onConfirm={handleRemove}
        isLoading={remove.isPending}
      />
    </div>
  );
}
