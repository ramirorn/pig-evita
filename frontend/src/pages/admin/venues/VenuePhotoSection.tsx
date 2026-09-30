// ===========================================
// VenuePhotoSection — "Foto de la sede" en el panel
// ===========================================
//
// Reusa el `DocumentUploader` (arrastrar, vista previa, progreso, cancelar,
// reemplazar, errores accesibles) con las reglas de la foto de sede: JPG, PNG
// o WebP de hasta 5 MB, mensajes propios y reducción con canvas antes de subir.
// La foto se guarda sola, aparte de los datos del formulario.
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Venue } from '@/types';
import { useDeleteVenueImage, useUploadVenueImage, useVenue } from '@/hooks/useVenues';
import { usePermisos } from '@/hooks/usePermisos';
import { DocumentUploader } from '@/components/shared/DocumentUploader';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/apiBase';
import { logError } from '@/lib/logger';
import type { UploaderRules } from '@/lib/uploads/uploaderRules';
import {
  VENUE_IMAGE_UPLOADER_RULES,
  resolveVenueImageUrl,
  venueImageAlt,
} from '@/lib/venues/venueImageRules';
import { optimizeVenueImage } from '@/lib/venues/optimizeVenueImage';

/** Reglas puras + la reducción con canvas (lo único que necesita DOM). */
const VENUE_PHOTO_RULES: UploaderRules = {
  ...VENUE_IMAGE_UPLOADER_RULES,
  prepare: optimizeVenueImage,
};

interface VenuePhotoSectionProps {
  venue: Venue;
}

export function VenuePhotoSection({ venue }: VenuePhotoSectionProps) {
  const { puede } = usePermisos();
  // El `venue` del padre es una foto fija del listado: el detalle en cache es
  // lo que se actualiza al subir o quitar (ver `syncVenue`).
  const { data: fresh } = useVenue(venue.id);
  const current = fresh ?? venue;

  const upload = useUploadVenueImage();
  const remove = useDeleteVenueImage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Mismo permiso que editar la sede (backend: ACCIONES.VENUE_MANAGE).
  if (!puede('VENUE_MANAGE')) return null;

  const src = resolveVenueImageUrl(current.imageUrl, API_BASE_URL);

  const handleRemove = async () => {
    try {
      await remove.mutateAsync(current.id);
      setConfirmOpen(false);
      setAnnouncement('Foto quitada. La sede queda sin foto.');
    } catch (error) {
      logError('VenuePhotoSection.handleRemove', error);
    }
  };

  return (
    <div className="space-y-2">
      {/* `key` por versión: al cambiar la foto el uploader arranca limpio y
          muestra la nueva como vigente. */}
      <DocumentUploader
        key={current.imageUrl ?? 'sin-foto'}
        title="Foto de la sede"
        hint="Es la portada de la tarjeta en la página pública de sedes. Queda mejor horizontal."
        headingLevel={3}
        rules={VENUE_PHOTO_RULES}
        currentImage={src ? { src, alt: venueImageAlt(current.name) } : null}
        currentActions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive-600 hover:text-destructive-700 hover:bg-destructive-50"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Quitar foto
          </Button>
        }
        onUpload={async (file, { onProgress, signal }) => {
          setAnnouncement('');
          await upload.mutateAsync({ id: current.id, file, options: { onProgress, signal } });
          setAnnouncement('Foto de la sede subida.');
        }}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Quitar la foto?"
        description={`La tarjeta de ${current.name} en la página pública va a mostrarse sin foto. Podés subir otra cuando quieras.`}
        confirmLabel="Sí, quitar"
        pendingLabel="Quitando..."
        onConfirm={handleRemove}
        isLoading={remove.isPending}
      />
    </div>
  );
}
