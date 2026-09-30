// ===========================================
// VenueFormDialog — modal de alta y edición de sedes
// ===========================================
import { useState } from 'react';
import { CheckCircle2, MapPin, Pencil } from 'lucide-react';
import type { Venue } from '@/types';
import { VenueForm } from '../components/VenueForm';
import { VenuePhotoSection } from './VenuePhotoSection';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente ⇒ modo edición; ausente ⇒ alta. */
  venue?: Venue | null;
}

/**
 * Envoltorio del `VenueForm` en un modal. Alta y edición sólo se diferencian en
 * el encabezado y en si hay datos iniciales, así que comparten componente: antes
 * eran dos bloques de `<Dialog>` casi idénticos en la página.
 *
 * La foto necesita el `id` de la sede, que en el alta no existe hasta guardar.
 * Por eso el alta tiene un segundo paso dentro del mismo modal: "Sede creada,
 * ahora cargale una foto" (opcional), sin salir del flujo.
 */
export function VenueFormDialog({ open, onOpenChange, venue }: VenueFormDialogProps) {
  const [createdVenue, setCreatedVenue] = useState<Venue | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCreatedVenue(null);
    onOpenChange(next);
  };
  const close = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary-900 flex items-center gap-2">
            {createdVenue ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-secondary-600" aria-hidden="true" />
                Sede creada
              </>
            ) : venue ? (
              <>
                <Pencil className="w-5 h-5 text-primary-600" aria-hidden="true" />
                Editar Sede
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 text-primary-600" aria-hidden="true" />
                Nueva Sede de Competencia
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-primary-500">
            {createdVenue
              ? `${createdVenue.name} ya está registrada. Si querés, cargale una foto ahora: es la portada de su tarjeta en la página pública. También podés hacerlo después desde "Editar".`
              : venue
                ? `Modificá los datos, la ubicación y la foto de ${venue.name}.`
                : 'Registrá una nueva instalación deportiva. Después de guardarla vas a poder cargarle una foto.'}
          </DialogDescription>
        </DialogHeader>

        {createdVenue ? (
          <div className="space-y-4 pt-1">
            <VenuePhotoSection venue={createdVenue} />
            <div className="flex justify-end pt-3 border-t border-primary-100">
              <Button type="button" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {venue && <VenuePhotoSection venue={venue} />}
            <VenueForm
              initialData={venue ?? undefined}
              onSuccess={(saved) => (venue ? close() : setCreatedVenue(saved))}
              onCancel={close}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
