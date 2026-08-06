// ===========================================
// Confirm Delete Dialog Component
// ===========================================
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemName?: string;
  description?: string;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = '¿Eliminar elemento?',
  itemName,
  description,
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isDeleting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[440px] p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-1">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <DialogHeader className="space-y-1 text-center sm:text-center">
            <DialogTitle className="text-lg font-bold text-primary-950">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-600">
              {description ? (
                description
              ) : itemName ? (
                <>
                  ¿Estás seguro de que deseas eliminar{' '}
                  <span className="font-semibold text-primary-900">"{itemName}"</span>?
                  Esta acción no se puede deshacer.
                </>
              ) : (
                'Esta acción no se puede deshacer y eliminará permanentemente el registro.'
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="w-full sm:w-auto gap-2"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
