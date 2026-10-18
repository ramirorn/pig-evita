// ===========================================
// NewsFormDialog — modal de alta y edición de noticias
// ===========================================
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { News } from '@/types';
import { NewsForm } from '../components/NewsForm';
import { NewsImageSection } from './NewsImageSection';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewsFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente ⇒ edición; ausente ⇒ alta. */
  news?: News;
}

/**
 * La imagen SUBIDA necesita el `id` de la noticia, que en el alta no existe
 * hasta guardar. Igual que en sedes, el alta con "Subir archivo" tiene un
 * segundo paso dentro del mismo modal: "Noticia creada, ahora subí la imagen"
 * (opcional). Se eligió esto y no encolar el archivo hasta crear la nota
 * porque así cada error (muy pesada, no es imagen, red) se ve y se reintenta
 * en el mismo uploader de siempre, sin una nota creada a medias en silencio.
 * Con "Pegar URL" la URL viaja en el mismo alta y el modal se cierra.
 */
export function NewsFormDialog({ open, onOpenChange, news }: NewsFormDialogProps) {
  const [createdNews, setCreatedNews] = useState<News | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCreatedNews(null);
    onOpenChange(next);
  };
  const close = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {createdNews ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-secondary-600" aria-hidden="true" />
                Noticia creada
              </>
            ) : news ? (
              'Editar Noticia'
            ) : (
              'Nueva Noticia'
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-primary-500">
            {createdNews
              ? `«${createdNews.title}» ya está guardada. Subí la imagen ahora o hacelo después desde "Editar".`
              : news
                ? 'Modificá el texto, la imagen y el estado de publicación.'
                : 'Escribí la noticia. La imagen podés subirla al crearla o pegar una URL.'}
          </DialogDescription>
        </DialogHeader>

        {createdNews ? (
          <div className="space-y-4 pt-1">
            <NewsImageSection news={createdNews} />
            <div className="flex justify-end pt-3 border-t border-primary-100">
              <Button type="button" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <NewsForm
            initialData={news}
            onSuccess={(saved, imageMode) =>
              !news && imageMode === 'upload' ? setCreatedNews(saved) : close()
            }
            onCancel={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
