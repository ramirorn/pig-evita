// ===========================================
// VenueFormDialog — modal de alta y edición de sedes
// ===========================================
import { MapPin, Pencil } from 'lucide-react';
import type { Venue } from '@/types';
import { VenueForm } from '../components/VenueForm';
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
 */
export function VenueFormDialog({ open, onOpenChange, venue }: VenueFormDialogProps) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary-900 flex items-center gap-2">
            {venue ? (
              <>
                <Pencil className="w-5 h-5 text-primary-600" />
                Editar Sede
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5 text-primary-600" />
                Nueva Sede de Competencia
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-primary-500">
            {venue
              ? `Modificá los datos y la ubicación de ${venue.name}.`
              : 'Registrá una nueva instalación deportiva para alojar disciplinas y eventos.'}
          </DialogDescription>
        </DialogHeader>

        <VenueForm initialData={venue ?? undefined} onSuccess={close} onCancel={close} />
      </DialogContent>
    </Dialog>
  );
}
